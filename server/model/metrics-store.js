const fs = require("fs");
const path = require("path");

class MetricsStore {
    /**
     * Initialize MetricsStore
     */
    constructor() {
        this.store = new Map();
        this.maxBufferLength = 1000;
        this.storageDir = path.join(process.cwd(), "data", "metrics");

        if (!fs.existsSync(this.storageDir)) {
            try {
                fs.mkdirSync(this.storageDir, { recursive: true });
            } catch (e) {
                // Ignore if exists
            }
        }
    }

    /**
     * Ingest a batch of high-frequency SNMP metric samples for a device
     * @param {number} deviceId Device ID
     * @param {object} metrics Metric payload containing uptime, cpu, memory, temperature, interfaces
     * @returns {void}
     */
    ingestMetrics(deviceId, metrics) {
        if (!deviceId || !metrics) {
            return;
        }

        const devId = Number(deviceId);
        if (!this.store.has(devId)) {
            this.store.set(devId, {
                cpu: [],
                memory: [],
                temperature: [],
                uptime: null,
                lastSeen: new Date().toISOString(),
                interfaces: {},
            });
        }

        const devData = this.store.get(devId);
        const timestamp = metrics.timestamp || new Date().toISOString();

        if (metrics.uptime !== undefined) {
            devData.uptime = metrics.uptime;
        }
        devData.lastSeen = timestamp;

        if (metrics.cpu !== undefined && metrics.cpu !== null) {
            devData.cpu.push({ timestamp, value: Number(metrics.cpu) });
            if (devData.cpu.length > this.maxBufferLength) {
                devData.cpu.shift();
            }
        }

        if (metrics.memory !== undefined && metrics.memory !== null) {
            devData.memory.push({ timestamp, value: Number(metrics.memory) });
            if (devData.memory.length > this.maxBufferLength) {
                devData.memory.shift();
            }
        }

        if (metrics.temperature !== undefined && metrics.temperature !== null) {
            devData.temperature.push({ timestamp, value: Number(metrics.temperature) });
            if (devData.temperature.length > this.maxBufferLength) {
                devData.temperature.shift();
            }
        }

        if (metrics.interfaces && Array.isArray(metrics.interfaces)) {
            for (const iface of metrics.interfaces) {
                const ifName = iface.name || `if_${iface.index || 1}`;
                if (!devData.interfaces[ifName]) {
                    devData.interfaces[ifName] = {
                        index: iface.index,
                        name: ifName,
                        status: iface.status || "up",
                        trafficIn: [],
                        trafficOut: [],
                        errors: [],
                        packets: [],
                    };
                }

                const targetIface = devData.interfaces[ifName];
                targetIface.status = iface.status || targetIface.status;

                if (iface.inBps !== undefined) {
                    targetIface.trafficIn.push({ timestamp, value: Number(iface.inBps) });
                    if (targetIface.trafficIn.length > this.maxBufferLength) {
                        targetIface.trafficIn.shift();
                    }
                }

                if (iface.outBps !== undefined) {
                    targetIface.trafficOut.push({ timestamp, value: Number(iface.outBps) });
                    if (targetIface.trafficOut.length > this.maxBufferLength) {
                        targetIface.trafficOut.shift();
                    }
                }

                if (iface.errors !== undefined) {
                    targetIface.errors.push({ timestamp, value: Number(iface.errors) });
                    if (targetIface.errors.length > this.maxBufferLength) {
                        targetIface.errors.shift();
                    }
                }

                if (iface.packets !== undefined) {
                    targetIface.packets.push({ timestamp, value: Number(iface.packets) });
                    if (targetIface.packets.length > this.maxBufferLength) {
                        targetIface.packets.shift();
                    }
                }
            }
        }
    }

    /**
     * Query metrics for a device
     * @param {number} deviceId Device ID
     * @returns {object} Device metrics summary and time-series arrays
     */
    getDeviceMetrics(deviceId) {
        const devId = Number(deviceId);
        if (!this.store.has(devId)) {
            return {
                deviceId: devId,
                uptime: null,
                lastSeen: null,
                cpu: [],
                memory: [],
                temperature: [],
                interfaces: {},
            };
        }
        return { deviceId: devId, ...this.store.get(devId) };
    }

    /**
     * Ingest metric sample with tenant verification
     * @param {number} deviceId Device ID
     * @param {object} metrics Metric payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success
     */
    async ingestMetricSample(deviceId, metrics, organizationId) {
        const { R } = require("redbean-node");
        const orgId = organizationId || 1;
        const devExists = await R.getCell("SELECT id FROM device WHERE id = ? AND organization_id = ?", [Number(deviceId), orgId]);
        if (!devExists) {
            throw new Error("Device not found or access denied.");
        }
        this.ingestMetrics(deviceId, metrics);
        return true;
    }

    /**
     * Get latest metrics with tenant verification
     * @param {number} deviceId Device ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Metrics summary
     */
    async getLatestDeviceMetrics(deviceId, organizationId) {
        const { R } = require("redbean-node");
        const orgId = organizationId || 1;
        const devExists = await R.getCell("SELECT id FROM device WHERE id = ? AND organization_id = ?", [Number(deviceId), orgId]);
        if (!devExists) {
            throw new Error("Device not found or access denied.");
        }
        return this.getDeviceMetrics(deviceId);
    }

    /**
     * Clear metrics store
     * @returns {void}
     */
    clear() {
        this.store.clear();
    }
}

const metricsStore = new MetricsStore();
module.exports = metricsStore;
