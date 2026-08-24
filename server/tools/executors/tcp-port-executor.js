const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Real TCP Port Connection Executor
 */
class TcpPortExecutor {
    /**
     * Execute an authentic TCP connection test against a destination host and port
     * @param {object} params Parameter object
     * @param {string} params.host Destination IP or Hostname
     * @param {number} params.port Port number (1-65535)
     * @param {string} params.protocol Protocol (TCP)
     * @param {number} params.timeout Timeout in milliseconds (1000-10000)
     * @returns {Promise<object>} Real Port Test Result
     */
    static async execute({ host, port, protocol = "TCP", timeout = 5000 }) {
        const numPort = parseInt(port, 10);
        if (isNaN(numPort) || numPort < 1 || numPort > 65535) {
            return {
                ok: false,
                status: "INVALID_TARGET",
                message: `Invalid port number '${port}'. Port must be between 1 and 65535.`,
                host,
                port: numPort,
                protocol,
                checkedAt: new Date().toISOString(),
            };
        }

        const safeTimeout = Math.min(Math.max(parseInt(timeout, 10) || 5000, 1000), 10000);

        // Security / SSRF Validation
        const validation = await SsrfValidator.validateTarget(host);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                message: validation.reason || "Target blocked by SSRF security policy.",
                host,
                resolvedIp: validation.ip || "Blocked",
                port: numPort,
                protocol,
                connectTimeMs: null,
                executionSource: "InfiniNOC Security Guard",
                checkedAt: new Date().toISOString(),
            };
        }

        const targetIp = validation.ip;

        return new Promise((resolve) => {
            const socket = new net.Socket();
            const startTime = Date.now();
            let timer = null;

            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                socket.removeAllListeners();
                socket.destroy();
            };

            timer = setTimeout(() => {
                cleanup();
                resolve({
                    ok: false,
                    status: "TIMEOUT",
                    message: `Connection to ${targetIp}:${numPort} timed out after ${safeTimeout}ms.`,
                    host,
                    resolvedIp: targetIp,
                    port: numPort,
                    protocol: "TCP",
                    connectTimeMs: safeTimeout,
                    executionSource: "InfiniNOC Server",
                    checkedAt: new Date().toISOString(),
                });
            }, safeTimeout);

            socket.connect(numPort, targetIp, () => {
                const connectTimeMs = Date.now() - startTime;
                cleanup();
                resolve({
                    ok: true,
                    status: "OPEN",
                    message: `Successfully connected to ${targetIp}:${numPort} in ${connectTimeMs}ms.`,
                    host,
                    resolvedIp: targetIp,
                    port: numPort,
                    protocol: "TCP",
                    connectTimeMs,
                    executionSource: "InfiniNOC Server",
                    checkedAt: new Date().toISOString(),
                });
            });

            socket.on("error", (err) => {
                const connectTimeMs = Date.now() - startTime;
                cleanup();

                let status = "CLOSED";
                let message = `TCP connection refused on ${targetIp}:${numPort}.`;

                if (err.code === "ECONNREFUSED") {
                    status = "CLOSED";
                    message = `Port ${numPort} on ${targetIp} is closed (Connection Refused).`;
                } else if (err.code === "EHOSTUNREACH" || err.code === "ENETUNREACH") {
                    status = "UNREACHABLE";
                    message = `Host or network unreachable: ${err.message}`;
                } else if (err.code === "ETIMEDOUT") {
                    status = "TIMEOUT";
                    message = `Connection attempt timed out.`;
                } else {
                    status = "CLOSED";
                    message = `Connection error: ${err.message}`;
                }

                resolve({
                    ok: false,
                    status,
                    message,
                    errorCode: err.code || "ERR_TCP_FAILED",
                    host,
                    resolvedIp: targetIp,
                    port: numPort,
                    protocol: "TCP",
                    connectTimeMs,
                    executionSource: "InfiniNOC Server",
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }
}

module.exports = { TcpPortExecutor };
