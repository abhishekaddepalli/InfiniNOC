const { R } = require("redbean-node");
const metricsStore = require("./metrics-store");
const profileRegistry = require("./snmp-profile-registry");

class SnmpMonitoring {
    /**
     * Get or create SNMP configuration for a hardware device
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Sanitized SNMP configuration
     */
    static async getSnmpConfig(deviceId, organizationId) {
        const orgId = organizationId || 1;

        // Verify device access
        const device = await R.getRow(
            "SELECT id, name, ip_address, device_type, vendor FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        let config = await R.getRow(
            "SELECT * FROM snmp_config WHERE device_id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!config) {
            // Return default config template
            config = {
                device_id: Number(deviceId),
                snmp_version: "v2c",
                credential_id: null,
                port: 161,
                timeout: 5000,
                retries: 2,
                poll_interval: 30,
            };
        }

        return SnmpMonitoring.sanitizeConfig(config);
    }

    /**
     * Save/Update SNMP configuration for a device
     * @param {number} deviceId Device ID
     * @param {object} configData Configuration parameters
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Sanitized configuration
     */
    static async saveSnmpConfig(deviceId, configData, organizationId) {
        const orgId = organizationId || 1;

        const device = await R.getRow(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        const existing = await R.getRow(
            "SELECT id FROM snmp_config WHERE device_id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        const version = configData.snmp_version || "v2c";
        const credId = configData.credential_id || null;
        const port = Number(configData.port) || 161;
        const timeout = Number(configData.timeout) || 5000;
        const retries = Number(configData.retries) || 2;
        const pollInterval = Number(configData.poll_interval) || 30;

        if (existing) {
            await R.exec(
                `UPDATE snmp_config SET
                    snmp_version = ?,
                    credential_id = ?,
                    port = ?,
                    timeout = ?,
                    retries = ?,
                    poll_interval = ?,
                    updated_at = DATETIME('now')
                WHERE id = ? AND organization_id = ?`,
                [version, credId, port, timeout, retries, pollInterval, existing.id, orgId]
            );
        } else {
            await R.exec(
                `INSERT INTO snmp_config (
                    organization_id, device_id, snmp_version, credential_id, port, timeout, retries, poll_interval, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))`,
                [orgId, deviceId, version, credId, port, timeout, retries, pollInterval]
            );
        }

        return await SnmpMonitoring.getSnmpConfig(deviceId, orgId);
    }

    /**
     * Ingest high-frequency SNMP metric payload received from probe
     * @param {number} deviceId Device ID
     * @param {object} metricPayload Telemetry metric payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Ingestion status
     */
    static async ingestMetrics(deviceId, metricPayload, organizationId) {
        const orgId = organizationId || 1;

        const device = await R.getRow(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        // Store metric sample directly in high-frequency MetricsStore (zero DB pollution)
        metricsStore.ingestMetrics(deviceId, metricPayload);

        // Update device status in primary relational database if unreachable or online
        if (metricPayload && metricPayload.status) {
            await R.exec(
                "UPDATE device SET status = ?, updated_at = DATETIME('now') WHERE id = ? AND organization_id = ?",
                [metricPayload.status, deviceId, orgId]
            );
        }

        return { ok: true, timestamp: new Date().toISOString() };
    }

    /**
     * Get high-frequency time-series metrics for a device
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Device metrics
     */
    static async getDeviceMetrics(deviceId, organizationId) {
        const orgId = organizationId || 1;

        const device = await R.getRow(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        return metricsStore.getDeviceMetrics(deviceId);
    }

    /**
     * Sanitize configuration object so secrets/community strings are NEVER returned in API responses
     * @param {object} config SNMP config object
     * @returns {object} Sanitized config
     */
    static sanitizeConfig(config) {
        if (!config) {
            return null;
        }
        const clean = { ...config };
        // Delete any raw password/community string keys if present
        delete clean.community;
        delete clean.secret;
        delete clean.password;
        delete clean.privPassword;
        clean.hasCredential = !!clean.credential_id;
        return clean;
    }

    /**
     * List supported vendor profiles
     * @returns {Array<object>} Profile list
     */
    /**
     * Test SNMP connection to a target host and port
     * @param {object} params Connection parameters
     * @returns {Promise<object>} Test result with latency & diagnostic status
     */
    static async testSnmpConnection(params) {
        const hostname = params.hostname || params.ip || "127.0.0.1";
        const port = Number(params.port) || 161;
        const version = params.snmpVersion || params.version || "v2c";
        const community = params.community || "public";
        const timeout = Number(params.timeout) || 3000;

        const startTime = Date.now();

        try {
            // Test UDP / TCP reachability or SNMP net-snmp session
            const snmp = require("net-snmp");
            const session = snmp.createSession(hostname, community, {
                port,
                version: version === "v1" ? snmp.Version1 : snmp.Version2c,
                timeout,
            });

            const oid = params.oid || "1.3.6.1.2.1.1.1.0"; // sysDescr

            return new Promise((resolve) => {
                session.get([oid], (error, varbinds) => {
                    const latency = Date.now() - startTime;
                    session.close();
                    if (error) {
                        resolve({
                            ok: false,
                            status: "error",
                            latencyMs: latency,
                            msg: `SNMP Test Failed: ${error.message || error}`,
                        });
                    } else if (varbinds && varbinds.length > 0) {
                        const vb = varbinds[0];
                        if (snmp.isVarbindError(vb)) {
                            resolve({
                                ok: false,
                                status: "error",
                                latencyMs: latency,
                                msg: `SNMP Varbind Error: ${snmp.varbindError(vb)}`,
                            });
                        } else {
                            resolve({
                                ok: true,
                                status: "connected",
                                latencyMs: latency,
                                oid,
                                value: String(vb.value),
                                msg: `SNMP Response Received in ${latency}ms: ${String(vb.value).substring(0, 100)}`,
                            });
                        }
                    } else {
                        resolve({
                            ok: true,
                            status: "connected",
                            latencyMs: latency,
                            msg: `SNMP Host Reachable in ${latency}ms (No varbind returned).`,
                        });
                    }
                });
            });
        } catch (e) {
            const latency = Date.now() - startTime;
            return {
                ok: false,
                status: "error",
                latencyMs: latency,
                msg: `SNMP Connection Error: ${e.message || "Failed to initialize SNMP session"}`,
            };
        }
    }
}

module.exports = SnmpMonitoring;
