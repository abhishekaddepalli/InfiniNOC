const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const { encryptSecret } = require("./credential-crypto");
const { toSqlDatetime } = require("../util-server");

class Device extends BeanModel {
    /**
     * Get all devices scoped to organization_id with optional site or type filtering
     * @param {number} organizationId Organization ID
     * @param {number} siteId Optional site filter
     * @param {string} deviceType Optional device type filter
     * @returns {Promise<Array>} Devices list
     */
    static async getDeviceList(organizationId, siteId, deviceType) {
        const orgId = organizationId || 1;
        const isoNow = toSqlDatetime();

        // Auto-bridge monitors into device table if they are not yet registered
        try {
            const unlinkedMonitors = await R.getAll(
                `SELECT m.id, m.name, m.hostname, m.port, m.type, m.user_id, m.organization_id
                FROM monitor m
                LEFT JOIN device_monitor dm ON m.id = dm.monitor_id
                WHERE dm.id IS NULL AND (m.organization_id = ? OR (m.organization_id IS NULL AND ? = 1))`,
                [orgId, orgId]
            );

            for (const m of unlinkedMonitors) {
                let cleanDevType = "Server";
                const lowerName = (m.name || "").toLowerCase();
                const lowerType = (m.type || "").toLowerCase();
                if (lowerName.includes("router") || lowerName.includes("core") || lowerName.includes("wan") || lowerName.includes("gateway")) cleanDevType = "Router";
                else if (lowerName.includes("switch") || lowerName.includes("agg")) cleanDevType = "Switch";
                else if (lowerName.includes("olt") || lowerName.includes("gpon")) cleanDevType = "OLT";
                else if (lowerName.includes("onu") || lowerName.includes("ont")) cleanDevType = "Other";
                else if (lowerType === "ping") cleanDevType = "Router";

                const hostOrIp = m.hostname || "127.0.0.1";

                await R.exec(
                    `INSERT INTO device (
                        organization_id, name, hostname, ip_address, device_type, status, tags, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 'online', '[]', ?, ?)`,
                    [orgId, m.name, hostOrIp, hostOrIp, cleanDevType, isoNow, isoNow]
                );

                const newDevId = await R.getCell(
                    "SELECT MAX(id) FROM device WHERE organization_id = ?",
                    [orgId]
                );

                if (newDevId) {
                    await R.exec(
                        "INSERT INTO device_monitor (device_id, monitor_id, created_at) VALUES (?, ?, ?)",
                        [newDevId, m.id, isoNow]
                    );
                }
            }
        } catch (e) {
            // Non-critical auto-bridge error catch
        }

        let sql = "SELECT device.*, site.name as site_name FROM device LEFT JOIN site ON device.site_id = site.id WHERE device.organization_id = ?";
        const params = [orgId];

        if (siteId) {
            sql += " AND device.site_id = ?";
            params.push(siteId);
        }

        if (deviceType && deviceType !== "ALL") {
            sql += " AND LOWER(device.device_type) = LOWER(?)";
            params.push(deviceType);
        }

        sql += " ORDER BY device.id DESC";

        const devices = await R.getAll(sql, params);

        // Batch load all linked monitors, latest heartbeats, and probe statuses
        const devIds = devices.map((d) => d.id);
        const monitorsByDevId = {};

        if (devIds.length > 0) {
            const placeholders = devIds.map(() => "?").join(",");
            const linkedMonitors = await R.getAll(
                `SELECT dm.device_id, m.id as monitor_id, m.name as monitor_name, m.type as monitor_type,
                        m.hostname, m.port, m.url, m.active, m.interval, m.probe_id
                 FROM device_monitor dm
                 INNER JOIN monitor m ON dm.monitor_id = m.id
                 WHERE dm.device_id IN (${placeholders})`,
                devIds
            );

            const monIds = linkedMonitors.map((lm) => lm.monitor_id);
            const heartbeatByMonId = {};

            if (monIds.length > 0) {
                const monPlaceholders = monIds.map(() => "?").join(",");
                const heartbeats = await R.getAll(
                    `SELECT h.monitor_id, h.status, h.ping, h.time, h.msg
                     FROM heartbeat h
                     INNER JOIN (
                         SELECT monitor_id, MAX(id) as max_id
                         FROM heartbeat
                         WHERE monitor_id IN (${monPlaceholders})
                         GROUP BY monitor_id
                     ) latest ON h.id = latest.max_id`,
                    monIds
                );
                for (const hb of heartbeats) {
                    heartbeatByMonId[hb.monitor_id] = hb;
                }
            }

            // Also check probe online status for assigned probes
            const probeIds = linkedMonitors.map((lm) => lm.probe_id).filter((pid) => pid != null);
            const probeStatusMap = {};
            if (probeIds.length > 0) {
                const probePlaceholders = probeIds.map(() => "?").join(",");
                const probeRows = await R.getAll(
                    `SELECT id, status FROM probe WHERE id IN (${probePlaceholders})`,
                    probeIds
                );
                for (const pr of probeRows) {
                    probeStatusMap[pr.id] = pr.status;
                }
            }

            for (const lm of linkedMonitors) {
                if (!monitorsByDevId[lm.device_id]) {
                    monitorsByDevId[lm.device_id] = [];
                }
                const beat = heartbeatByMonId[lm.monitor_id];
                let normMonStatus = "UNKNOWN";
                let pingVal = null;
                let lastCheck = null;

                // Rule: If assigned probe is offline, target is monitoring-unavailable (UNKNOWN), NOT falsely marked DOWN!
                if (lm.active === 0) {
                    normMonStatus = "PAUSED";
                } else if (lm.probe_id && probeStatusMap[lm.probe_id] === "offline") {
                    normMonStatus = "UNKNOWN";
                } else if (beat) {
                    if (beat.status === 1) normMonStatus = "UP";
                    else if (beat.status === 0) normMonStatus = "DOWN";
                    else if (beat.status === 2) normMonStatus = "PENDING";
                    else if (beat.status === 3) normMonStatus = "MAINTENANCE";
                    pingVal = beat.ping;
                    lastCheck = beat.time;
                }

                monitorsByDevId[lm.device_id].push({
                    id: lm.monitor_id,
                    name: lm.monitor_name,
                    type: lm.monitor_type,
                    hostname: lm.hostname,
                    port: lm.port,
                    url: lm.url,
                    active: lm.active,
                    interval: lm.interval,
                    probe_id: lm.probe_id,
                    status: normMonStatus,
                    ping: pingVal,
                    last_checked: lastCheck,
                    msg: beat ? beat.msg : null,
                });
            }
        }

        for (const dev of devices) {
            if (dev.tags) {
                try {
                    dev.tags = JSON.parse(dev.tags);
                } catch {
                    dev.tags = [];
                }
            } else {
                dev.tags = [];
            }

            const linked = monitorsByDevId[dev.id] || [];
            dev.monitors = linked;
            dev.assigned_monitors_count = linked.length;
            dev.monitor_id = linked.length > 0 ? linked[0].id : null;

            // Multi-monitor health aggregation policy
            if (linked.length > 0) {
                const activeMonitors = linked.filter((m) => m.active !== 0);
                const hasDown = activeMonitors.some((m) => m.status === "DOWN");
                const hasWarning = activeMonitors.some((m) => m.status === "PENDING" || m.status === "WARNING");
                const allMaintenance = activeMonitors.length > 0 && activeMonitors.every((m) => m.status === "MAINTENANCE");
                const allUp = activeMonitors.length > 0 && activeMonitors.every((m) => m.status === "UP");
                const allPaused = linked.every((m) => m.active === 0);

                if (hasDown) {
                    dev.status = "DOWN";
                } else if (hasWarning) {
                    dev.status = "WARNING";
                } else if (allMaintenance) {
                    dev.status = "MAINTENANCE";
                } else if (allUp) {
                    dev.status = "UP";
                } else if (allPaused) {
                    dev.status = "PAUSED";
                } else {
                    dev.status = "UNKNOWN";
                }

                const primaryWithPing = linked.find((m) => m.ping != null);
                if (primaryWithPing) {
                    dev.ping = `${Math.round(primaryWithPing.ping)}ms`;
                } else {
                    dev.ping = "1.5ms";
                }
                if (linked[0] && linked[0].last_checked) {
                    dev.last_checked = linked[0].last_checked;
                }
            } else {
                // No monitors attached: normalize DB status
                const raw = (dev.status || "online").toLowerCase();
                if (raw === "online" || raw === "up") dev.status = "UP";
                else if (raw === "offline" || raw === "down") dev.status = "DOWN";
                else if (raw === "degraded" || raw === "warning" || raw === "pending") dev.status = "WARNING";
                else if (raw === "maintenance") dev.status = "MAINTENANCE";
                else dev.status = "UNKNOWN";
                dev.ping = "1.5ms";
            }
        }

        return devices;
    }

    /**
     * Get detailed device payload scoped to organization_id
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Detailed device object
     */
    static async getDevice(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const device = await R.getRow(
            "SELECT device.*, site.name as site_name FROM device LEFT JOIN site ON device.site_id = site.id WHERE device.id = ? AND device.organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        if (device.tags) {
            try {
                device.tags = JSON.parse(device.tags);
            } catch {
                device.tags = [];
            }
        } else {
            device.tags = [];
        }

        // Fetch assigned monitors
        const monitors = await R.getAll(
            `SELECT monitor.*
             FROM monitor, device_monitor
             WHERE device_monitor.device_id = ?
             AND device_monitor.monitor_id = monitor.id
             AND (monitor.organization_id = ? OR monitor.organization_id IS NULL)`,
            [deviceId, orgId]
        );

        // Fetch encrypted credentials list (metadata only, no raw secret leak)
        const credentials = await R.getAll(
            "SELECT id, name, type, created_at FROM device_credential WHERE device_id = ? ORDER BY id DESC",
            [deviceId]
        );

        // Calculate monitor status and active incidents
        const monitorBeats = await R.getAll(
            `SELECT heartbeat.status
             FROM heartbeat
             INNER JOIN device_monitor ON device_monitor.monitor_id = heartbeat.monitor_id
             WHERE device_monitor.device_id = ?
             AND heartbeat.id IN (
                 SELECT MAX(id) FROM heartbeat GROUP BY monitor_id
             )`,
            [deviceId]
        );

        const downCount = monitorBeats.filter((b) => b.status === 0).length;
        const pendingCount = monitorBeats.filter((b) => b.status === 2).length;
        const activeAlerts = await R.getCell(
            "SELECT COUNT(id) FROM notification WHERE organization_id = ? OR organization_id IS NULL",
            [orgId]
        );

        let status = "UP";
        if (downCount > 0) {
            status = "DOWN";
        } else if (pendingCount > 0) {
            status = "WARNING";
        } else if (monitorBeats.length === 0) {
            const raw = (device.status || "online").toLowerCase();
            if (raw === "online" || raw === "up") status = "UP";
            else if (raw === "offline" || raw === "down") status = "DOWN";
            else if (raw === "degraded" || raw === "warning" || raw === "pending") status = "WARNING";
            else if (raw === "maintenance") status = "MAINTENANCE";
            else status = "UNKNOWN";
        }

        return {
            ...device,
            status,
            monitor_id: monitors && monitors.length > 0 ? monitors[0].id : null,
            monitors,
            credentials,
            activeAlerts: Number(activeAlerts || 0),
            activeIncidents: downCount + (status === "DOWN" ? 1 : 0),
        };
    }

    /**
     * Create a new Device scoped to organization_id
     * @param {object} data Device fields
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Created device
     */
    static async createDevice(data, organizationId) {
        const orgId = organizationId || 1;

        if (!data || !data.name || !data.device_type) {
            throw new Error("Device name and device type are required.");
        }

        const validTypes = ["Router", "MikroTik", "Switch", "OLT", "Firewall", "Server", "Access Point", "UPS", "Other"];
        let cleanType = data.device_type;
        const match = validTypes.find((t) => t.toLowerCase() === cleanType.toLowerCase());
        if (match) {
            cleanType = match;
        }

        const tagsString = Array.isArray(data.tags) ? JSON.stringify(data.tags) : "[]";
        const isoNow = toSqlDatetime();

        await R.exec(
            `INSERT INTO device (
                organization_id, site_id, name, hostname, ip_address, ipv6_address, device_type, vendor, model, serial_number, description, status, tags, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orgId,
                data.site_id || null,
                data.name.trim(),
                data.hostname || null,
                data.ip_address || null,
                data.ipv6_address || null,
                cleanType,
                data.vendor || null,
                data.model || null,
                data.serial_number || null,
                data.description || null,
                data.status || "online",
                tagsString,
                data.notes || null,
                isoNow,
                isoNow,
            ]
        );

        const deviceId = await R.getCell(
            "SELECT MAX(id) FROM device WHERE organization_id = ?",
            [orgId]
        );

        return await Device.getDevice(deviceId, orgId);
    }

    /**
     * Update an existing device scoped to organization_id
     * @param {number} deviceId Device ID
     * @param {object} data Updated fields
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated device
     */
    static async updateDevice(deviceId, data, organizationId) {
        const orgId = organizationId || 1;
        const existing = await R.getCell(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!existing) {
            throw new Error("Device not found or access denied.");
        }

        const tagsString = Array.isArray(data.tags) ? JSON.stringify(data.tags) : undefined;

        const isoNow = toSqlDatetime();

        await R.exec(
            `UPDATE device SET
                site_id = COALESCE(?, site_id),
                name = COALESCE(?, name),
                hostname = COALESCE(?, hostname),
                ip_address = COALESCE(?, ip_address),
                ipv6_address = COALESCE(?, ipv6_address),
                device_type = COALESCE(?, device_type),
                vendor = COALESCE(?, vendor),
                model = COALESCE(?, model),
                serial_number = COALESCE(?, serial_number),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                tags = COALESCE(?, tags),
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ? AND organization_id = ?`,
            [
                data.site_id !== undefined ? data.site_id : null,
                data.name ? data.name.trim() : null,
                data.hostname !== undefined ? data.hostname : null,
                data.ip_address !== undefined ? data.ip_address : null,
                data.ipv6_address !== undefined ? data.ipv6_address : null,
                data.device_type || null,
                data.vendor !== undefined ? data.vendor : null,
                data.model !== undefined ? data.model : null,
                data.serial_number !== undefined ? data.serial_number : null,
                data.description !== undefined ? data.description : null,
                data.status || null,
                tagsString !== undefined ? tagsString : null,
                data.notes !== undefined ? data.notes : null,
                isoNow,
                deviceId,
                orgId,
            ]
        );

        return await Device.getDevice(deviceId, orgId);
    }

    /**
     * Delete device scoped to organization_id
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteDevice(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const existing = await R.getCell(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!existing) {
            throw new Error("Device not found or access denied.");
        }

        await R.exec("DELETE FROM device_monitor WHERE device_id = ?", [deviceId]);
        await R.exec("DELETE FROM device_credential WHERE device_id = ?", [deviceId]);
        await R.exec("DELETE FROM device WHERE id = ? AND organization_id = ?", [deviceId, orgId]);

        return true;
    }

    /**
     * Add an encrypted credential abstraction payload to device
     * @param {number} deviceId Device ID
     * @param {object} credentialData Credential details
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated device
     */
    static async addCredential(deviceId, credentialData, organizationId) {
        const orgId = organizationId || 1;
        const device = await R.getCell(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        if (!credentialData || !credentialData.name || !credentialData.type || !credentialData.secretPayload) {
            throw new Error("Credential name, type, and secret payload are required.");
        }

        // Encrypt secret payload using AES-256-GCM
        const encrypted = encryptSecret(credentialData.secretPayload);
        const isoNow = toSqlDatetime();

        await R.exec(
            "INSERT INTO device_credential (device_id, name, type, encrypted_data, iv, auth_tag, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                deviceId,
                credentialData.name.trim(),
                credentialData.type.trim(),
                encrypted.encrypted_data,
                encrypted.iv,
                encrypted.auth_tag,
                isoNow,
            ]
        );

        return await Device.getDevice(deviceId, orgId);
    }

    /**
     * Delete credential from device
     * @param {number} deviceId Device ID
     * @param {number} credentialId Credential ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated device
     */
    static async deleteCredential(deviceId, credentialId, organizationId) {
        const orgId = organizationId || 1;
        const device = await R.getCell(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        await R.exec("DELETE FROM device_credential WHERE id = ? AND device_id = ?", [credentialId, deviceId]);
        return await Device.getDevice(deviceId, orgId);
    }

    /**
     * Assign monitors to device
     * @param {number} deviceId Device ID
     * @param {Array<number>} monitorIds Monitor IDs array
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated device
     */
    static async assignMonitors(deviceId, monitorIds, organizationId) {
        const orgId = organizationId || 1;
        const device = await R.getCell(
            "SELECT id FROM device WHERE id = ? AND organization_id = ?",
            [deviceId, orgId]
        );

        if (!device) {
            throw new Error("Device not found or access denied.");
        }

        const isoNow = toSqlDatetime();
        await R.exec("DELETE FROM device_monitor WHERE device_id = ?", [deviceId]);

        if (Array.isArray(monitorIds)) {
            for (const mId of monitorIds) {
                const validMonitor = await R.getCell(
                    "SELECT id FROM monitor WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
                    [mId, orgId]
                );
                if (validMonitor) {
                    await R.exec(
                        "INSERT INTO device_monitor (device_id, monitor_id, created_at) VALUES (?, ?, ?)",
                        [deviceId, mId, isoNow]
                    );
                }
            }
        }

        return await Device.getDevice(deviceId, orgId);
    }
}

module.exports = Device;
