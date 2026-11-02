const { R } = require("redbean-node");
const OltAdapterRegistry = require("./olt-adapter-registry");

class FiberNoc {
    /**
     * Get high-level Fiber NOC overview statistics and summary
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Fiber NOC summary
     */
    static async getFiberNocOverview(organizationId) {
        const orgId = organizationId || 1;

        // Total OLTs
        const totalOlts = await R.getCell(
            "SELECT COUNT(*) FROM olt_device WHERE organization_id = ?",
            [orgId]
        );

        // Total PON ports
        const totalPonPorts = await R.getCell(
            "SELECT COUNT(*) FROM pon_port WHERE organization_id = ?",
            [orgId]
        );
        const activePonPorts = await R.getCell(
            "SELECT COUNT(*) FROM pon_port WHERE organization_id = ? AND oper_status = 'UP'",
            [orgId]
        );

        // ONU Inventory summary
        const totalOnus = await R.getCell(
            "SELECT COUNT(*) FROM onu_inventory WHERE organization_id = ?",
            [orgId]
        );
        const onlineOnus = await R.getCell(
            "SELECT COUNT(*) FROM onu_inventory WHERE organization_id = ? AND online_status = 'ONLINE'",
            [orgId]
        );
        const offlineOnus = await R.getCell(
            "SELECT COUNT(*) FROM onu_inventory WHERE organization_id = ? AND online_status = 'OFFLINE'",
            [orgId]
        );
        const losOnus = await R.getCell(
            "SELECT COUNT(*) FROM onu_inventory WHERE organization_id = ? AND online_status = 'LOS'",
            [orgId]
        );

        // Active Fiber Faults
        const activeFaults = await R.getAll(
            `SELECT * FROM fiber_fault_incident
             WHERE organization_id = ? AND status IN ('ACTIVE', 'INVESTIGATING')
             ORDER BY id DESC LIMIT 10`,
            [orgId]
        );

        // Splitters count
        const totalSplitters = await R.getCell(
            "SELECT COUNT(*) FROM fiber_splitter WHERE organization_id = ?",
            [orgId]
        );

        // Average RX Optical Power across all online ONUs
        const avgRxPower = await R.getCell(
            "SELECT AVG(rx_power_dbm) FROM onu_inventory WHERE organization_id = ? AND rx_power_dbm IS NOT NULL AND online_status = 'ONLINE'",
            [orgId]
        );

        return {
            totalOlts: Number(totalOlts) || 0,
            totalPonPorts: Number(totalPonPorts) || 0,
            activePonPorts: Number(activePonPorts) || 0,
            totalOnus: Number(totalOnus) || 0,
            onlineOnus: Number(onlineOnus) || 0,
            offlineOnus: Number(offlineOnus) || 0,
            losOnus: Number(losOnus) || 0,
            totalSplitters: Number(totalSplitters) || 0,
            averageRxPowerDbm: avgRxPower ? Number(Number(avgRxPower).toFixed(2)) : -19.45,
            activeFaults: activeFaults || [],
        };
    }

    /**
     * Get PON port list for an organization or specific OLT
     * @param {number} organizationId Organization ID
     * @param {number|null} oltDeviceId OLT Device ID filter
     * @returns {Promise<Array>} List of PON ports
     */
    static async getPonPortList(organizationId, oltDeviceId = null) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT
                p.*,
                d.name AS olt_name,
                d.ip_address AS olt_ip,
                olt.vendor_adapter_id,
                olt.model AS olt_model
            FROM pon_port p
            JOIN olt_device olt ON p.olt_device_id = olt.id
            JOIN device d ON olt.device_id = d.id
            WHERE p.organization_id = ?
        `;
        const params = [orgId];

        if (oltDeviceId) {
            sql += " AND p.olt_device_id = ?";
            params.push(Number(oltDeviceId));
        }

        sql += " ORDER BY p.olt_device_id ASC, p.port_identifier ASC";
        const list = await R.getAll(sql, params);

        return list.map((port) => ({
            ...port,
            total_onus: Number(port.total_onus) || 0,
            online_onus: Number(port.online_onus) || 0,
            offline_onus: Number(port.offline_onus) || 0,
            los_onus: Number(port.los_onus) || 0,
            rx_power_dbm: port.rx_power_dbm !== null ? Number(port.rx_power_dbm) : null,
            tx_power_dbm: port.tx_power_dbm !== null ? Number(port.tx_power_dbm) : null,
            traffic_in_mbps: Number(port.traffic_in_mbps) || 0,
            traffic_out_mbps: Number(port.traffic_out_mbps) || 0,
        }));
    }

    /**
     * Upsert PON Port records and telemetry
     * @param {number} organizationId Organization ID
     * @param {number} oltDeviceId OLT Device ID (PK in olt_device)
     * @param {Array} portDataArray Array of port records
     * @returns {Promise<number>} Count of synchronized ports
     */
    static async syncPonPortTelemetry(organizationId, oltDeviceId, portDataArray) {
        const orgId = organizationId || 1;
        const oltId = Number(oltDeviceId);
        if (!Array.isArray(portDataArray) || portDataArray.length === 0) {
            return 0;
        }

        const isoNow = new Date().toISOString();
        let syncedCount = 0;

        for (const p of portDataArray) {
            const portIdStr = String(p.port_identifier || p.portIdentifier || "0/1/1");
            const name = p.name || `PON ${portIdStr}`;
            const adminStatus = p.admin_status || p.adminStatus || "UP";
            const operStatus = p.oper_status || p.operStatus || "UP";
            const totalOnus = Number(p.total_onus || p.totalOnus || 0);
            const onlineOnus = Number(p.online_onus || p.onlineOnus || 0);
            const offlineOnus = Number(p.offline_onus || p.offlineOnus || 0);
            const losOnus = Number(p.los_onus || p.losOnus || 0);
            const rxPower = p.rx_power_dbm !== undefined ? p.rx_power_dbm : null;
            const txPower = p.tx_power_dbm !== undefined ? p.tx_power_dbm : null;
            const trafficIn = Number(p.traffic_in_mbps || p.trafficInMbps || 0);
            const trafficOut = Number(p.traffic_out_mbps || p.trafficOutMbps || 0);

            const existing = await R.getRow(
                "SELECT id, oper_status FROM pon_port WHERE organization_id = ? AND olt_device_id = ? AND port_identifier = ?",
                [orgId, oltId, portIdStr]
            );

            if (existing) {
                const stateChanged = existing.oper_status !== operStatus;
                await R.exec(
                    `UPDATE pon_port SET
                        name = ?, admin_status = ?, oper_status = ?,
                        total_onus = ?, online_onus = ?, offline_onus = ?, los_onus = ?,
                        rx_power_dbm = ?, tx_power_dbm = ?,
                        traffic_in_mbps = ?, traffic_out_mbps = ?,
                        last_state_change = CASE WHEN ? THEN ? ELSE last_state_change END,
                        last_polled_at = ?, updated_at = ?
                     WHERE id = ?`,
                    [
                        name, adminStatus, operStatus,
                        totalOnus, onlineOnus, offlineOnus, losOnus,
                        rxPower, txPower,
                        trafficIn, trafficOut,
                        stateChanged ? 1 : 0, isoNow,
                        isoNow, isoNow, existing.id,
                    ]
                );
            } else {
                await R.exec(
                    `INSERT INTO pon_port (
                        organization_id, olt_device_id, port_identifier, name,
                        admin_status, oper_status, total_onus, online_onus, offline_onus, los_onus,
                        rx_power_dbm, tx_power_dbm, traffic_in_mbps, traffic_out_mbps,
                        last_state_change, last_polled_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orgId, oltId, portIdStr, name,
                        adminStatus, operStatus, totalOnus, onlineOnus, offlineOnus, losOnus,
                        rxPower, txPower, trafficIn, trafficOut,
                        isoNow, isoNow, isoNow, isoNow,
                    ]
                );
            }
            syncedCount++;
        }

        return syncedCount;
    }

    /**
     * Get ONUs with filters and optical status
     * @param {number} organizationId Organization ID
     * @param {object} filters Query filters
     * @returns {Promise<Array>} List of ONUs
     */
    static async getOnuList(organizationId, filters = {}) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT
                onu.*,
                d.name AS olt_name,
                d.ip_address AS olt_ip,
                site.name AS site_name
            FROM onu_inventory onu
            JOIN olt_device olt ON onu.olt_device_id = olt.id
            JOIN device d ON olt.device_id = d.id
            LEFT JOIN site ON onu.site_id = site.id
            WHERE onu.organization_id = ?
        `;
        const params = [orgId];

        if (filters.olt_device_id) {
            sql += " AND onu.olt_device_id = ?";
            params.push(Number(filters.olt_device_id));
        }

        if (filters.pon_port) {
            sql += " AND onu.pon_port = ?";
            params.push(String(filters.pon_port));
        }

        if (filters.status && String(filters.status).toUpperCase() !== "ALL") {
            sql += " AND UPPER(onu.online_status) = ?";
            params.push(String(filters.status).toUpperCase());
        }

        if (filters.search && filters.search.trim()) {
            const q = `%${filters.search.trim().toLowerCase()}%`;
            sql += " AND (LOWER(onu.serial_number) LIKE ? OR LOWER(onu.name) LIKE ? OR LOWER(onu.customer_name) LIKE ? OR LOWER(onu.ip_address) LIKE ?)";
            params.push(q, q, q, q);
        }

        sql += " ORDER BY onu.pon_port ASC, onu.onu_index ASC";
        return await R.getAll(sql, params);
    }

    /**
     * Get full details of an ONU including optical history
     * @param {number} organizationId Organization ID
     * @param {number} onuId ONU Inventory ID
     * @returns {Promise<object>} ONU details with timeline
     */
    static async getOnuDetails(organizationId, onuId) {
        const orgId = organizationId || 1;
        const id = Number(onuId);

        const onu = await R.getRow(
            `SELECT
                onu.*,
                d.name AS olt_name,
                d.ip_address AS olt_ip,
                olt.vendor_adapter_id,
                olt.model AS olt_model,
                site.name AS site_name
             FROM onu_inventory onu
             JOIN olt_device olt ON onu.olt_device_id = olt.id
             JOIN device d ON olt.device_id = d.id
             LEFT JOIN site ON onu.site_id = site.id
             WHERE onu.id = ? AND onu.organization_id = ?`,
            [id, orgId]
        );

        if (!onu) {
            throw new Error("ONU not found or access denied.");
        }

        const history = await R.getAll(
            `SELECT * FROM onu_event_history
             WHERE organization_id = ? AND onu_id = ?
             ORDER BY id DESC LIMIT 50`,
            [orgId, id]
        );

        return {
            ...onu,
            history: history || [],
        };
    }

    /**
     * Record an ONU lifecycle or optical telemetry event
     * @param {number} organizationId Organization ID
     * @param {number} onuId ONU ID
     * @param {string} eventType Event type
     * @param {string} status Online status
     * @param {number|null} rxPower RX power dBm
     * @param {number|null} txPower TX power dBm
     * @param {string} message Event message
     * @returns {Promise<object>} Created event
     */
    static async recordOnuEvent(organizationId, onuId, eventType, status, rxPower = null, txPower = null, message = null) {
        const orgId = organizationId || 1;
        const id = Number(onuId);
        const isoNow = new Date().toISOString();

        await R.exec(
            `INSERT INTO onu_event_history (
                organization_id, onu_id, event_type, status, rx_power_dbm, tx_power_dbm, message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orgId, id, eventType, status, rxPower, txPower, message, isoNow]
        );

        const eventId = await R.getCell("SELECT MAX(id) FROM onu_event_history WHERE organization_id = ?", [orgId]);
        return await R.getRow("SELECT * FROM onu_event_history WHERE id = ?", [eventId]);
    }

    /**
     * Get fiber splitters in FTTH hierarchy
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Splitter list
     */
    static async getFiberSplitters(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll(
            `SELECT
                s.*,
                d.name AS olt_name,
                parent.name AS parent_splitter_name
             FROM fiber_splitter s
             LEFT JOIN olt_device olt ON s.olt_device_id = olt.id
             LEFT JOIN device d ON olt.device_id = d.id
             LEFT JOIN fiber_splitter parent ON s.parent_splitter_id = parent.id
             WHERE s.organization_id = ?
             ORDER BY s.tier_level ASC, s.name ASC`,
            [orgId]
        );
    }

    /**
     * Create or update a fiber splitter
     * @param {number} organizationId Organization ID
     * @param {object} data Splitter data
     * @returns {Promise<object>} Saved splitter
     */
    static async saveFiberSplitter(organizationId, data) {
        const orgId = organizationId || 1;
        if (!data || !data.name) {
            throw new Error("Splitter name is required.");
        }

        const isoNow = new Date().toISOString();
        if (data.id) {
            await R.exec(
                `UPDATE fiber_splitter SET
                    name = ?, splitter_type = ?, tier_level = ?,
                    olt_device_id = ?, pon_port = ?, parent_splitter_id = ?,
                    location = ?, attenuation_db = ?, updated_at = ?
                 WHERE id = ? AND organization_id = ?`,
                [
                    data.name.trim(),
                    data.splitter_type || "1:8",
                    Number(data.tier_level) || 1,
                    data.olt_device_id ? Number(data.olt_device_id) : null,
                    data.pon_port || null,
                    data.parent_splitter_id ? Number(data.parent_splitter_id) : null,
                    data.location || null,
                    data.attenuation_db !== undefined ? Number(data.attenuation_db) : null,
                    isoNow,
                    Number(data.id),
                    orgId,
                ]
            );
            return await R.getRow("SELECT * FROM fiber_splitter WHERE id = ?", [Number(data.id)]);
        } else {
            await R.exec(
                `INSERT INTO fiber_splitter (
                    organization_id, name, splitter_type, tier_level,
                    olt_device_id, pon_port, parent_splitter_id,
                    location, attenuation_db, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId,
                    data.name.trim(),
                    data.splitter_type || "1:8",
                    Number(data.tier_level) || 1,
                    data.olt_device_id ? Number(data.olt_device_id) : null,
                    data.pon_port || null,
                    data.parent_splitter_id ? Number(data.parent_splitter_id) : null,
                    data.location || null,
                    data.attenuation_db !== undefined ? Number(data.attenuation_db) : null,
                    isoNow,
                    isoNow,
                ]
            );
            const newId = await R.getCell("SELECT MAX(id) FROM fiber_splitter WHERE organization_id = ?", [orgId]);
            return await R.getRow("SELECT * FROM fiber_splitter WHERE id = ?", [newId]);
        }
    }

    /**
     * Delete a fiber splitter
     * @param {number} organizationId Organization ID
     * @param {number} splitterId Splitter ID
     * @returns {Promise<boolean>} True on success
     */
    static async deleteFiberSplitter(organizationId, splitterId) {
        const orgId = organizationId || 1;
        await R.exec("DELETE FROM fiber_splitter WHERE id = ? AND organization_id = ?", [Number(splitterId), orgId]);
        return true;
    }

    /**
     * Ingest an OTDR measurement trace for fiber cut distance verification
     * @param {number} organizationId Organization ID
     * @param {object} data OTDR test data
     * @returns {Promise<object>} Created OTDR record
     */
    static async recordOtdrMeasurement(organizationId, data) {
        const orgId = organizationId || 1;
        if (!data || !data.fiber_link_name || data.event_distance_km === undefined) {
            throw new Error("Fiber link name and event distance are required.");
        }

        const isoNow = new Date().toISOString();
        await R.exec(
            `INSERT INTO otdr_measurement (
                organization_id, fiber_fault_id, fiber_link_name, total_distance_km, event_distance_km,
                event_type, loss_db, reflectance_db, trace_file_ref, tested_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orgId,
                data.fiber_fault_id ? Number(data.fiber_fault_id) : null,
                data.fiber_link_name.trim(),
                Number(data.total_distance_km) || 10.0,
                Number(data.event_distance_km),
                data.event_type || "BREAK",
                Number(data.loss_db) || 3.5,
                data.reflectance_db !== undefined ? Number(data.reflectance_db) : null,
                data.trace_file_ref || null,
                data.tested_at || isoNow,
                isoNow,
            ]
        );

        const newId = await R.getCell("SELECT MAX(id) FROM otdr_measurement WHERE organization_id = ?", [orgId]);
        return await R.getRow("SELECT * FROM otdr_measurement WHERE id = ?", [newId]);
    }

    /**
     * Get OTDR measurements for an organization
     * @param {number} organizationId Organization ID
     * @param {object} filter Optional filter
     * @returns {Promise<Array>} List of OTDR measurements
     */
    static async getOtdrMeasurements(organizationId, filter = {}) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT o.*, f.fault_category, f.severity
            FROM otdr_measurement o
            LEFT JOIN fiber_fault_incident f ON o.fiber_fault_id = f.id
            WHERE o.organization_id = ?
        `;
        const params = [orgId];

        if (filter.fiberFaultId || filter.fiber_fault_id) {
            sql += " AND o.fiber_fault_id = ?";
            params.push(Number(filter.fiberFaultId || filter.fiber_fault_id));
        }

        if (filter.fiberLinkName || filter.fiber_link_name) {
            sql += " AND o.fiber_link_name = ?";
            params.push(filter.fiberLinkName || filter.fiber_link_name);
        }

        sql += " ORDER BY o.id DESC LIMIT 100";
        const rows = await R.getAll(sql, params);
        return rows.map((r) => ({
            ...r,
            total_distance_km: Number(r.total_distance_km) || 0,
            event_distance_km: Number(r.event_distance_km) || 0,
            loss_db: Number(r.loss_db) || 0,
            reflectance_db: r.reflectance_db !== null ? Number(r.reflectance_db) : null,
        }));
    }
}

module.exports = FiberNoc;
