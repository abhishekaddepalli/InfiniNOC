const { spawn } = require("child_process");
const os = require("os");
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Path MTU Discovery & Packet Size Diagnostic Executor
 * Tests packets with Don't Fragment (DF) bit set to determine maximum transmission unit without fragmentation.
 */
class MtuExecutor {
    /**
     * Test path MTU using real DF ping packets
     * @param {object} params Target parameters
     * @param {string} params.host Target host or IP
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} MTU Diagnostic Result
     */
    static async execute({ host, probeId = null }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host or IP address is required.");
        }

        const targetHost = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
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

        // Candidate payload sizes (Payload = MTU - 28 bytes for IP+ICMP header)
        // Standard MTUs: 1500 (payload 1472), 1492 (PPPoE, payload 1464), 1480 (payload 1452),
        // 1450 (payload 1422), 1420 (payload 1392), 1360 (payload 1332), 1280 (IPv6 min, payload 1252)
        const testCandidates = [
            { mtu: 1500, payload: 1472, label: "Standard Ethernet MTU (1500 bytes)" },
            { mtu: 1492, payload: 1464, label: "PPPoE Broadband MTU (1492 bytes)" },
            { mtu: 1480, payload: 1452, label: "IPv6 Tunnel MTU (1480 bytes)" },
            { mtu: 1460, payload: 1432, label: "IPSec VPN MTU (1460 bytes)" },
            { mtu: 1420, payload: 1392, label: "WireGuard / VXLAN MTU (1420 bytes)" },
            { mtu: 1360, payload: 1332, label: "Cloud Overlay MTU (1360 bytes)" },
            { mtu: 1280, payload: 1252, label: "Minimum IPv6 MTU (1280 bytes)" },
        ];

        const testResults = [];
        let highestWorkingMtu = null;

        for (const candidate of testResultsCandidates(testCandidates)) {
            const outcome = await MtuExecutor.testSinglePayload(resolvedIp, candidate.payload, isWin);
            testResults.push({
                mtu: candidate.mtu,
                payloadBytes: candidate.payload,
                label: candidate.label,
                success: outcome.success,
                fragmented: outcome.fragmented,
                rttMs: outcome.rttMs,
                responseMessage: outcome.message,
            });

            if (outcome.success && (!highestWorkingMtu || candidate.mtu > highestWorkingMtu)) {
                highestWorkingMtu = candidate.mtu;
            }
        }

        return {
            ok: testResults.some((r) => r.success),
            status: highestWorkingMtu ? "DISCOVERED" : "UNREACHABLE",
            host: targetHost,
            resolvedIp,
            testedSizes: testResults,
            discoveredPathMtu: highestWorkingMtu || 1500,
            overheadBytes: 28, // IP (20) + ICMP (8)
            explanation: highestWorkingMtu
                ? `Discovered Path MTU is ${highestWorkingMtu} bytes (payload: ${highestWorkingMtu - 28} bytes + 28 bytes header) without fragmentation.`
                : "Unable to confirm Path MTU; target ICMP might be filtered by intermediate firewall.",
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };

        function testResultsCandidates(list) {
            return list;
        }
    }

    /**
     * Test single packet with Don't Fragment (DF) flag
     */
    static testSinglePayload(ip, payloadSize, isWin) {
        return new Promise((resolve) => {
            // Windows: ping -n 1 -w 1500 -l <payload> -f <ip>
            // Linux: ping -c 1 -W 2 -s <payload> -M do <ip>
            const args = isWin
                ? ["-n", "1", "-w", "1500", "-l", String(payloadSize), "-f", ip]
                : ["-c", "1", "-W", "2", "-s", String(payloadSize), "-M", "do", ip];

            let stdout = "";
            let stderr = "";

            const proc = spawn("ping", args, {
                windowsHide: true,
                timeout: 3000,
            });

            proc.stdout.on("data", (d) => { stdout += d.toString(); });
            proc.stderr.on("data", (d) => { stderr += d.toString(); });

            proc.on("error", () => {
                resolve({ success: false, fragmented: false, rttMs: null, message: "Ping spawn error" });
            });

            proc.on("close", () => {
                const out = stdout + " " + stderr;
                if (/needs to be fragmented|fragmentation needed|frag needed/i.test(out)) {
                    resolve({ success: false, fragmented: true, rttMs: null, message: "Packet needs fragmentation (DF flag set)" });
                } else if (/time[<=](\d+)ms/i.test(out) || /time=([\d.]+)\s*ms/i.test(out)) {
                    const match = out.match(/time[<=](\d+)ms/i) || out.match(/time=([\d.]+)\s*ms/i);
                    const rttMs = match ? Math.round(parseFloat(match[1])) : 1;
                    resolve({ success: true, fragmented: false, rttMs, message: "Response received without fragmentation" });
                } else {
                    resolve({ success: false, fragmented: false, rttMs: null, message: "Timed out or no response" });
                }
            });
        });
    }
}

module.exports = { MtuExecutor };
