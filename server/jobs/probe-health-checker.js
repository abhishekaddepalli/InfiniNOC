const Probe = require("../model/probe");
const { UptimeKumaServer } = require("../uptime-kuma-server");

/**
 * Periodically evaluate heartbeat freshness across all remote distributed probes.
 * Detects disconnected or timed out probe agents, transitions them to OFFLINE,
 * and creates corresponding alert records in active_alert.
 */
const probeHealthCheckJob = async () => {
    try {
        const io = UptimeKumaServer.getInstance().io;
        await Probe.checkAllProbesHealth(io);
    } catch (e) {
        // Suppress background errors
    }
};

module.exports = { probeHealthCheckJob };
