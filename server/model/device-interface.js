const { R } = require("redbean-node");

class DeviceInterface {
    /**
     * Get all network interfaces for a device
     * @param {number} organizationId Organization ID
     * @param {number} deviceId Device ID
     * @returns {Promise<Array>} List of interfaces
     */
    static async getDeviceInterfaces(organizationId, deviceId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        const list = await R.getAll(
            `SELECT
                dif.*,
                d.name AS device_name,
                d.ip_address AS device_ip
             FROM device_interface dif
             JOIN device d ON dif.device_id = d.id
             WHERE dif.organization_id = ? AND dif.device_id = ?
             ORDER BY dif.interface_index ASC`,
            [orgId, devId]
        );

        return list.map((item) => ({
            ...item,
            interface_index: Number(item.interface_index),
            in_errors: Number(item.in_errors) || 0,
            out_errors: Number(item.out_errors) || 0,
            in_discards: Number(item.in_discards) || 0,
            out_discards: Number(item.out_discards) || 0,
            utilization_pct: Number(item.utilization_pct) || 0,
        }));
    }

    /**
     * Bulk sync/upsert network interfaces collected via SNMP IF-MIB
     * @param {number} organizationId Organization ID
     * @param {number} deviceId Device ID
     * @param {Array} ifList Array of interface metrics
     * @returns {Promise<number>} Count of synced interfaces
     */
    static async syncDeviceInterfaces(organizationId, deviceId, ifList) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);
        if (!Array.isArray(ifList) || ifList.length === 0) {
            return 0;
        }

        const isoNow = new Date().toISOString();
        let synced = 0;

        for (const item of ifList) {
            const ifIndex = Number(item.interface_index || item.ifIndex || 1);
            const name = item.name || item.ifName || `eth${ifIndex}`;
            const alias = item.alias || item.ifAlias || null;
            const adminStatus = item.admin_status || item.ifAdminStatus || "UP";
            const operStatus = item.oper_status || item.ifOperStatus || "UP";
            const speed = item.speed_bps || item.ifSpeed || "1000000000";
            const duplex = item.duplex || "FULL";
            const inOctets = String(item.in_octets || item.ifInOctets || "0");
            const outOctets = String(item.out_octets || item.ifOutOctets || "0");
            const inErrors = Number(item.in_errors || item.ifInErrors || 0);
            const outErrors = Number(item.out_errors || item.ifOutErrors || 0);
            const inDiscards = Number(item.in_discards || item.ifInDiscards || 0);
            const outDiscards = Number(item.out_discards || item.ifOutDiscards || 0);
            const utilPct = Number(item.utilization_pct || item.utilizationPct || 0);

            const existing = await R.getRow(
                "SELECT id, oper_status FROM device_interface WHERE organization_id = ? AND device_id = ? AND interface_index = ?",
                [orgId, devId, ifIndex]
            );

            if (existing) {
                const stateChanged = existing.oper_status !== operStatus;
                await R.exec(
                    `UPDATE device_interface SET
                        name = ?, alias = ?, admin_status = ?, oper_status = ?,
                        speed_bps = ?, duplex = ?, in_octets = ?, out_octets = ?,
                        in_errors = ?, out_errors = ?, in_discards = ?, out_discards = ?,
                        utilization_pct = ?,
                        last_state_change = CASE WHEN ? THEN ? ELSE last_state_change END,
                        last_polled_at = ?, updated_at = ?
                     WHERE id = ?`,
                    [
                        name, alias, adminStatus, operStatus,
                        speed, duplex, inOctets, outOctets,
                        inErrors, outErrors, inDiscards, outDiscards,
                        utilPct,
                        stateChanged ? 1 : 0, isoNow,
                        isoNow, isoNow, existing.id,
                    ]
                );
            } else {
                await R.exec(
                    `INSERT INTO device_interface (
                        organization_id, device_id, interface_index, name, alias,
                        admin_status, oper_status, speed_bps, duplex, in_octets, out_octets,
                        in_errors, out_errors, in_discards, out_discards, utilization_pct,
                        last_state_change, last_polled_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orgId, devId, ifIndex, name, alias,
                        adminStatus, operStatus, speed, duplex, inOctets, outOctets,
                        inErrors, outErrors, inDiscards, outDiscards, utilPct,
                        isoNow, isoNow, isoNow, isoNow,
                    ]
                );
            }
            synced++;
        }

        return synced;
    }

    /**
     * Get details of a single interface including link connections
     * @param {number} organizationId Organization ID
     * @param {number} interfaceId Interface PK
     * @returns {Promise<object>} Interface details
     */
    static async getInterfaceDetails(organizationId, interfaceId) {
        const orgId = organizationId || 1;
        const id = Number(interfaceId);

        const dif = await R.getRow(
            `SELECT
                dif.*,
                d.name AS device_name,
                d.ip_address AS device_ip,
                d.device_type
             FROM device_interface dif
             JOIN device d ON dif.device_id = d.id
             WHERE dif.id = ? AND dif.organization_id = ?`,
            [id, orgId]
        );

        if (!dif) {
            throw new Error("Interface not found or access denied.");
        }

        // Find topology links attached to this interface
        const links = await R.getAll(
            `SELECT
                dep.*,
                pdev.name AS parent_name,
                cdev.name AS child_name
             FROM device_dependency dep
             JOIN device pdev ON dep.parent_device_id = pdev.id
             JOIN device cdev ON dep.child_device_id = cdev.id
             WHERE dep.organization_id = ? AND (
                 (dep.parent_device_id = ? AND dep.source_interface = ?) OR
                 (dep.child_device_id = ? AND dep.target_interface = ?)
             )`,
            [orgId, dif.device_id, dif.name, dif.device_id, dif.name]
        );

        return {
            ...dif,
            links: links || [],
        };
    }
}

module.exports = DeviceInterface;
