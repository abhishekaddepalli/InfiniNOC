const { R } = require("redbean-node");
const crypto = require("crypto");

class Probe {
    /**
     * Hash string using SHA-256 for secure token comparison
     * @param {string} token Secret token
     * @returns {string} SHA-256 hex string
     */
    static hashToken(token) {
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    /**
     * Create a new probe and return a one-time registration token
     * @param {object} data Probe parameters (name, site_id, description)
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Probe record and unhashed one-time token
     */
    static async createProbeRegistrationToken(data, organizationId) {
        const orgId = organizationId || 1;

        if (!data || !data.name) {
            throw new Error("Probe name is required.");
        }

        const rawRegistrationToken = "prb_reg_" + crypto.randomBytes(24).toString("hex");
        const tokenHash = Probe.hashToken(rawRegistrationToken);

        // One-time token expires in 24 hours
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await R.exec(
            `INSERT INTO probe (
                organization_id, site_id, name, description, registration_token_hash, registration_token_used, token_expires_at, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', DATETIME('now'), DATETIME('now'))`,
            [
                orgId,
                data.site_id || null,
                data.name.trim(),
                data.description || null,
                tokenHash,
                expiresAt,
            ]
        );

        const probeId = await R.getCell(
            "SELECT MAX(id) FROM probe WHERE organization_id = ?",
            [orgId]
        );

        const probe = await Probe.getProbe(probeId, orgId);

        return {
            probe,
            registrationToken: rawRegistrationToken,
        };
    }

    /**
     * Probe registration endpoint: exchanges one-time token for persistent API key
     * @param {number} probeId Probe ID
     * @param {string} registrationToken Unhashed one-time token
     * @param {string} ipAddress Remote IP address
     * @param {string} version Probe software version
     * @returns {Promise<object>} Persistent API key and probe identity
     */
    static async registerProbe(probeId, registrationToken, ipAddress, version) {
        if (!probeId || !registrationToken) {
            throw new Error("Probe ID and registration token required.");
        }

        const probe = await R.getRow(
            "SELECT * FROM probe WHERE id = ?",
            [probeId]
        );

        if (!probe) {
            throw new Error("Probe not found.");
        }

        if (probe.status === "revoked") {
            throw new Error("Probe has been revoked by administrator.");
        }

        if (probe.registration_token_used) {
            throw new Error("Registration token has already been used.");
        }

        const tokenHash = Probe.hashToken(registrationToken);
        if (probe.registration_token_hash !== tokenHash) {
            throw new Error("Invalid registration token.");
        }

        if (probe.token_expires_at && new Date(probe.token_expires_at) < new Date()) {
            throw new Error("Registration token has expired.");
        }

        // Generate persistent API key and mark token as used
        const rawApiKey = "prb_key_" + crypto.randomBytes(32).toString("hex");
        const apiKeyHash = Probe.hashToken(rawApiKey);

        await R.exec(
            `UPDATE probe SET
                registration_token_used = 1,
                api_key_hash = ?,
                status = 'online',
                ip_address = ?,
                version = ?,
                last_heartbeat = DATETIME('now'),
                updated_at = DATETIME('now')
            WHERE id = ?`,
            [
                apiKeyHash,
                ipAddress || "127.0.0.1",
                version || "1.0.0",
                probeId,
            ]
        );

        return {
            probeId: probe.id,
            organizationId: probe.organization_id,
            siteId: probe.site_id,
            name: probe.name,
            apiKey: rawApiKey,
        };
    }

    /**
     * Authenticate persistent probe API key
     * @param {number} probeId Probe ID
     * @param {string} apiKey Unhashed persistent API key
     * @returns {Promise<object>} Probe record
     */
    static async authenticateProbe(probeId, apiKey) {
        if (!probeId || !apiKey) {
            throw new Error("Probe ID and API key required.");
        }

        const probe = await R.getRow("SELECT * FROM probe WHERE id = ?", [probeId]);
        if (!probe) {
            throw new Error("Probe not found.");
        }

        if (probe.status === "revoked") {
            throw new Error("Probe has been revoked.");
        }

        const apiKeyHash = Probe.hashToken(apiKey);
        if (probe.api_key_hash !== apiKeyHash) {
            throw new Error("Invalid probe API key.");
        }

        return probe;
    }

    /**
     * Record real probe heartbeat
     * @param {number} probeId Probe ID
     * @param {string} apiKey Probe persistent API key
     * @param {object} telemetry Heartbeat payload (latency_ms, ip_address, version)
     * @returns {Promise<object>} Updated status
     */
    static async recordHeartbeat(probeId, apiKey, telemetry) {
        await Probe.authenticateProbe(probeId, apiKey);

        const lat = telemetry && telemetry.latency_ms !== undefined ? Number(telemetry.latency_ms) : null;
        const ip = telemetry && telemetry.ip_address ? telemetry.ip_address : undefined;
        const ver = telemetry && telemetry.version ? telemetry.version : undefined;

        await R.exec(
            `UPDATE probe SET
                status = 'online',
                latency_ms = COALESCE(?, latency_ms),
                ip_address = COALESCE(?, ip_address),
                version = COALESCE(?, version),
                last_heartbeat = DATETIME('now'),
                updated_at = DATETIME('now')
            WHERE id = ?`,
            [lat, ip || null, ver || null, probeId]
        );

        return { ok: true, timestamp: new Date().toISOString() };
    }

    /**
     * Revoke probe access
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated probe
     */
    static async revokeProbe(probeId, organizationId) {
        const orgId = organizationId || 1;
        const probe = await R.getCell("SELECT id FROM probe WHERE id = ? AND organization_id = ?", [probeId, orgId]);
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        await R.exec(
            "UPDATE probe SET status = 'revoked', api_key_hash = NULL, updated_at = DATETIME('now') WHERE id = ? AND organization_id = ?",
            [probeId, orgId]
        );

        return await Probe.getProbe(probeId, orgId);
    }

    /**
     * Rotate probe API key credentials
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} New one-time registration token for re-keying
     */
    static async rotateCredentials(probeId, organizationId) {
        const orgId = organizationId || 1;
        const probe = await R.getCell("SELECT id FROM probe WHERE id = ? AND organization_id = ?", [probeId, orgId]);
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        const rawRegistrationToken = "prb_reg_" + crypto.randomBytes(24).toString("hex");
        const tokenHash = Probe.hashToken(rawRegistrationToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await R.exec(
            `UPDATE probe SET
                registration_token_hash = ?,
                registration_token_used = 0,
                token_expires_at = ?,
                api_key_hash = NULL,
                status = 'pending',
                updated_at = DATETIME('now')
            WHERE id = ? AND organization_id = ?`,
            [tokenHash, expiresAt, probeId, orgId]
        );

        const updatedProbe = await Probe.getProbe(probeId, orgId);

        return {
            probe: updatedProbe,
            registrationToken: rawRegistrationToken,
        };
    }

    /**
     * Delete probe
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteProbe(probeId, organizationId) {
        const orgId = organizationId || 1;
        const probe = await R.getCell("SELECT id FROM probe WHERE id = ? AND organization_id = ?", [probeId, orgId]);
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        await R.exec("DELETE FROM probe WHERE id = ? AND organization_id = ?", [probeId, orgId]);
        return true;
    }

    /**
     * Get single probe scoped to organization_id
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Probe record with site details
     */
    static async getProbe(probeId, organizationId) {
        const orgId = organizationId || 1;
        const probe = await R.getRow(
            "SELECT probe.*, site.name as site_name FROM probe LEFT JOIN site ON probe.site_id = site.id WHERE probe.id = ? AND probe.organization_id = ?",
            [probeId, orgId]
        );

        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        return probe;
    }

    /**
     * Get all probes scoped to organization_id with calculated status
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Probe list
     */
    static async getProbeList(organizationId) {
        const orgId = organizationId || 1;
        const probes = await R.getAll(
            "SELECT probe.*, site.name as site_name FROM probe LEFT JOIN site ON probe.site_id = site.id WHERE probe.organization_id = ? ORDER BY probe.id DESC",
            [orgId]
        );

        const now = Date.now();
        for (const p of probes) {
            if (p.status !== "revoked" && p.status !== "pending") {
                // If last heartbeat was more than 45 seconds ago, mark offline
                if (!p.last_heartbeat || now - new Date(p.last_heartbeat).getTime() > 45000) {
                    p.status = "offline";
                }
            }
        }

        return probes;
    }
}

module.exports = Probe;
