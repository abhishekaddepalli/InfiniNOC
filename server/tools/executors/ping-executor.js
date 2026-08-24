const net = require("net");
const { performance } = require("perf_hooks");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Real Ping Diagnostic Executor
 */
class PingExecutor {
    /**
     * Execute Real Ping probe test
     * @param {object} params Parameters
     * @param {string} params.host Host or IP target
     * @param {number} params.count Number of probes (1-10)
     * @param {number} params.timeout Probe timeout ms
     * @throws {Error} If host is invalid or blocked
     * @returns {Promise<object>} Real Ping Result
     */
    static async execute({ host, count = 4, timeout = 2000 }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host or IP address is required.");
        }

        const targetHost = host.trim();
        const probeCount = Math.min(Math.max(parseInt(count || 4, 10), 1), 10);
        const probeTimeout = Math.min(Math.max(parseInt(timeout || 2000, 10), 500), 5000);

        const validation = await SsrfValidator.validateTarget(targetHost);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target host is restricted by security policy.",
                host: targetHost,
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip;
        const probes = [];

        for (let i = 1; i <= probeCount; i++) {
            const probeResult = await this.singleProbe(resolvedIp, 80, probeTimeout);
            probes.push({
                sequence: i,
                ip: resolvedIp,
                bytes: 64,
                timeMs: probeResult.timeMs,
                status: probeResult.status,
            });
        }

        const successfulProbes = probes.filter((p) => p.status === "SUCCESS");
        const lossPercent = Math.round(((probeCount - successfulProbes.length) / probeCount) * 100);

        let minMs = 0;
        let maxMs = 0;
        let avgMs = 0;
        let jitterMs = 0;

        if (successfulProbes.length > 0) {
            const times = successfulProbes.map((p) => p.timeMs);
            minMs = Math.min(...times);
            maxMs = Math.max(...times);
            avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

            if (times.length > 1) {
                let diffSum = 0;
                for (let j = 0; j < times.length - 1; j++) {
                    diffSum += Math.abs(times[j + 1] - times[j]);
                }
                jitterMs = Math.round(diffSum / (times.length - 1));
            }
        }

        return {
            ok: true,
            status: lossPercent === 0 ? "EXCELLENT" : lossPercent < 50 ? "DEGRADED" : "FAILED",
            host: targetHost,
            resolvedIp,
            transmitted: probeCount,
            received: successfulProbes.length,
            lossPercent,
            minMs,
            maxMs,
            avgMs,
            jitterMs,
            probes,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Single probe connection helper
     * @param {string} host IP address
     * @param {number} port Destination port
     * @param {number} timeout Timeout ms
     * @returns {Promise<object>} Probe outcome
     */
    static singleProbe(host, port, timeout) {
        return new Promise((resolve) => {
            const start = performance.now();
            const socket = new net.Socket();

            let timer = setTimeout(() => {
                socket.destroy();
                resolve({ status: "TIMEOUT", timeMs: 0 });
            }, timeout);

            socket.connect(port, host, () => {
                const elapsed = Math.round(performance.now() - start);
                clearTimeout(timer);
                socket.destroy();
                resolve({ status: "SUCCESS", timeMs: Math.max(elapsed, 1) });
            });

            socket.on("error", (err) => {
                const elapsed = Math.round(performance.now() - start);
                clearTimeout(timer);
                socket.destroy();
                if (err.code === "ECONNREFUSED") {
                    resolve({ status: "SUCCESS", timeMs: Math.max(elapsed, 1) });
                } else {
                    resolve({ status: "UNREACHABLE", timeMs: 0 });
                }
            });
        });
    }
}

module.exports = { PingExecutor };
