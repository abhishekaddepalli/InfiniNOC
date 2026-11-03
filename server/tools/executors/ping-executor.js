const { spawn } = require("child_process");
const os = require("os");
const dns = require("dns").promises;
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Real ICMP Ping Diagnostic Executor
 * Uses native system ping to execute authentic ICMP probes with configurable packet size, count, and timeout.
 */
class PingExecutor {
    /**
     * Execute Real ICMP Ping probe test
     * @param {object} params Parameters
     * @param {string} params.host Host or IP target
     * @param {number} params.count Number of probes (1-10)
     * @param {number} params.timeout Probe timeout ms (500-5000)
     * @param {number} params.packetSize Packet payload bytes (32-1472)
     * @param {number} params.probeId Optional remote probe ID
     * @returns {Promise<object>} Real Ping Result
     */
    static async execute({ host, count = 4, timeout = 2000, packetSize = 32, probeId = null }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host or IP address is required.");
        }

        const targetHost = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const probeCount = Math.min(Math.max(parseInt(count || 4, 10), 1), 10);
        const probeTimeout = Math.min(Math.max(parseInt(timeout || 2000, 10), 500), 5000);
        const payloadSize = Math.min(Math.max(parseInt(packetSize || 32, 10), 32), 1472);

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
        const isWin = os.platform() === "win32";

        const startTime = Date.now();
        const args = isWin
            ? ["-n", String(probeCount), "-w", String(probeTimeout), "-l", String(payloadSize), resolvedIp]
            : ["-c", String(probeCount), "-W", String(Math.max(1, Math.round(probeTimeout / 1000))), "-s", String(payloadSize), resolvedIp];

        return new Promise((resolve) => {
            let stdout = "";
            let stderr = "";

            const proc = spawn("ping", args, {
                windowsHide: true,
                timeout: (probeCount * probeTimeout) + 4000,
            });

            proc.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });

            proc.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            proc.on("error", (err) => {
                log.error("ping-executor", `Ping process spawn error: ${err.message}`);
                resolve({
                    ok: false,
                    status: "EXECUTION_ERROR",
                    error: `System ping failed: ${err.message}`,
                    host: targetHost,
                    resolvedIp,
                    executionLocation: probeId ? `probe:${probeId}` : "central",
                    checkedAt: new Date().toISOString(),
                });
            });

            proc.on("close", (exitCode) => {
                const totalDurationMs = Date.now() - startTime;
                const parsed = PingExecutor.parsePingOutput(stdout, isWin, probeCount, payloadSize, resolvedIp);

                resolve({
                    ok: parsed.received > 0,
                    status: parsed.lossPercent === 0 ? "EXCELLENT" : parsed.lossPercent < 50 ? "DEGRADED" : "FAILED",
                    host: targetHost,
                    resolvedIp,
                    transmitted: parsed.transmitted,
                    received: parsed.received,
                    lossPercent: parsed.lossPercent,
                    minMs: parsed.minMs,
                    avgMs: parsed.avgMs,
                    maxMs: parsed.maxMs,
                    jitterMs: parsed.jitterMs,
                    packetSize: payloadSize,
                    probes: parsed.probes,
                    totalDurationMs,
                    rawOutput: stdout.trim(),
                    executionLocation: probeId ? `probe:${probeId}` : "central",
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Parse system ping output across Windows and Linux
     */
    static parsePingOutput(raw, isWin, count, payloadSize, targetIp) {
        const probes = [];
        const lines = raw.split(/\r?\n/);
        const rttList = [];

        let seq = 1;
        for (const line of lines) {
            if (isWin) {
                // Reply from 1.1.1.1: bytes=32 time=14ms TTL=57
                // or Reply from 1.1.1.1: bytes=32 time<1ms TTL=57
                const match = line.match(/Reply from ([^:]+): bytes=(\d+)\s+time[<=](\d+)ms\s+TTL=(\d+)/i);
                if (match) {
                    const timeMs = parseInt(match[3], 10);
                    rttList.push(timeMs);
                    probes.push({
                        sequence: seq++,
                        ip: match[1],
                        bytes: parseInt(match[2], 10),
                        timeMs,
                        ttl: parseInt(match[4], 10),
                        status: "SUCCESS",
                    });
                } else if (/Request timed out|Destination host unreachable/i.test(line)) {
                    probes.push({
                        sequence: seq++,
                        ip: targetIp,
                        bytes: payloadSize,
                        timeMs: 0,
                        ttl: null,
                        status: "TIMEOUT",
                    });
                }
            } else {
                // 64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=14.2 ms
                const match = line.match(/(\d+) bytes from ([^:]+): icmp_seq=(\d+)\s+ttl=(\d+)\s+time=([\d.]+)\s*ms/i);
                if (match) {
                    const timeMs = Math.round(parseFloat(match[5]));
                    rttList.push(timeMs);
                    probes.push({
                        sequence: parseInt(match[3], 10),
                        ip: match[2],
                        bytes: parseInt(match[1], 10),
                        timeMs,
                        ttl: parseInt(match[4], 10),
                        status: "SUCCESS",
                    });
                }
            }
        }

        // Fill remaining missing probes up to count if needed
        while (probes.length < count) {
            probes.push({
                sequence: seq++,
                ip: targetIp,
                bytes: payloadSize,
                timeMs: 0,
                ttl: null,
                status: "TIMEOUT",
            });
        }

        const received = rttList.length;
        const transmitted = count;
        const lossPercent = Math.round(((transmitted - received) / transmitted) * 100);

        let minMs = 0;
        let avgMs = 0;
        let maxMs = 0;
        let jitterMs = 0;

        if (rttList.length > 0) {
            minMs = Math.min(...rttList);
            maxMs = Math.max(...rttList);
            avgMs = Math.round(rttList.reduce((a, b) => a + b, 0) / rttList.length);

            if (rttList.length > 1) {
                let diffSum = 0;
                for (let i = 0; i < rttList.length - 1; i++) {
                    diffSum += Math.abs(rttList[i + 1] - rttList[i]);
                }
                jitterMs = Math.round(diffSum / (rttList.length - 1));
            }
        }

        return {
            transmitted,
            received,
            lossPercent,
            minMs,
            avgMs,
            maxMs,
            jitterMs,
            probes,
        };
    }
}

module.exports = { PingExecutor };
