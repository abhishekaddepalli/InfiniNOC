const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Controlled Port Scanner Diagnostic Executor
 * Strictly rate-limited and concurrency-bounded scanner for authorized targets.
 */
class PortScannerExecutor {
    /**
     * Execute controlled scan of specified port range or list
     * @param {object} params Scan parameters
     * @param {string} params.host Target host or IP
     * @param {string|Array} params.ports Port range (e.g. "80-100") or comma-separated list
     * @param {number} params.timeout Port timeout ms (default 1500)
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} Scan results
     */
    static async execute({ host, ports = "80,443,22,21,25,53,3389,8080", timeout = 1500, probeId = null }) {
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
        const portTimeout = Math.min(Math.max(parseInt(timeout || 1500, 10), 500), 4000);

        // Parse and bound port targets (maximum 50 ports per scan to prevent abuse)
        const targetPorts = PortScannerExecutor.parsePortSpec(ports).slice(0, 50);
        if (targetPorts.length === 0) {
            throw new Error("No valid ports specified to scan.");
        }

        const results = [];
        // Concurrency limiter: scan in batches of 5
        const batchSize = 5;
        for (let i = 0; i < targetPorts.length; i += batchSize) {
            const batch = targetPorts.slice(i, i + batchSize);
            const batchPromises = batch.map((port) => PortScannerExecutor.probePort(resolvedIp, port, portTimeout));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        const openPorts = results.filter((r) => r.state === "OPEN");

        return {
            ok: true,
            status: "COMPLETED",
            host: targetHost,
            resolvedIp,
            scannedCount: results.length,
            openCount: openPorts.length,
            ports: results,
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Parse port range string or comma-separated string into unique integer array
     */
    static parsePortSpec(spec) {
        if (Array.isArray(spec)) {
            return [...new Set(spec.map((p) => parseInt(p, 10)).filter((p) => !isNaN(p) && p >= 1 && p <= 65535))];
        }

        const str = String(spec || "").trim();
        const ports = new Set();

        const parts = str.split(",");
        for (const part of parts) {
            const p = part.trim();
            if (p.includes("-")) {
                const [startStr, endStr] = p.split("-");
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 65535 && end >= start) {
                    const rangeLen = Math.min(end - start + 1, 50);
                    for (let port = start; port < start + rangeLen; port++) {
                        ports.add(port);
                    }
                }
            } else {
                const port = parseInt(p, 10);
                if (!isNaN(port) && port >= 1 && port <= 65535) {
                    ports.add(port);
                }
            }
        }

        return Array.from(ports);
    }

    /**
     * Probe single TCP port with timing and state
     */
    static probePort(ip, port, timeoutMs) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const start = Date.now();
            let timer = null;

            const cleanup = () => {
                if (timer) clearTimeout(timer);
                socket.removeAllListeners();
                socket.destroy();
            };

            timer = setTimeout(() => {
                cleanup();
                resolve({
                    port,
                    protocol: "TCP",
                    state: "FILTERED",
                    rttMs: timeoutMs,
                    service: PortScannerExecutor.lookupServiceName(port),
                });
            }, timeoutMs);

            socket.connect(port, ip, () => {
                const rttMs = Date.now() - start;
                cleanup();
                resolve({
                    port,
                    protocol: "TCP",
                    state: "OPEN",
                    rttMs,
                    service: PortScannerExecutor.lookupServiceName(port),
                });
            });

            socket.on("error", (err) => {
                const rttMs = Date.now() - start;
                cleanup();
                resolve({
                    port,
                    protocol: "TCP",
                    state: err.code === "ECONNREFUSED" ? "CLOSED" : "FILTERED",
                    rttMs,
                    service: PortScannerExecutor.lookupServiceName(port),
                });
            });
        });
    }

    static lookupServiceName(port) {
        const wellKnown = {
            21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
            80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 465: "SMTPS",
            587: "Submission", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL",
            1521: "Oracle", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL",
            6379: "Redis", 8080: "HTTP-Proxy", 8443: "HTTPS-Alt", 9000: "FastCGI",
        };
        return wellKnown[port] || `Port ${port}`;
    }
}

module.exports = { PortScannerExecutor };
