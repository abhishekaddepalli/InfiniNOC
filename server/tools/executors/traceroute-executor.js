const { spawn } = require("child_process");
const os = require("os");
const dns = require("dns").promises;
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Real Network Traceroute Diagnostic Executor
 * Invokes system tracert (Windows) or traceroute (Linux) with safe arguments.
 */
class TracerouteExecutor {
    /**
     * Execute Real Traceroute Diagnostic
     * @param {object} params Target parameters
     * @param {string} params.host Target host or IP
     * @param {number} params.maxHops Max hops (1-30)
     * @param {number} params.timeout Hop timeout in ms (500-3000)
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} Traceroute Result
     */
    static async execute({ host, maxHops = 15, timeout = 1000, probeId = null }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host or IP address is required.");
        }

        const targetHost = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const hopsLimit = Math.min(Math.max(parseInt(maxHops || 15, 10), 1), 30);
        const hopTimeout = Math.min(Math.max(parseInt(timeout || 1000, 10), 500), 3000);

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

        const args = isWin
            ? ["-d", "-h", String(hopsLimit), "-w", String(hopTimeout), resolvedIp]
            : ["-n", "-m", String(hopsLimit), "-w", String(Math.max(1, Math.round(hopTimeout / 1000))), resolvedIp];

        const cmd = isWin ? "tracert" : "traceroute";
        const startTime = Date.now();

        return new Promise((resolve) => {
            let stdout = "";
            let stderr = "";

            const proc = spawn(cmd, args, {
                windowsHide: true,
                timeout: (hopsLimit * hopTimeout * 3) + 10000,
            });

            proc.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });

            proc.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            proc.on("error", (err) => {
                log.error("traceroute-executor", `Process spawn error: ${err.message}`);
                resolve({
                    ok: false,
                    status: "EXECUTION_ERROR",
                    error: `Failed to spawn traceroute: ${err.message}`,
                    host: targetHost,
                    resolvedIp,
                    executionLocation: probeId ? `probe:${probeId}` : "central",
                    checkedAt: new Date().toISOString(),
                });
            });

            proc.on("close", async () => {
                const totalDurationMs = Date.now() - startTime;
                const hops = await TracerouteExecutor.parseHops(stdout, isWin, resolvedIp);
                const reached = hops.some((h) => h.ip === resolvedIp);

                resolve({
                    ok: hops.length > 0,
                    status: reached ? "DESTINATION_REACHED" : "COMPLETED",
                    host: targetHost,
                    resolvedIp,
                    totalHops: hops.length,
                    destinationReached: reached,
                    hops,
                    totalDurationMs,
                    rawOutput: stdout.trim(),
                    executionLocation: probeId ? `probe:${probeId}` : "central",
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Parse raw traceroute text into structured hop items with reverse DNS lookup
     */
    static async parseHops(raw, isWin, targetIp) {
        const hops = [];
        const lines = raw.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || /tracing|over a maximum|traceroute to/i.test(trimmed)) {
                continue;
            }

            // Windows format: "  1     3 ms     2 ms     2 ms  192.168.5.1"
            // or "  4     *        *        *     Request timed out."
            if (isWin) {
                const hopMatch = trimmed.match(/^(\d+)\s+([\s\S]+)$/);
                if (hopMatch) {
                    const hopNum = parseInt(hopMatch[1], 10);
                    const rest = hopMatch[2].trim();

                    if (/request timed out/i.test(rest) || rest.startsWith("* * *")) {
                        hops.push({
                            hop: hopNum,
                            ip: "*",
                            hostname: "Request timed out",
                            rtt1: null,
                            rtt2: null,
                            rtt3: null,
                            avgRtt: null,
                            status: "TIMEOUT",
                        });
                        continue;
                    }

                    // Extract timings and IP
                    const rtts = [];
                    const timeRegex = /([<\d]+)\s*ms/gi;
                    let m;
                    while ((m = timeRegex.exec(rest)) !== null) {
                        const val = m[1].replace("<", "");
                        rtts.push(parseInt(val, 10));
                    }

                    // Last token is usually the IP
                    const tokens = rest.split(/\s+/);
                    const lastToken = tokens[tokens.length - 1];
                    const ip = /^[\d.]+$/.test(lastToken) ? lastToken : (rtts.length > 0 ? targetIp : "*");

                    let hostname = ip;
                    if (ip !== "*") {
                        try {
                            const ptrs = await dns.reverse(ip);
                            if (ptrs && ptrs.length > 0) hostname = ptrs[0];
                        } catch (_) {}
                    }

                    const avgRtt = rtts.length > 0 ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : null;

                    hops.push({
                        hop: hopNum,
                        ip,
                        hostname,
                        rtt1: rtts[0] != null ? rtts[0] : null,
                        rtt2: rtts[1] != null ? rtts[1] : null,
                        rtt3: rtts[2] != null ? rtts[2] : null,
                        avgRtt,
                        status: ip !== "*" ? "SUCCESS" : "TIMEOUT",
                    });
                }
            } else {
                // Linux format: " 1  192.168.1.1  1.234 ms  1.123 ms  1.456 ms"
                const hopMatch = trimmed.match(/^(\d+)\s+([^\s]+)\s+([\s\S]+)$/);
                if (hopMatch) {
                    const hopNum = parseInt(hopMatch[1], 10);
                    const ip = hopMatch[2] === "*" ? "*" : hopMatch[2];
                    const rest = hopMatch[3];

                    const rtts = [];
                    const timeRegex = /([\d.]+)\s*ms/gi;
                    let m;
                    while ((m = timeRegex.exec(rest)) !== null) {
                        rtts.push(Math.round(parseFloat(m[1])));
                    }

                    let hostname = ip;
                    if (ip !== "*") {
                        try {
                            const ptrs = await dns.reverse(ip);
                            if (ptrs && ptrs.length > 0) hostname = ptrs[0];
                        } catch (_) {}
                    }

                    const avgRtt = rtts.length > 0 ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : null;

                    hops.push({
                        hop: hopNum,
                        ip,
                        hostname,
                        rtt1: rtts[0] != null ? rtts[0] : null,
                        rtt2: rtts[1] != null ? rtts[1] : null,
                        rtt3: rtts[2] != null ? rtts[2] : null,
                        avgRtt,
                        status: ip !== "*" ? "SUCCESS" : "TIMEOUT",
                    });
                }
            }
        }

        return hops;
    }
}

module.exports = { TracerouteExecutor };
