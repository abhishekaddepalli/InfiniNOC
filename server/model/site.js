const { R } = require("redbean-node");

class Site {
    /**
     * Get all sites scoped to organization_id
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of sites with health summary
     */
    static async getSiteList(organizationId) {
        const orgId = organizationId || 1;
        const sites = await R.getAll(
            "SELECT * FROM site WHERE organization_id = ? ORDER BY id DESC",
            [orgId]
        );

        for (const site of sites) {
            const health = await Site.calculateSiteHealth(site.id, orgId);
            site.health = health;
        }

        return sites;
    }

    /**
     * Get site by ID scoped to organization_id
     * @param {number} siteId Site ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Site object with assigned monitors, devices, and health
     */
    static async getSite(siteId, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getRow(
            "SELECT * FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        // Fetch assigned monitors
        const monitorRows = await R.getAll(
            "SELECT monitor.* FROM monitor, site_monitor WHERE site_monitor.site_id = ? AND site_monitor.monitor_id = monitor.id AND (monitor.organization_id = ? OR monitor.organization_id IS NULL)",
            [siteId, orgId]
        );

        // Fetch assigned devices
        const devices = await R.getAll(
            "SELECT * FROM site_device WHERE site_id = ? ORDER BY id DESC",
            [siteId]
        );

        const health = await Site.calculateSiteHealth(siteId, orgId);

        return {
            ...site,
            monitors: monitorRows,
            devices: devices,
            health: health,
        };
    }

    /**
     * Create a new Site scoped to organization_id
     * @param {object} data Site fields
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Created site object
     */
    static async createSite(data, organizationId) {
        const orgId = organizationId || 1;

        if (!data || !data.name || !data.code) {
            throw new Error("Site name and code are required.");
        }

        const cleanCode = data.code.toUpperCase().trim();
        const existing = await R.getCell(
            "SELECT id FROM site WHERE organization_id = ? AND code = ?",
            [orgId, cleanCode]
        );

        if (existing) {
            throw new Error(`Site code "${cleanCode}" already exists in this organization.`);
        }

        await R.exec(
            `INSERT INTO site (
                organization_id, name, code, description, address, latitude, longitude, timezone, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))`,
            [
                orgId,
                data.name.trim(),
                cleanCode,
                data.description || "",
                data.address || "",
                data.latitude || null,
                data.longitude || null,
                data.timezone || "UTC",
                data.status || "Operational",
            ]
        );

        const siteId = await R.getCell(
            "SELECT id FROM site WHERE organization_id = ? AND code = ?",
            [orgId, cleanCode]
        );

        return await Site.getSite(siteId, orgId);
    }

    /**
     * Update an existing site scoped to organization_id
     * @param {number} siteId Site ID
     * @param {object} data Updated fields
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated site object
     */
    static async updateSite(siteId, data, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getCell(
            "SELECT id FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        const cleanCode = data.code ? data.code.toUpperCase().trim() : undefined;

        if (cleanCode) {
            const existing = await R.getCell(
                "SELECT id FROM site WHERE organization_id = ? AND code = ? AND id != ?",
                [orgId, cleanCode, siteId]
            );
            if (existing) {
                throw new Error(`Site code "${cleanCode}" is already used by another site.`);
            }
        }

        await R.exec(
            `UPDATE site SET
                name = COALESCE(?, name),
                code = COALESCE(?, code),
                description = COALESCE(?, description),
                address = COALESCE(?, address),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                timezone = COALESCE(?, timezone),
                status = COALESCE(?, status),
                updated_at = DATETIME('now')
            WHERE id = ? AND organization_id = ?`,
            [
                data.name ? data.name.trim() : null,
                cleanCode || null,
                data.description !== undefined ? data.description : null,
                data.address !== undefined ? data.address : null,
                data.latitude !== undefined ? data.latitude : null,
                data.longitude !== undefined ? data.longitude : null,
                data.timezone || null,
                data.status || null,
                siteId,
                orgId,
            ]
        );

        return await Site.getSite(siteId, orgId);
    }

    /**
     * Delete site scoped to organization_id
     * @param {number} siteId Site ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteSite(siteId, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getCell(
            "SELECT id FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        await R.exec("DELETE FROM site_monitor WHERE site_id = ?", [siteId]);
        await R.exec("DELETE FROM site_device WHERE site_id = ?", [siteId]);
        await R.exec("DELETE FROM site WHERE id = ? AND organization_id = ?", [siteId, orgId]);

        return true;
    }

    /**
     * Assign monitors to site
     * @param {number} siteId Site ID
     * @param {Array<number>} monitorIds Array of monitor IDs
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated site
     */
    static async assignMonitors(siteId, monitorIds, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getCell(
            "SELECT id FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        await R.exec("DELETE FROM site_monitor WHERE site_id = ?", [siteId]);

        if (Array.isArray(monitorIds)) {
            for (const mId of monitorIds) {
                // Ensure monitor belongs to org
                const validMonitor = await R.getCell(
                    "SELECT id FROM monitor WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
                    [mId, orgId]
                );
                if (validMonitor) {
                    await R.exec(
                        "INSERT INTO site_monitor (site_id, monitor_id, created_at) VALUES (?, ?, DATETIME('now'))",
                        [siteId, mId]
                    );
                }
            }
        }

        return await Site.getSite(siteId, orgId);
    }

    /**
     * Add a device to site
     * @param {number} siteId Site ID
     * @param {object} deviceData Device info
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated site
     */
    static async addDevice(siteId, deviceData, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getCell(
            "SELECT id FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        if (!deviceData || !deviceData.device_name || !deviceData.device_type) {
            throw new Error("Device name and device type are required.");
        }

        await R.exec(
            "INSERT INTO site_device (site_id, device_name, device_type, ip_address, status, created_at) VALUES (?, ?, ?, ?, ?, DATETIME('now'))",
            [
                siteId,
                deviceData.device_name.trim(),
                deviceData.device_type.trim(),
                deviceData.ip_address || null,
                deviceData.status || "online",
            ]
        );

        return await Site.getSite(siteId, orgId);
    }

    /**
     * Remove device from site
     * @param {number} siteId Site ID
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated site
     */
    static async removeDevice(siteId, deviceId, organizationId) {
        const orgId = organizationId || 1;
        const site = await R.getCell(
            "SELECT id FROM site WHERE id = ? AND organization_id = ?",
            [siteId, orgId]
        );

        if (!site) {
            throw new Error("Site not found or access denied.");
        }

        await R.exec("DELETE FROM site_device WHERE id = ? AND site_id = ?", [deviceId, siteId]);
        return await Site.getSite(siteId, orgId);
    }

    /**
     * Calculate aggregate site health metrics
     * @param {number} siteId Site ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Health telemetry summary
     */
    static async calculateSiteHealth(siteId, organizationId) {
        const orgId = organizationId || 1;

        // Assigned devices count & statuses
        const devices = await R.getAll(
            "SELECT status FROM site_device WHERE site_id = ?",
            [siteId]
        );
        const totalDevices = devices.length;
        const onlineDevices = devices.filter((d) => d.status === "online").length;
        const offlineDevices = devices.filter((d) => d.status === "offline").length;

        // Assigned monitors telemetry
        const monitorBeats = await R.getAll(
            `SELECT heartbeat.status
             FROM heartbeat
             INNER JOIN site_monitor ON site_monitor.monitor_id = heartbeat.monitor_id
             WHERE site_monitor.site_id = ?
             AND heartbeat.id IN (
                 SELECT MAX(id) FROM heartbeat GROUP BY monitor_id
             )`,
            [siteId]
        );

        const totalMonitors = monitorBeats.length;
        const downMonitors = monitorBeats.filter((b) => b.status === 0).length;
        const upMonitors = monitorBeats.filter((b) => b.status === 1).length;

        const activeAlerts = await R.getCell(
            "SELECT COUNT(id) FROM notification WHERE organization_id = ? OR organization_id IS NULL",
            [orgId]
        );

        const activeIncidents = downMonitors + offlineDevices;

        let uptime = 100;
        if (totalMonitors > 0) {
            uptime = Math.round((upMonitors / totalMonitors) * 100);
        } else if (totalDevices > 0) {
            uptime = Math.round((onlineDevices / totalDevices) * 100);
        }

        return {
            totalDevices,
            onlineDevices,
            offlineDevices,
            totalMonitors,
            upMonitors,
            downMonitors,
            activeAlerts: Number(activeAlerts || 0),
            activeIncidents,
            uptime,
        };
    }
}

module.exports = Site;
