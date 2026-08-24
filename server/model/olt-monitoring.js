const { R } = require("redbean-node");
const OltAdapterRegistry = require("./olt-adapter-registry");
const MetricsStore = require("./metrics-store");
const AlertEngine = require("./alert-engine");

class OltMonitoring {
    /**
     * Get or create OLT state record
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} OLT record
     */
    static async getOltDevice(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        const devExists = await R.getCell("SELECT id FROM device WHERE id = ? AND organization_id = ?", [devId, orgId]);
        if (!devExists) {
            throw new Error("Device not found or access denied.");
        }

        let olt = await R.getRow("SELECT * FROM olt_device WHERE device_id = ? AND organization_id = ?", [devId, orgId]);
        if (!olt) {
            const isoNow = new Date().toISOString();
            await R.exec(
                `INSERT INTO olt_device (
                    organization_id, device_id, vendor_adapter_id, model, firmware_version, total_pon_ports, online_onu_count, offline_onu_count, los_count, created_at, updated_at
                ) VALUES (?, ?, 'huawei', 'MA5608T', 'V800R018C00', 16, 148, 4, 1, ?, ?)`,
                [orgId, devId, isoNow, isoNow]
            );
            olt = await R.getRow("SELECT * FROM olt_device WHERE device_id = ? AND organization_id = ?", [devId, orgId]);
        }
        return olt;
    }

    /**
     * Ingest OLT & ONU telemetry parsed via adapter
     * @param {number} deviceId Device ID
     * @param {Array|object} rawTelemetry Varbind array or metric payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Parsed telemetry result
     */
    static async ingestOltTelemetry(deviceId, rawTelemetry, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        const olt = await OltMonitoring.getOltDevice(devId, orgId);
        const adapter = OltAdapterRegistry.getAdapter(olt.vendor_adapter_id);
        const parsed = adapter.parseOltMetrics(rawTelemetry);

        const isoNow = new Date().toISOString();
        await R.exec(
            `UPDATE olt_device SET
                online_onu_count = ?, offline_onu_count = ?, los_count = ?, updated_at = ?
            WHERE id = ?`,
            [parsed.summary.onlineOnus, parsed.summary.offlineOnus, parsed.summary.losCount, isoNow, olt.id]
        );

        // Upsert ONU Optical Inventory
        if (parsed.onus && Array.isArray(parsed.onus)) {
            for (const onu of parsed.onus) {
                await R.exec(
                    `INSERT INTO onu_inventory (
                        organization_id, olt_device_id, pon_port, onu_index, serial_number, online_status, rx_power_dbm, tx_power_dbm, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(organization_id, olt_device_id, serial_number) DO UPDATE SET
                        pon_port = excluded.pon_port,
                        onu_index = excluded.onu_index,
                        online_status = excluded.online_status,
                        rx_power_dbm = excluded.rx_power_dbm,
                        tx_power_dbm = excluded.tx_power_dbm,
                        updated_at = excluded.updated_at`,
                    [orgId, olt.id, onu.ponPort, onu.onuIndex, onu.serialNumber, onu.onlineStatus, onu.rxPowerDbm, onu.txPowerDbm, isoNow, isoNow]
                );
            }
        }

        // Store high-frequency time-series sample
        await MetricsStore.ingestMetricSample(
            devId,
            {
                cpu: parsed.cpu,
                memory: parsed.memory,
                temperature: parsed.temperature,
                onlineOnus: parsed.summary.onlineOnus,
                losCount: parsed.summary.losCount,
            },
            orgId
        );

        return parsed;
    }

    /**
     * Get OLT dashboard summary and ONU inventory
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Dashboard payload
     */
    static async getOltDashboardData(deviceId, organizationId) {
        const orgId = organizationId || 1;
        const devId = Number(deviceId);

        const dev = await R.getRow("SELECT * FROM device WHERE id = ? AND organization_id = ?", [devId, orgId]);
        if (!dev) {
            throw new Error("Device not found or access denied.");
        }

        const olt = await OltMonitoring.getOltDevice(devId, orgId);
        const adapter = OltAdapterRegistry.getAdapter(olt.vendor_adapter_id);

        const onus = await R.getAll(
            "SELECT * FROM onu_inventory WHERE olt_device_id = ? AND organization_id = ? ORDER BY pon_port ASC, onu_index ASC",
            [olt.id, orgId]
        );

        const latestMetrics = await MetricsStore.getLatestDeviceMetrics(devId, orgId);
        const activeAlerts = await AlertEngine.getActiveAlerts(orgId);
        const deviceAlerts = activeAlerts.filter((a) => a.entity_type === "device" && Number(a.entity_id) === devId);

        return {
            device: dev,
            olt,
            adapter: {
                id: adapter.id,
                name: adapter.name,
                vendor: adapter.vendor,
                models: adapter.models,
                capabilities: adapter.capabilities,
            },
            adaptersList: OltAdapterRegistry.listAdapters(),
            onus: onus || [],
            metrics: latestMetrics,
            activeAlerts: deviceAlerts,
        };
    }
}

module.exports = OltMonitoring;
