const { R } = require("redbean-node");
const { encryptSecret } = require("./credential-crypto");

class Device {
    /**
     * Get all devices scoped to organization_id with optional site or type filtering
     * @param {number} organizationId Organization ID
     * @param {number} siteId Optional site filter
     * @param {string} deviceType Optional device type filter
     * @returns {Promise<Array>} Devices list
     */
    static async getDeviceList(organizationId, siteId, deviceType) {
        const orgId = organizationId || 1;
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

            const monitorCount = await R.getCell(
                "SELECT COUNT(id) FROM device_monitor WHERE device_id = ?",
                [dev.id]
            );
            dev.assigned_monitors_count = Number(monitorCount || 0);
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
        const activeAlerts = await R.getCell(
            "SELECT COUNT(id) FROM notification WHERE organization_id = ? OR organization_id IS NULL",
            [orgId]
        );

        let status = device.status || "online";
        if (downCount > 0) {
            status = "offline";
        }

        return {
            ...device,
            status,
            monitors,
            credentials,
            activeAlerts: Number(activeAlerts || 0),
            activeIncidents: downCount + (status === "offline" ? 1 : 0),
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

        await R.exec(
            `INSERT INTO device (
                organization_id, site_id, name, hostname, ip_address, ipv6_address, device_type, vendor, model, serial_number, description, status, tags, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))`,
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
                updated_at = DATETIME('now')
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

        await R.exec(
            "INSERT INTO device_credential (device_id, name, type, encrypted_data, iv, auth_tag, created_at) VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'))",
            [
                deviceId,
                credentialData.name.trim(),
                credentialData.type.trim(),
                encrypted.encrypted_data,
                encrypted.iv,
                encrypted.auth_tag,
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

        await R.exec("DELETE FROM device_monitor WHERE device_id = ?", [deviceId]);

        if (Array.isArray(monitorIds)) {
            for (const mId of monitorIds) {
                const validMonitor = await R.getCell(
                    "SELECT id FROM monitor WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
                    [mId, orgId]
                );
                if (validMonitor) {
                    await R.exec(
                        "INSERT INTO device_monitor (device_id, monitor_id, created_at) VALUES (?, ?, DATETIME('now'))",
                        [deviceId, mId]
                    );
                }
            }
        }

        return await Device.getDevice(deviceId, orgId);
    }
}

module.exports = Device;
