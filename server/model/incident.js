const { R } = require("redbean-node");

class Incident {
    /**
     * Create a new incident
     * @param {object} data Incident fields
     * @param {number} organizationId Organization ID
     * @param {number} userId Creating User ID
     * @returns {Promise<object>} Created incident
     */
    static async createIncident(data, organizationId, userId) {
        const orgId = organizationId || 1;
        if (!data || !data.title) {
            throw new Error("Incident title is required.");
        }

        const isoNow = new Date().toISOString();
        const failureReason = data.failure_reason || (data.description ? data.description.substring(0, 500) : null);

        await R.exec(
            `INSERT INTO incident (
                organization_id, title, content, description, failure_reason, severity, status, site_id, assigned_user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)`,
            [
                orgId,
                data.title.trim(),
                data.description || data.title.trim(),
                data.description || null,
                failureReason,
                data.severity || "P3",
                data.site_id || null,
                data.assigned_user_id || null,
                isoNow,
                isoNow,
            ]
        );

        const incidentId = await R.getCell(
            "SELECT MAX(id) FROM incident WHERE (organization_id = ? OR organization_id IS NULL)",
            [orgId]
        );

        // Log timeline entry
        await R.exec(
            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'created', ?, ?)",
            [orgId, incidentId, userId || null, `Incident created: ${data.title}`, isoNow]
        );

        // If engineer assigned on creation, log assignment
        if (data.assigned_user_id) {
            await R.exec(
                "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'assigned', ?, ?)",
                [orgId, incidentId, userId || null, `Assigned to user ID #${data.assigned_user_id}`, isoNow]
            );
        }

        // Link entities if provided
        if (data.links && Array.isArray(data.links)) {
            await Incident.linkEntities(incidentId, data.links, orgId);
        }

        return await Incident.getIncidentDetails(incidentId, orgId);
    }

    /**
     * Assign engineer to incident
     * @param {number} incidentId Incident ID
     * @param {number} assignedUserId User ID to assign
     * @param {number} currentUserId Acting User ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated incident
     */
    static async assignEngineer(incidentId, assignedUserId, currentUserId, organizationId) {
        const orgId = organizationId || 1;
        const incident = await R.getRow(
            "SELECT * FROM incident WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [incidentId, orgId]
        );
        if (!incident) {
            throw new Error("Incident not found or access denied.");
        }

        const isoNow = new Date().toISOString();

        await R.exec(
            "UPDATE incident SET assigned_user_id = ?, updated_at = ? WHERE id = ?",
            [assignedUserId, isoNow, incidentId]
        );

        await R.exec(
            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'assigned', ?, ?)",
            [orgId, incidentId, currentUserId || null, `Assigned incident to user ID #${assignedUserId}`, isoNow]
        );

        return await Incident.getIncidentDetails(incidentId, orgId);
    }

    /**
     * Add investigation note to incident timeline
     * @param {number} incidentId Incident ID
     * @param {string} note Note content
     * @param {number} userId Acting User ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Created timeline item
     */
    static async addNote(incidentId, note, userId, organizationId) {
        const orgId = organizationId || 1;
        const incident = await R.getCell(
            "SELECT id FROM incident WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [incidentId, orgId]
        );
        if (!incident) {
            throw new Error("Incident not found or access denied.");
        }
        if (!note || !note.trim()) {
            throw new Error("Note content cannot be empty.");
        }

        const isoNow = new Date().toISOString();

        await R.exec(
            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'investigation_note', ?, ?)",
            [orgId, incidentId, userId || null, note.trim(), isoNow]
        );

        return await R.getRow("SELECT MAX(id) FROM incident_timeline WHERE incident_id = ?", [incidentId]);
    }

    /**
     * Update incident status (OPEN, ACKNOWLEDGED, IN_PROGRESS, MONITORING, RESOLVED, CLOSED)
     * @param {number} incidentId Incident ID
     * @param {string} newStatus Target status
     * @param {number} userId Acting User ID
     * @param {object} extraData Extra details (root_cause, resolution)
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated incident details
     */
    static async updateStatus(incidentId, newStatus, userId, extraData, organizationId) {
        const orgId = organizationId || 1;
        const incident = await R.getRow(
            "SELECT * FROM incident WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [incidentId, orgId]
        );
        if (!incident) {
            throw new Error("Incident not found or access denied.");
        }

        const validStatuses = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "MONITORING", "RESOLVED", "CLOSED"];
        const normalizedStatus = String(newStatus).toUpperCase();
        if (!validStatuses.includes(normalizedStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        const isoNow = new Date().toISOString();
        let ackAt = incident.acknowledged_at;
        let resAt = incident.resolved_at;
        let clsAt = incident.closed_at;

        if (normalizedStatus === "ACKNOWLEDGED" && !ackAt) {
            ackAt = isoNow;
        }
        if (normalizedStatus === "RESOLVED" && !resAt) {
            resAt = isoNow;
            if (!ackAt) {
                ackAt = isoNow;
            }
        }
        if (normalizedStatus === "CLOSED") {
            clsAt = isoNow;
            if (!resAt) {
                resAt = isoNow;
            }
            if (!ackAt) {
                ackAt = isoNow;
            }
        }

        const rootCause = (extraData && extraData.root_cause) || incident.root_cause;
        const resolution = (extraData && extraData.resolution) || incident.resolution;

        await R.exec(
            `UPDATE incident SET
                status = ?, acknowledged_at = ?, resolved_at = ?, closed_at = ?, root_cause = ?, resolution = ?, updated_at = ?
            WHERE id = ?`,
            [normalizedStatus, ackAt, resAt, clsAt, rootCause, resolution, isoNow, incidentId]
        );

        let msg = `Incident status changed to ${normalizedStatus}`;
        if (normalizedStatus === "RESOLVED" && resolution) {
            msg += `. Resolution: ${resolution}`;
        }

        await R.exec(
            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'status_change', ?, ?)",
            [orgId, incidentId, userId || null, msg, isoNow]
        );

        return await Incident.getIncidentDetails(incidentId, orgId);
    }

    /**
     * Reopen a resolved or closed incident
     * @param {number} incidentId Incident ID
     * @param {number} userId Acting User ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Reopened incident
     */
    static async reopenIncident(incidentId, userId, organizationId) {
        const orgId = organizationId || 1;
        const incident = await R.getRow(
            "SELECT * FROM incident WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)",
            [incidentId, orgId]
        );
        if (!incident) {
            throw new Error("Incident not found or access denied.");
        }

        const isoNow = new Date().toISOString();

        await R.exec(
            "UPDATE incident SET status = 'OPEN', resolved_at = NULL, closed_at = NULL, updated_at = ? WHERE id = ?",
            [isoNow, incidentId]
        );

        await R.exec(
            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'reopened', 'Incident reopened', ?)",
            [orgId, incidentId, userId || null, isoNow]
        );

        return await Incident.getIncidentDetails(incidentId, orgId);
    }

    /**
     * Bulk resolve all active open/acknowledged/in_progress incidents for an organization
     * @param {number} userId User performing the action
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Resolved count
     */
    static async resolveAllIncidents(userId, organizationId) {
        const orgId = organizationId || 1;
        const isoNow = new Date().toISOString();

        const activeList = await R.getAll(
            "SELECT id FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED')",
            [orgId]
        );

        for (const inc of activeList) {
            await R.exec(
                "UPDATE incident SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE id = ?",
                [isoNow, isoNow, inc.id]
            );
            await R.exec(
                "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'resolved', 'Bulk resolved via Resolve All', ?)",
                [orgId, inc.id, userId || null, isoNow]
            );
        }

        return { count: activeList.length };
    }

    /**
     * Link entity assets (alert, device, monitor) to incident
     * @param {number} incidentId Incident ID
     * @param {Array} links Links array [{ entity_type, entity_id }]
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Linked entities
     */
    static async linkEntities(incidentId, links, organizationId) {
        const orgId = organizationId || 1;
        if (!links || !Array.isArray(links)) {
            return [];
        }

        const isoNow = new Date().toISOString();
        for (const l of links) {
            if (l.entity_type && l.entity_id) {
                const exists = await R.getCell(
                    "SELECT id FROM incident_entity_link WHERE incident_id = ? AND entity_type = ? AND entity_id = ?",
                    [incidentId, l.entity_type, l.entity_id]
                );
                if (!exists) {
                    await R.exec(
                        "INSERT INTO incident_entity_link (organization_id, incident_id, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?)",
                        [orgId, incidentId, l.entity_type, l.entity_id, isoNow]
                    );
                }
            }
        }

        return await R.getAll("SELECT * FROM incident_entity_link WHERE incident_id = ?", [incidentId]);
    }

    /**
     * Get incident list scoped to organization with enriched monitor and probe information
     * @param {number} organizationId Organization ID
     * @param {object} filters Status / severity filters
     * @returns {Promise<Array>} List of incidents
     */
    static async getIncidents(organizationId, filters) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT
                incident.*,
                site.name AS site_name,
                user.username AS assigned_username,
                mon.id AS monitor_id,
                mon.name AS monitor_name,
                mon.type AS monitor_type,
                mon.url AS monitor_url,
                mon.hostname AS monitor_hostname,
                mon.port AS monitor_port,
                probe.id AS probe_id,
                probe.name AS probe_name
            FROM incident
            LEFT JOIN site ON incident.site_id = site.id
            LEFT JOIN user ON incident.assigned_user_id = user.id
            LEFT JOIN (
                SELECT incident_id, MIN(entity_id) AS first_monitor_id
                FROM incident_entity_link
                WHERE entity_type = 'monitor'
                GROUP BY incident_id
            ) mlink ON incident.id = mlink.incident_id
            LEFT JOIN monitor mon ON mlink.first_monitor_id = mon.id
            LEFT JOIN probe ON mon.probe_id = probe.id
            WHERE (incident.organization_id = ? OR incident.organization_id IS NULL)
        `;
        const params = [orgId];

        if (filters && filters.status && String(filters.status).toUpperCase() !== "ALL") {
            const st = String(filters.status).toUpperCase();
            if (st === "OPEN" || st === "ACTIVE") {
                sql += " AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED')";
            } else {
                sql += " AND UPPER(incident.status) = ?";
                params.push(st);
            }
        }
        if (filters && filters.severity && String(filters.severity).toUpperCase() !== "ALL") {
            sql += " AND UPPER(incident.severity) = ?";
            params.push(String(filters.severity).toUpperCase());
        }

        sql += " ORDER BY incident.id DESC";
        return await R.getAll(sql, params);
    }

    /**
     * Get full details of an incident including timeline & linked assets
     * @param {number} incidentId Incident ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Full incident object
     */
    static async getIncidentDetails(incidentId, organizationId) {
        const orgId = organizationId || 1;
        const incident = await R.getRow(
            `SELECT
                incident.*,
                site.name AS site_name,
                user.username AS assigned_username,
                mon.id AS monitor_id,
                mon.name AS monitor_name,
                mon.type AS monitor_type,
                mon.url AS monitor_url,
                mon.hostname AS monitor_hostname,
                mon.port AS monitor_port,
                probe.id AS probe_id,
                probe.name AS probe_name
            FROM incident
            LEFT JOIN site ON incident.site_id = site.id
            LEFT JOIN user ON incident.assigned_user_id = user.id
            LEFT JOIN (
                SELECT incident_id, MIN(entity_id) AS first_monitor_id
                FROM incident_entity_link
                WHERE entity_type = 'monitor'
                GROUP BY incident_id
            ) mlink ON incident.id = mlink.incident_id
            LEFT JOIN monitor mon ON mlink.first_monitor_id = mon.id
            LEFT JOIN probe ON mon.probe_id = probe.id
            WHERE incident.id = ? AND (incident.organization_id = ? OR incident.organization_id IS NULL)`,
            [incidentId, orgId]
        );

        if (!incident) {
            throw new Error("Incident not found or access denied.");
        }

        const timeline = await R.getAll(
            `SELECT incident_timeline.*, user.username
            FROM incident_timeline
            LEFT JOIN user ON incident_timeline.user_id = user.id
            WHERE incident_timeline.incident_id = ?
            ORDER BY incident_timeline.id ASC`,
            [incidentId]
        );

        const links = await R.getAll(
            "SELECT * FROM incident_entity_link WHERE incident_id = ?",
            [incidentId]
        );

        return {
            ...incident,
            timeline: timeline || [],
            links: links || [],
        };
    }

    /**
     * Compute Incident Dashboard KPI Statistics & MTTR
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Dashboard metrics
     */
    static async getIncidentDashboardStats(organizationId) {
        const orgId = organizationId || 1;

        const activeCount = await R.getCell(
            "SELECT COUNT(*) FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED')",
            [orgId]
        );
        const p1Count = await R.getCell(
            "SELECT COUNT(*) FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND severity = 'P1' AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED')",
            [orgId]
        );
        const p2Count = await R.getCell(
            "SELECT COUNT(*) FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND severity = 'P2' AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED')",
            [orgId]
        );

        // Compute MTTR (Mean Time To Resolve) across resolved/closed incidents
        const resolvedIncidents = await R.getAll(
            "SELECT created_at, resolved_at, closed_at FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND (resolved_at IS NOT NULL OR closed_at IS NOT NULL)",
            [orgId]
        );

        let totalResolveTimeMinutes = 0;
        let count = 0;
        for (const inc of resolvedIncidents) {
            const start = new Date(inc.created_at).getTime();
            const end = new Date(inc.resolved_at || inc.closed_at).getTime();
            if (end > start) {
                totalResolveTimeMinutes += (end - start) / (1000 * 60);
                count++;
            }
        }

        const mttrMinutes = count > 0 ? Math.round(totalResolveTimeMinutes / count) : 0;

        const recentIncidents = await R.getAll(
            `SELECT
                incident.*,
                site.name AS site_name,
                mon.name AS monitor_name,
                mon.type AS monitor_type
            FROM incident
            LEFT JOIN site ON incident.site_id = site.id
            LEFT JOIN (
                SELECT incident_id, MIN(entity_id) AS first_monitor_id
                FROM incident_entity_link
                WHERE entity_type = 'monitor'
                GROUP BY incident_id
            ) mlink ON incident.id = mlink.incident_id
            LEFT JOIN monitor mon ON mlink.first_monitor_id = mon.id
            WHERE (incident.organization_id = ? OR incident.organization_id IS NULL)
            ORDER BY incident.id DESC LIMIT 10`,
            [orgId]
        );

        return {
            activeCount: Number(activeCount) || 0,
            p1Count: Number(p1Count) || 0,
            p2Count: Number(p2Count) || 0,
            mttrMinutes,
            recentIncidents: recentIncidents || [],
        };
    }
}

module.exports = Incident;
