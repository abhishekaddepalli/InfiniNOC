const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const crypto = require("crypto");
const dayjs = require("dayjs");
const { toSqlDatetime } = require("../util-server");

class Probe extends BeanModel {
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
     * @param {object} data Probe parameters (name, site_id, description, region, location)
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

        // One-time token expires in 24 hours (Formatted in standard SQL UTC DATETIME)
        const expiresAt = toSqlDatetime(Date.now() + 24 * 60 * 60 * 1000);
        const isoNow = toSqlDatetime();

        await R.exec(
            `INSERT INTO probe (
                organization_id, site_id, name, description, region, location,
                registration_token_hash, registration_token_used, token_expires_at, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)`,
            [
                orgId,
                data.site_id || null,
                data.name.trim(),
                data.description || null,
                data.region || null,
                data.location || null,
                tokenHash,
                expiresAt,
                isoNow,
                isoNow,
            ]
        );

        const probeId = await R.getCell(
            "SELECT MAX(id) FROM probe WHERE (organization_id = ? OR organization_id IS NULL)",
            [orgId]
        );

        const probe = await Probe.getProbe(probeId, orgId);

        return {
            probe,
            registrationToken: rawRegistrationToken,
        };
    }

    /**
     * Validate a probe registration token without marking it as used
     * @param {number} probeId Probe ID
     * @param {string} registrationToken Plaintext registration token
     * @returns {Promise<object>} Probe database row
     */
    static async validateToken(probeId, registrationToken) {
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

        if (probe.token_expires_at) {
            const expStr = String(probe.token_expires_at);
            const expTime = new Date(expStr.includes("T") ? expStr : expStr.replace(" ", "T") + "Z").getTime();
            if (!isNaN(expTime) && expTime < Date.now()) {
                throw new Error("Registration token has expired.");
            }
        }

        return probe;
    }

    /**
     * Probe registration endpoint: exchanges one-time token for persistent API key
     * @param {number} probeId Probe ID
     * @param {string} registrationToken Unhashed one-time token
     * @param {string} ipAddress Remote IP address
     * @param {string} version Probe software version
     * @param {object} meta Optional system metadata (os_info, region)
     * @returns {Promise<object>} Persistent API key and probe identity
     */
    static async registerProbe(probeId, registrationToken, ipAddress, version, meta = {}) {
        const probe = await Probe.validateToken(probeId, registrationToken);

        // Generate persistent API key and mark token as used
        const rawApiKey = "prb_key_" + crypto.randomBytes(32).toString("hex");
        const apiKeyHash = Probe.hashToken(rawApiKey);
        const isoNow = toSqlDatetime();

        await R.exec(
            `UPDATE probe SET
                registration_token_used = 1,
                api_key_hash = ?,
                status = 'online',
                ip_address = ?,
                version = ?,
                os_info = COALESCE(?, os_info),
                region = COALESCE(?, region),
                last_heartbeat = ?,
                updated_at = ?
            WHERE id = ?`,
            [
                apiKeyHash,
                ipAddress || "127.0.0.1",
                version || "1.0.0",
                meta.os_info || null,
                meta.region || null,
                isoNow,
                isoNow,
                probeId,
            ]
        );

        return {
            probeId: probe.id,
            organizationId: probe.organization_id || 1,
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
     * Record real probe heartbeat telemetry (CPU, RAM, Disk, Latency, Version, etc.)
     * @param {number} probeId Probe ID
     * @param {string} apiKey Probe persistent API key
     * @param {object} telemetry Heartbeat payload (cpu_usage, memory_usage, disk_usage, latency_ms, ip_address, version, tasks_executed, tasks_failed)
     * @returns {Promise<object>} Updated status
     */
    static async recordHeartbeat(probeId, apiKey, telemetry = {}) {
        const probe = await Probe.authenticateProbe(probeId, apiKey);

        const lat = telemetry.latency_ms !== undefined ? Number(telemetry.latency_ms) : null;
        const ip = telemetry.ip_address || undefined;
        const ver = telemetry.version || undefined;
        const cpu = telemetry.cpu_usage !== undefined ? Number(telemetry.cpu_usage) : null;
        const mem = telemetry.memory_usage !== undefined ? Number(telemetry.memory_usage) : null;
        const disk = telemetry.disk_usage !== undefined ? Number(telemetry.disk_usage) : null;
        const osInfo = telemetry.os_info || undefined;
        const tasksExec = telemetry.tasks_executed !== undefined ? Number(telemetry.tasks_executed) : null;
        const tasksFailed = telemetry.tasks_failed !== undefined ? Number(telemetry.tasks_failed) : null;
        const queueBacklog = telemetry.queue_backlog !== undefined ? Number(telemetry.queue_backlog) : null;

        const isoNow = toSqlDatetime();

        await R.exec(
            `UPDATE probe SET
                status = 'online',
                latency_ms = COALESCE(?, latency_ms),
                ip_address = COALESCE(?, ip_address),
                version = COALESCE(?, version),
                cpu_usage = COALESCE(?, cpu_usage),
                memory_usage = COALESCE(?, memory_usage),
                disk_usage = COALESCE(?, disk_usage),
                os_info = COALESCE(?, os_info),
                tasks_executed = COALESCE(?, tasks_executed),
                tasks_failed = COALESCE(?, tasks_failed),
                queue_backlog = COALESCE(?, queue_backlog),
                last_heartbeat = ?,
                updated_at = ?
            WHERE id = ?`,
            [
                lat,
                ip || null,
                ver || null,
                cpu,
                mem,
                disk,
                osInfo || null,
                tasksExec,
                tasksFailed,
                queueBacklog,
                isoNow,
                isoNow,
                probeId,
            ]
        );

        // If probe had an active offline alert, auto-resolve it
        try {
            const orgId = probe.organization_id || 1;
            const existingAlert = await R.getRow(
                "SELECT * FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'probe' AND target_id = ?",
                [orgId, probeId]
            );
            if (existingAlert) {
                const recMsg = `[RECOVERED] Distributed Probe #${probeId} (${probe.name}) is back ONLINE`;
                await R.exec(
                    "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, 0, 'RECOVERED', ?, ?)",
                    [orgId, existingAlert.id, recMsg, isoNow]
                );
                await R.exec("DELETE FROM active_alert WHERE id = ?", [existingAlert.id]);
            }
        } catch (e) {
            // Ignore alert resolution error if table not ready
        }

        return { ok: true, timestamp: isoNow, status: "online" };
    }

    /**
     * Get assigned monitoring tasks for a probe
     * @param {number} probeId Probe ID
     * @param {string} apiKey Probe persistent API key
     * @returns {Promise<Array>} List of monitoring tasks
     */
    static async getAssignedTasks(probeId, apiKey) {
        const probe = await Probe.authenticateProbe(probeId, apiKey);
        const orgId = probe.organization_id || 1;

        // Fetch monitors explicitly assigned to this probe, or via monitor_probe table
        const tasks = await R.getAll(
            `SELECT DISTINCT
                m.id, m.name, m.type, m.url, m.hostname, m.port, m.interval, m.timeout,
                m.maxretries, m.method, m.dns_resolve_type, m.dns_resolve_server,
                m.accepted_statuscodes_json
            FROM monitor m
            LEFT JOIN monitor_probe mp ON m.id = mp.monitor_id
            WHERE (m.probe_id = ? OR mp.probe_id = ?)
            AND m.active = 1`,
            [probeId, probeId]
        );

        return tasks;
    }

    /**
     * Ingest check results from a remote probe agent
     * @param {number} probeId Probe ID
     * @param {string} apiKey Probe persistent API key
     * @param {object} payload Task result: { monitor_id, status, ping, msg, timestamp }
     * @returns {Promise<object>} Ingestion status
     */
    static async submitTaskResult(probeId, apiKey, payload) {
        await Probe.authenticateProbe(probeId, apiKey);

        if (!payload || !payload.monitor_id) {
            throw new Error("Invalid task result: monitor_id is required.");
        }

        const monitor = await R.getRow("SELECT * FROM monitor WHERE id = ?", [payload.monitor_id]);
        if (!monitor) {
            throw new Error(`Monitor #${payload.monitor_id} not found.`);
        }

        const Monitor = require("./monitor");
        const { UptimeCalculator } = require("../uptime-calculator");
        const { UptimeKumaServer } = require("../uptime-kuma-server");

        const isoNow = toSqlDatetime(payload.timestamp || new Date());
        const status = Number(payload.status) === 1 ? 1 : 0;
        const pingMs = payload.ping !== undefined && payload.ping !== null ? Math.round(Number(payload.ping)) : null;
        const msg = payload.msg || (status === 1 ? `UP via Probe #${probeId}` : `DOWN via Probe #${probeId}`);

        // Fetch previous heartbeat to detect state transition
        const previousBeat = await R.findOne("heartbeat", " monitor_id = ? ORDER BY time DESC", [monitor.id]);
        const isFirstBeat = !previousBeat;
        const isImportant = Monitor.isImportantBeat(isFirstBeat, previousBeat?.status, status);

        // Update uptime calculator
        let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitor.id);
        let endTimeDayjs = await uptimeCalculator.update(status, pingMs !== null ? parseFloat(pingMs) : null);

        let bean = R.dispense("heartbeat");
        bean.monitor_id = monitor.id;
        bean.status = status;
        bean.ping = pingMs;
        bean.time = isoNow;
        bean.msg = msg;
        bean.duration = 0;
        bean.down_count = status === 0 ? ((previousBeat?.down_count || 0) + 1) : 0;
        bean.probe_id = probeId;
        bean.important = isImportant;
        bean.end_time = R.isoDateTimeMillis(endTimeDayjs);

        await R.store(bean);

        // Broadcast real-time heartbeat to socket clients
        const server = UptimeKumaServer.getInstance();
        if (server && server.io) {
            const heartbeatPayload = typeof bean.toJSON === "function" ? bean.toJSON() : {
                monitorID: monitor.id,
                status,
                time: isoNow,
                msg,
                ping: pingMs,
                important: isImportant,
                duration: 0,
            };
            server.io.to(monitor.user_id).emit("heartbeat", heartbeatPayload);
            Monitor.sendStats(server.io, monitor.id, monitor.user_id);
        }

        // Auto Outage Incident and Active Alert Synchronization on probe DOWN
        if (status === 0) {
            try {
                const orgId = monitor.organization_id || 1;
                const monTarget = monitor.hostname || monitor.url || `Target #${monitor.id}`;
                const monType = (monitor.type || "TARGET").toUpperCase();
                const failureReason = msg || `Target ${monitor.name} (${monTarget}) is DOWN via Probe #${probeId}`;

                // 1. Ensure Active Incident exists for this outage
                const existingInc = await R.getRow(
                    `SELECT incident.id FROM incident 
                    JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                    WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                    AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                    AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                    [orgId, monitor.id]
                );

                if (!existingInc) {
                    const Incident = require("./incident");
                    await Incident.createIncident(
                        {
                            title: `[OUTAGE] Monitor #${monitor.id} (${monitor.name}) is DOWN`,
                            description: `Automated NOC Outage Incident raised for ${monitor.name} reported by Distributed Probe #${probeId}. Target: ${monTarget}. Protocol: ${monType}. Failure Reason: ${failureReason}`,
                            failure_reason: failureReason,
                            severity: "P1",
                            links: [{ entity_type: "monitor", entity_id: monitor.id }],
                        },
                        orgId,
                        monitor.user_id
                    );
                    if (server && server.io) {
                        server.io.emit("updateIncidentStats");
                    }
                }

                // 2. Ensure Active Alert exists for this outage
                const existingAlert = await R.getRow(
                    "SELECT id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                    [orgId, monitor.id]
                );

                if (!existingAlert) {
                    const alertMsg = `Monitor #${monitor.id} (${monitor.name}) is DOWN via Probe #${probeId}: ${failureReason}`;
                    await R.exec(
                        `INSERT INTO active_alert (
                            organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
                        ) VALUES (?, 0, 'monitor', ?, 'monitor_down', 'CRITICAL', 0, ?, ?, ?, ?, ?)`,
                        [orgId, monitor.id, alertMsg, isoNow, isoNow, isoNow, isoNow]
                    );
                    if (server && server.io) {
                        server.io.emit("updateActiveAlerts");
                    }
                }
            } catch (e) {
                console.error("[Probe.submitTaskResult] Incident/Alert error:", e.message);
            }
        } else if (status === 1 && previousBeat?.status === 0) {
            // Recovery: Auto-resolve incidents and alerts
            try {
                const orgId = monitor.organization_id || 1;
                const openIncidents = await R.getAll(
                    `SELECT incident.id FROM incident 
                    JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                    WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                    AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                    AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                    [orgId, monitor.id]
                );

                for (const inc of openIncidents) {
                    await R.exec(
                        "UPDATE incident SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE id = ?",
                        [isoNow, isoNow, inc.id]
                    );
                    await R.exec(
                        "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'resolved', 'Auto resolved on probe monitor recovery (UP)', ?)",
                        [orgId, inc.id, null, isoNow]
                    );
                }
                if (openIncidents.length > 0 && server && server.io) {
                    server.io.emit("updateIncidentStats");
                }

                const existingAlert = await R.getRow(
                    "SELECT * FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                    [orgId, monitor.id]
                );
                if (existingAlert) {
                    const recoveryMsg = `[RECOVERED] Monitor #${monitor.id} (${monitor.name}) returned to service (UP via Probe #${probeId})`;
                    await R.exec(
                        "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, ?, 'RECOVERED', ?, ?)",
                        [orgId, existingAlert.id, existingAlert.rule_id || 0, recoveryMsg, isoNow]
                    );
                    await R.exec("DELETE FROM active_alert WHERE id = ?", [existingAlert.id]);
                    if (server && server.io) {
                        server.io.emit("updateActiveAlerts");
                    }
                }
            } catch (e) {
                console.error("[Probe.submitTaskResult] Incident/Alert recovery error:", e.message);
            }
        }

        // Update probe tasks count
        if (status === 1) {
            await R.exec("UPDATE probe SET tasks_executed = COALESCE(tasks_executed, 0) + 1 WHERE id = ?", [probeId]);
        } else {
            await R.exec("UPDATE probe SET tasks_failed = COALESCE(tasks_failed, 0) + 1 WHERE id = ?", [probeId]);
        }

        return { ok: true, monitorId: monitor.id, status, timestamp: isoNow };
    }

    /**
     * Check health of all probes and flag offline agents
     * @param {object} io Socket.io instance for real-time broadcasts
     * @returns {Promise<number>} Number of newly offline probes
     */
    static async checkAllProbesHealth(io) {
        try {
            const now = Date.now();
            const probes = await R.getAll("SELECT * FROM probe WHERE status IN ('online', 'pending')");
            let newlyOffline = 0;
            const isoNow = toSqlDatetime();

            for (const p of probes) {
                if (p.last_heartbeat) {
                    const hbStr = String(p.last_heartbeat);
                    const lastBeatTime = new Date(hbStr.includes("T") ? hbStr : hbStr.replace(" ", "T") + "Z").getTime();
                    const elapsed = now - (isNaN(lastBeatTime) ? new Date(p.last_heartbeat).getTime() : lastBeatTime);
                    // If no heartbeat for > 60 seconds, mark offline
                    if (elapsed > 60000 && p.status === "online") {
                        await R.exec(
                            "UPDATE probe SET status = 'offline', updated_at = ? WHERE id = ?",
                            [isoNow, p.id]
                        );
                        newlyOffline++;

                        // Raise probe offline alert
                        const orgId = p.organization_id || 1;
                        const alertMsg = `Distributed Probe #${p.id} (${p.name}) is OFFLINE. Last heartbeat was ${Math.round(elapsed / 1000)}s ago.`;
                        const exists = await R.getCell(
                            "SELECT id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'probe' AND target_id = ?",
                            [orgId, p.id]
                        );
                        if (!exists) {
                            await R.exec(
                                `INSERT INTO active_alert (
                                    organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
                                ) VALUES (?, 0, 'probe', ?, 'probe_offline', 'CRITICAL', 0, ?, ?, ?, ?, ?)`,
                                [orgId, p.id, alertMsg, isoNow, isoNow, isoNow, isoNow]
                            );
                        }
                    }
                }
            }

            if (newlyOffline > 0 && io) {
                io.emit("updateActiveAlerts");
                io.emit("updateProbeList");
            }

            return newlyOffline;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Revoke probe access
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated probe
     */
    static async revokeProbe(probeId, organizationId) {
        const orgId = organizationId || 1;
        const probe = await R.getCell(
            "SELECT id FROM probe WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [probeId, orgId]
        );
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        const isoNow = toSqlDatetime();
        await R.exec(
            "UPDATE probe SET status = 'revoked', api_key_hash = NULL, updated_at = ? WHERE id = ?",
            [isoNow, probeId]
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
        const probe = await R.getCell(
            "SELECT id FROM probe WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [probeId, orgId]
        );
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        const rawRegistrationToken = "prb_reg_" + crypto.randomBytes(24).toString("hex");
        const tokenHash = Probe.hashToken(rawRegistrationToken);
        const expiresAt = toSqlDatetime(Date.now() + 24 * 60 * 60 * 1000);
        const isoNow = toSqlDatetime();

        await R.exec(
            `UPDATE probe SET
                registration_token_hash = ?,
                registration_token_used = 0,
                token_expires_at = ?,
                api_key_hash = NULL,
                status = 'pending',
                updated_at = ?
            WHERE id = ?`,
            [tokenHash, expiresAt, isoNow, probeId]
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
        const probe = await R.getCell(
            "SELECT id FROM probe WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [probeId, orgId]
        );
        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        // Unlink any monitors assigned to this probe
        await R.exec("UPDATE monitor SET probe_id = NULL WHERE probe_id = ?", [probeId]);
        await R.exec("DELETE FROM monitor_probe WHERE probe_id = ?", [probeId]);
        await R.exec("DELETE FROM active_alert WHERE target_type = 'probe' AND target_id = ?", [probeId]);
        await R.exec("DELETE FROM probe WHERE id = ?", [probeId]);
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
            `SELECT probe.*, site.name AS site_name, site.code AS site_code
            FROM probe
            LEFT JOIN site ON probe.site_id = site.id
            WHERE probe.id = ? AND (probe.organization_id = ? OR probe.organization_id IS NULL)`,
            [probeId, orgId]
        );

        if (!probe) {
            throw new Error("Probe not found or access denied.");
        }

        return probe;
    }

    /**
     * Get all probes scoped to organization_id with calculated status and assigned monitor counts
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Probe list
     */
    static async getProbeList(organizationId) {
        const orgId = organizationId || 1;
        const probes = await R.getAll(
            `SELECT
                probe.*,
                site.name AS site_name,
                site.code AS site_code,
                COALESCE(mon_counts.total_monitors, 0) AS assigned_monitors
            FROM probe
            LEFT JOIN site ON probe.site_id = site.id
            LEFT JOIN (
                SELECT probe_id, COUNT(*) AS total_monitors
                FROM monitor
                WHERE probe_id IS NOT NULL
                GROUP BY probe_id
            ) mon_counts ON probe.id = mon_counts.probe_id
            WHERE (probe.organization_id = ? OR probe.organization_id IS NULL)
            ORDER BY probe.id DESC`,
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

    /**
     * Get detailed probe metrics, assigned monitors, and history
     * @param {number} probeId Probe ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Detailed probe object
     */
    static async getProbeDetails(probeId, organizationId) {
        const probe = await Probe.getProbe(probeId, organizationId);
        const monitors = await R.getAll(
            "SELECT id, name, type, url, hostname, port, active FROM monitor WHERE probe_id = ?",
            [probeId]
        );

        return {
            ...probe,
            assignedMonitors: monitors || [],
        };
    }
}

module.exports = Probe;
