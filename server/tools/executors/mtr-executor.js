const { TracerouteExecutor } = require("./traceroute-executor");
const { PingExecutor } = require("./ping-executor");
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Real MTR / Continuous Path Analysis Diagnostic Executor
 * Discovers network hops, then executes repeated probe cycles to compute sent, received, loss %, best, worst, avg, and standard deviation.
 */
class MtrExecutor {
    /**
     * Execute MTR Path Diagnostic
     * @param {object} params Parameters
     * @param {string} params.host Target host or IP
     * @param {number} params.cycles Number of probe cycles (3-10, default 5)
     * @param {number} params.maxHops Maximum hops (default 15)
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} MTR Diagnostic Result
     */
    static async execute({ host, cycles = 5, maxHops = 15, probeId = null }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host or IP address is required.");
        }

        const targetHost = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const probeCycles = Math.min(Math.max(parseInt(cycles || 5, 10), 2), 10);
        const hopsLimit = Math.min(Math.max(parseInt(maxHops || 15, 10), 1), 20);

        const validation = await SsrfValidator.validateTarget(targetHost);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target host is restricted by security policy.",
                host: targetHost,
                executionLocation: probeId ? `probe:${probeId}` : "central",
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip;
        const startTime = Date.now();

        // 1. Initial path discovery
        const traceResult = await TracerouteExecutor.execute({ host: resolvedIp, maxHops: hopsLimit });
        const discoveredHops = (traceResult && traceResult.hops) ? traceResult.hops : [];

        // 2. Perform probe cycles on each responsive hop (plus destination)
        const hopStats = [];
        for (const h of discoveredHops) {
            if (h.ip === "*" || !h.ip) {
                hopStats.push({
                    hop: h.hop,
                    ip: "???",
                    hostname: "Request timed out",
                    lossPercent: 100,
                    sent: probeCycles,
                    received: 0,
                    bestMs: 0,
                    worstMs: 0,
                    avgMs: 0,
                    stdevMs: 0,
                    status: "TIMEOUT",
                });
                continue;
            }

            // Probe this hop IP with probeCycles
            const pingRes = await PingExecutor.execute({ host: h.ip, count: probeCycles, timeout: 1000 });
            const rtts = (pingRes.probes || []).filter((p) => p.status === "SUCCESS").map((p) => p.timeMs);
            const sent = probeCycles;
            const received = rtts.length;
            const lossPercent = Math.round(((sent - received) / sent) * 100);

            let bestMs = 0;
            let worstMs = 0;
            let avgMs = 0;
            let stdevMs = 0;

            if (rtts.length > 0) {
                bestMs = Math.min(...rtts);
                worstMs = Math.max(...rtts);
                avgMs = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);

                if (rtts.length > 1) {
                    const variance = rtts.reduce((sum, val) => sum + Math.pow(val - avgMs, 2), 0) / rtts.length;
                    stdevMs = Math.round(Math.sqrt(variance) * 10) / 10;
                }
            }

            hopStats.push({
                hop: h.hop,
                ip: h.ip,
                hostname: h.hostname || h.ip,
                lossPercent,
                sent,
                received,
                bestMs,
                worstMs,
                avgMs,
                stdevMs,
                status: lossPercent === 0 ? "OPTIMAL" : lossPercent < 50 ? "DEGRADED" : "HIGH_LOSS",
            });
        }

        const totalDurationMs = Date.now() - startTime;

        return {
            ok: hopStats.length > 0,
            status: "COMPLETED",
            host: targetHost,
            resolvedIp,
            cycles: probeCycles,
            totalHops: hopStats.length,
            hops: hopStats,
            totalDurationMs,
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { MtrExecutor };
