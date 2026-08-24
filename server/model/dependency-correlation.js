const { R } = require("redbean-node");
const Incident = require("./incident");

class DependencyCorrelation {
    /**
     * Add a dependency relationship between parent and child device
     * @param {number} parentDeviceId Upstream Parent Device ID
     * @param {number} childDeviceId Downstream Child Device ID
     * @param {string} dependencyType UPSTREAM, DOWNSTREAM, DEPENDS_ON
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Created dependency link
     */
    static async addDependency(parentDeviceId, childDeviceId, dependencyType, organizationId) {
        const orgId = organizationId || 1;
        const pId = Number(parentDeviceId);
        const cId = Number(childDeviceId);

        if (pId === cId) {
            throw new Error("A device cannot depend on itself.");
        }

        // Verify devices exist in org
        const parentExists = await R.getCell("SELECT id FROM device WHERE id = ? AND organization_id = ?", [pId, orgId]);
        const childExists = await R.getCell("SELECT id FROM device WHERE id = ? AND organization_id = ?", [cId, orgId]);

        if (!parentExists || !childExists) {
            throw new Error("Parent or child device not found in organization.");
        }

        const type = dependencyType || "UPSTREAM";
        const isoNow = new Date().toISOString();

        await R.exec(
            `INSERT INTO device_dependency (
                organization_id, parent_device_id, child_device_id, dependency_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, parent_device_id, child_device_id) DO UPDATE SET dependency_type = excluded.dependency_type, updated_at = excluded.updated_at`,
            [orgId, pId, cId, type, isoNow, isoNow]
        );

        const depId = await R.getCell(
            "SELECT id FROM device_dependency WHERE organization_id = ? AND parent_device_id = ? AND child_device_id = ?",
            [orgId, pId, cId]
        );

        return await R.getRow("SELECT * FROM device_dependency WHERE id = ?", [depId]);
    }

    /**
     * Delete a dependency link
     * @param {number} dependencyId Dependency ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteDependency(dependencyId, organizationId) {
        const orgId = organizationId || 1;
        const exists = await R.getCell("SELECT id FROM device_dependency WHERE id = ? AND organization_id = ?", [dependencyId, orgId]);
        if (!exists) {
            throw new Error("Dependency link not found or access denied.");
        }

        await R.exec("DELETE FROM device_dependency WHERE id = ? AND organization_id = ?", [dependencyId, orgId]);
        return true;
    }

    /**
     * Get all dependencies for a device (both as parent and child)
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Object with parents and children arrays
     */
    static async getDeviceDependencies(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        const parents = await R.getAll(
            `SELECT device_dependency.*, device.name as parent_name, device.ip_address as parent_ip
            FROM device_dependency
            JOIN device ON device_dependency.parent_device_id = device.id
            WHERE device_dependency.child_device_id = ? AND device_dependency.organization_id = ?`,
            [devId, orgId]
        );

        const children = await R.getAll(
            `SELECT device_dependency.*, device.name as child_name, device.ip_address as child_ip
            FROM device_dependency
            JOIN device ON device_dependency.child_device_id = device.id
            WHERE device_dependency.parent_device_id = ? AND device_dependency.organization_id = ?`,
            [devId, orgId]
        );

        return {
            parents: parents || [],
            children: children || [],
        };
    }

    /**
     * Perform BFS traversal to discover all downstream child devices, sites, and monitors
     * @param {number} rootDeviceId Root Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Tree metrics object
     */
    static async getDownstreamTree(rootDeviceId, organizationId) {
        const orgId = organizationId || 1;
        const rootId = Number(rootDeviceId);

        const deviceIdsSet = new Set([rootId]);
        const queue = [rootId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const childRows = await R.getAll(
                "SELECT child_device_id FROM device_dependency WHERE parent_device_id = ? AND organization_id = ?",
                [currentId, orgId]
            );

            for (const row of childRows) {
                const childId = Number(row.child_device_id);
                if (!deviceIdsSet.has(childId)) {
                    deviceIdsSet.add(childId);
                    queue.push(childId);
                }
            }
        }

        const allDeviceIds = Array.from(deviceIdsSet);

        // Fetch sites for all devices in set
        const placeholders = allDeviceIds.map(() => "?").join(",");
        const siteRows = await R.getAll(
            `SELECT DISTINCT site_id FROM device WHERE id IN (${placeholders}) AND site_id IS NOT NULL AND organization_id = ?`,
            [...allDeviceIds, orgId]
        );

        // Fetch linked monitors for all devices in set
        const monitorRows = await R.getAll(
            `SELECT DISTINCT monitor_id FROM device_monitor WHERE device_id IN (${placeholders})`,
            allDeviceIds
        );

        return {
            deviceIds: allDeviceIds,
            affectedDevicesCount: allDeviceIds.length,
            affectedSitesCount: Math.max(1, siteRows.length),
            affectedMonitorsCount: monitorRows.length,
        };
    }

    /**
     * Find if any upstream parent device currently has an ACTIVE P1 incident
     * @param {number} deviceId Failing device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object|null>} Parent incident or null
     */
    static async findActiveUpstreamRootIncident(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        // Crawl upstream parent devices
        const parentRows = await R.getAll(
            "SELECT parent_device_id FROM device_dependency WHERE child_device_id = ? AND organization_id = ?",
            [devId, orgId]
        );

        for (const pRow of parentRows) {
            const parentId = Number(pRow.parent_device_id);

            // Check if parent device itself has an active incident where root_device_id = parentId
            const activeIncident = await R.getRow(
                "SELECT * FROM incident WHERE root_device_id = ? AND organization_id = ? AND status NOT IN ('RESOLVED', 'CLOSED')",
                [parentId, orgId]
            );

            if (activeIncident) {
                return activeIncident;
            }

            // Recurse up the chain
            const higherUpIncident = await DependencyCorrelation.findActiveUpstreamRootIncident(parentId, orgId);
            if (higherUpIncident) {
                return higherUpIncident;
            }
        }

        return null;
    }

    /**
     * Process a device failure event and execute conservative alert storm correlation
     * @param {number} failingDeviceId Failing device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Result object with incident & correlation info
     */
    static async processDeviceFailure(failingDeviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(failingDeviceId);

        const failingDevice = await R.getRow("SELECT * FROM device WHERE id = ? AND organization_id = ?", [devId, orgId]);
        if (!failingDevice) {
            throw new Error("Device not found or access denied.");
        }

        // 1. Check if an active upstream root incident exists
        const upstreamIncident = await DependencyCorrelation.findActiveUpstreamRootIncident(devId, orgId);

        if (upstreamIncident) {
            // CORRELATE: Do NOT create a new incident. Link to existing upstream root incident.
            await Incident.linkEntities(upstreamIncident.id, [{ entity_type: "device", entity_id: devId }], orgId);

            // Update impact stats for root incident
            const rootTree = await DependencyCorrelation.getDownstreamTree(upstreamIncident.root_device_id, orgId);
            let estImpact = "Medium";
            if (rootTree.affectedDevicesCount > 100) {
                estImpact = "Critical";
            } else if (rootTree.affectedDevicesCount > 20) {
                estImpact = "High";
            }

            const isoNow = new Date().toISOString();
            await R.exec(
                `UPDATE incident SET
                    affected_devices_count = ?, affected_sites_count = ?, affected_monitors_count = ?, estimated_impact = ?, updated_at = ?
                WHERE id = ?`,
                [rootTree.affectedDevicesCount, rootTree.affectedSitesCount, rootTree.affectedMonitorsCount, estImpact, isoNow, upstreamIncident.id]
            );

            // Log timeline note
            await Incident.addNote(
                upstreamIncident.id,
                `[CORRELATED DOWNSTREAM FAILURE] Device #${devId} (${failingDevice.name}) failed due to upstream root outage`,
                null,
                orgId
            );

            const updatedInc = await Incident.getIncidentDetails(upstreamIncident.id, orgId);
            return {
                correlated: true,
                suppressedNewIncident: true,
                rootIncident: updatedInc,
                message: `Alert storm suppressed: Correlated device ${failingDevice.name} under active Root Incident #${upstreamIncident.id}`,
            };
        }

        // 2. NO upstream parent is down -> This device IS the Root Failure!
        const tree = await DependencyCorrelation.getDownstreamTree(devId, orgId);
        let estImpact = "Medium";
        if (tree.affectedDevicesCount > 100) {
            estImpact = "Critical";
        } else if (tree.affectedDevicesCount > 20) {
            estImpact = "High";
        }

        const newInc = await Incident.createIncident(
            {
                title: `[ROOT FAILURE] ${failingDevice.name} (${failingDevice.ip_address}) unavailable`,
                description: `Root outage detected on device ${failingDevice.name}. Cascading downstream failure risk across ${tree.affectedDevicesCount} devices.`,
                severity: "P1",
                site_id: failingDevice.site_id || null,
                links: [{ entity_type: "device", entity_id: devId }],
            },
            orgId,
            null
        );

        // Update root_device_id and impact counts
        const isoNow = new Date().toISOString();
        await R.exec(
            `UPDATE incident SET
                root_device_id = ?, affected_devices_count = ?, affected_sites_count = ?, affected_monitors_count = ?, estimated_impact = ?, updated_at = ?
            WHERE id = ?`,
            [devId, tree.affectedDevicesCount, tree.affectedSitesCount, tree.affectedMonitorsCount, estImpact, isoNow, newInc.id]
        );

        const updatedInc = await Incident.getIncidentDetails(newInc.id, orgId);
        return {
            correlated: false,
            createdRootIncident: true,
            incident: updatedInc,
            impact: {
                rootDevice: failingDevice.name,
                affectedDevices: tree.affectedDevicesCount,
                affectedSites: tree.affectedSitesCount,
                affectedMonitors: tree.affectedMonitorsCount,
                estimatedImpact: estImpact,
            },
        };
    }

    /**
     * Process device recovery event
     * @param {number} recoveredDeviceId Recovered Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Result
     */
    static async processDeviceRecovery(recoveredDeviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(recoveredDeviceId);

        const activeIncident = await R.getRow(
            "SELECT * FROM incident WHERE root_device_id = ? AND organization_id = ? AND status NOT IN ('RESOLVED', 'CLOSED')",
            [devId, orgId]
        );

        if (activeIncident) {
            const updated = await Incident.updateStatus(
                activeIncident.id,
                "RESOLVED",
                null,
                { root_cause: "Root device operational", resolution: `Root device #${devId} recovered and telemetry restored.` },
                orgId
            );
            return { resolvedRootIncident: true, incident: updated };
        }

        return { resolvedRootIncident: false };
    }
}

module.exports = DependencyCorrelation;
