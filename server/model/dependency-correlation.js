const { R } = require("redbean-node");
const Incident = require("./incident");

class DependencyCorrelation {
    /**
     * Add a dependency relationship between parent and child device
     * @param {number} parentDeviceId Upstream Parent Device ID
     * @param {number} childDeviceId Downstream Child Device ID
     * @param {string} dependencyType UPSTREAM, DOWNSTREAM, DEPENDS_ON
     * @param {number} organizationId Organization ID
     * @param {object} extraData Extra link metadata
     * @returns {Promise<object>} Created dependency link
     */
    static async addDependency(parentDeviceId, childDeviceId, dependencyType, organizationId, extraData = {}) {
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
        const linkType = extraData.link_type || extraData.linkType || "FIBER";
        const linkSpeed = extraData.link_speed || extraData.linkSpeed || "1 Gbps";
        const srcIf = extraData.source_interface || extraData.sourceInterface || null;
        const tgtIf = extraData.target_interface || extraData.targetInterface || null;
        const status = extraData.status || "UP";
        const utilPct = Number(extraData.traffic_utilization_pct || extraData.trafficUtilizationPct || 0);
        const latency = Number(extraData.latency_ms || extraData.latencyMs || 0);
        const loss = Number(extraData.packet_loss_pct || extraData.packetLossPct || 0);
        const relSource = extraData.relationship_source || extraData.relationshipSource || "MANUAL";
        const isoNow = new Date().toISOString();

        await R.exec(
            `INSERT INTO device_dependency (
                organization_id, parent_device_id, child_device_id, dependency_type,
                link_type, link_speed, source_interface, target_interface, status,
                traffic_utilization_pct, latency_ms, packet_loss_pct, relationship_source,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, parent_device_id, child_device_id) DO UPDATE SET
                dependency_type = excluded.dependency_type,
                link_type = excluded.link_type,
                link_speed = excluded.link_speed,
                source_interface = excluded.source_interface,
                target_interface = excluded.target_interface,
                status = excluded.status,
                traffic_utilization_pct = excluded.traffic_utilization_pct,
                latency_ms = excluded.latency_ms,
                packet_loss_pct = excluded.packet_loss_pct,
                updated_at = excluded.updated_at`,
            [
                orgId, pId, cId, type,
                linkType, linkSpeed, srcIf, tgtIf, status,
                utilPct, latency, loss, relSource,
                isoNow, isoNow,
            ]
        );

        const depId = await R.getCell(
            "SELECT id FROM device_dependency WHERE organization_id = ? AND parent_device_id = ? AND child_device_id = ?",
            [orgId, pId, cId]
        );

        return await R.getRow("SELECT * FROM device_dependency WHERE id = ?", [depId]);
    }

    /**
     * Update an existing dependency link
     * @param {number} dependencyId Dependency ID
     * @param {object} updateData Data to update
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated dependency
     */
    static async updateDependency(dependencyId, updateData, organizationId) {
        const orgId = organizationId || 1;
        const id = Number(dependencyId);

        const existing = await R.getRow("SELECT * FROM device_dependency WHERE id = ? AND organization_id = ?", [id, orgId]);
        if (!existing) {
            throw new Error("Dependency link not found or access denied.");
        }

        const isoNow = new Date().toISOString();
        const linkType = updateData.link_type || existing.link_type || "FIBER";
        const linkSpeed = updateData.link_speed || existing.link_speed || "1 Gbps";
        const srcIf = updateData.source_interface !== undefined ? updateData.source_interface : existing.source_interface;
        const tgtIf = updateData.target_interface !== undefined ? updateData.target_interface : existing.target_interface;
        const status = updateData.status || existing.status || "UP";
        const depType = updateData.dependency_type || existing.dependency_type || "UPSTREAM";
        const utilPct = updateData.traffic_utilization_pct !== undefined ? Number(updateData.traffic_utilization_pct) : existing.traffic_utilization_pct;
        const latency = updateData.latency_ms !== undefined ? Number(updateData.latency_ms) : existing.latency_ms;
        const loss = updateData.packet_loss_pct !== undefined ? Number(updateData.packet_loss_pct) : existing.packet_loss_pct;

        await R.exec(
            `UPDATE device_dependency SET
                link_type = ?, link_speed = ?, source_interface = ?, target_interface = ?,
                status = ?, dependency_type = ?, traffic_utilization_pct = ?,
                latency_ms = ?, packet_loss_pct = ?, updated_at = ?
             WHERE id = ? AND organization_id = ?`,
            [
                linkType, linkSpeed, srcIf, tgtIf,
                status, depType, utilPct,
                latency, loss, isoNow,
                id, orgId,
            ]
        );

        return await R.getRow("SELECT * FROM device_dependency WHERE id = ?", [id]);
    }

    /**
     * Get all dependencies for an organization in a single query
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of all dependencies with parent & child details
     */
    static async getAllDependencies(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll(
            `SELECT
                dep.*,
                pdev.name AS parent_name,
                pdev.ip_address AS parent_ip,
                pdev.status AS parent_status,
                pdev.device_type AS parent_type,
                cdev.name AS child_name,
                cdev.ip_address AS child_ip,
                cdev.status AS child_status,
                cdev.device_type AS child_type
             FROM device_dependency dep
             JOIN device pdev ON dep.parent_device_id = pdev.id
             JOIN device cdev ON dep.child_device_id = cdev.id
             WHERE dep.organization_id = ?
             ORDER BY dep.id ASC`,
            [orgId]
        );
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

    /**
     * Export complete network topology configuration
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Exported topology object
     */
    static async exportTopology(organizationId) {
        const orgId = organizationId || 1;
        const devices = await R.getAll("SELECT id, name, hostname, ip_address, device_type, status FROM device WHERE organization_id = ?", [orgId]);
        const links = await DependencyCorrelation.getAllDependencies(orgId);
        const splitters = await R.getAll("SELECT * FROM fiber_splitter WHERE organization_id = ?", [orgId]);

        return {
            version: "1.0",
            organizationId: orgId,
            exportedAt: new Date().toISOString(),
            devices: devices || [],
            links: links || [],
            splitters: splitters || [],
        };
    }

    /**
     * Import network topology links and configuration
     * @param {number} organizationId Organization ID
     * @param {object} payload Topology payload
     * @returns {Promise<object>} Import result
     */
    static async importTopology(organizationId, payload) {
        const orgId = organizationId || 1;
        if (!payload || !Array.isArray(payload.links)) {
            throw new Error("Invalid topology payload. 'links' array is required.");
        }

        let importedLinks = 0;
        for (const l of payload.links) {
            try {
                if (l.parent_device_id && l.child_device_id) {
                    await DependencyCorrelation.addDependency(
                        l.parent_device_id,
                        l.child_device_id,
                        l.dependency_type || "UPSTREAM",
                        orgId,
                        {
                            link_type: l.link_type,
                            link_speed: l.link_speed,
                            source_interface: l.source_interface,
                            target_interface: l.target_interface,
                            status: l.status,
                            relationship_source: "IMPORTED",
                        }
                    );
                    importedLinks++;
                }
            } catch (e) {
                // Ignore missing device errors during bulk import
            }
        }

        return {
            importedLinks,
            totalProcessed: payload.links.length,
        };
    }
}

module.exports = DependencyCorrelation;
