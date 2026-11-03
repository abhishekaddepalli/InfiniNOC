const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Common Network Services Diagnostic Executor
 * Tests standard well-known service ports concurrently on an authorized destination.
 */
class CommonServiceExecutor {
    static get COMMON_SERVICES() {
        return [
            { port: 80, name: "HTTP", protocol: "TCP", description: "HyperText Transfer Protocol (Web)" },
            { port: 443, name: "HTTPS", protocol: "TCP", description: "HTTP Secure (TLS/SSL)" },
            { port: 22, name: "SSH", protocol: "TCP", description: "Secure Shell Remote Access" },
            { port: 21, name: "FTP", protocol: "TCP", description: "File Transfer Protocol" },
            { port: 25, name: "SMTP", protocol: "TCP", description: "Simple Mail Transfer Protocol" },
            { port: 53, name: "DNS", protocol: "TCP", description: "Domain Name System (TCP AXFR/large)" },
            { port: 3389, name: "RDP", protocol: "TCP", description: "Remote Desktop Protocol" },
            { port: 3306, name: "MySQL / MariaDB", protocol: "TCP", description: "Database Server" },
            { port: 5432, name: "PostgreSQL", protocol: "TCP", description: "Database Server" },
            { port: 6379, name: "Redis", protocol: "TCP", description: "In-Memory Data Store" },
        ];
    }

    /**
     * Test common services on target
     * @param {object} params Target parameters
     * @param {string} params.host Target host or IP
     * @param {number} params.timeout Port timeout ms (default 2000)
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} Service audit result
     */
    static async execute({ host, timeout = 2500, probeId = null }) {
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
        const portTimeout = Math.min(Math.max(parseInt(timeout || 2500, 10), 500), 5000);

        const checkPromises = CommonServiceExecutor.COMMON_SERVICES.map(async (svc) => {
            const probe = await CommonServiceExecutor.checkPort(resolvedIp, svc.port, portTimeout);
            return {
                port: svc.port,
                name: svc.name,
                description: svc.description,
                protocol: svc.protocol,
                state: probe.state,
                rttMs: probe.rttMs,
                error: probe.error,
            };
        });

        const services = await Promise.all(checkPromises);
        const openServices = services.filter((s) => s.state === "OPEN");

        return {
            ok: true,
            status: openServices.length > 0 ? "SERVICES_FOUND" : "NO_COMMON_SERVICES_OPEN",
            host: targetHost,
            resolvedIp,
            testedCount: services.length,
            openCount: openServices.length,
            services,
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Probe single TCP port with exact status determination
     */
    static checkPort(ip, port, timeoutMs) {
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
                resolve({ state: "FILTERED", rttMs: timeoutMs, error: "Connection timed out" });
            }, timeoutMs);

            socket.connect(port, ip, () => {
                const rttMs = Date.now() - start;
                cleanup();
                resolve({ state: "OPEN", rttMs, error: null });
            });

            socket.on("error", (err) => {
                const rttMs = Date.now() - start;
                cleanup();
                const isRefused = err.code === "ECONNREFUSED";
                resolve({
                    state: isRefused ? "CLOSED" : "FILTERED",
                    rttMs,
                    error: err.code || err.message,
                });
            });
        });
    }
}

module.exports = { CommonServiceExecutor };
