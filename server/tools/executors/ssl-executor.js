const tls = require("tls");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Real SSL / TLS Certificate Checker Executor
 */
class SslExecutor {
    /**
     * Execute TLS Certificate Handshake and Expiration Inspection
     * @param {object} params Target parameters
     * @param {string} params.host Target hostname or domain
     * @param {number} params.port Target HTTPS port
     * @throws {Error} If host syntax is invalid or restricted
     * @returns {Promise<object>} SSL Certificate Inspection Result
     */
    static async execute({ host, port = 443 }) {
        if (!host || typeof host !== "string" || !host.trim()) {
            throw new Error("Target host is required.");
        }

        const targetHost = host.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const targetPort = parseInt(port || 443, 10);

        const validation = await SsrfValidator.validateTarget(targetHost);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target host is restricted by security policy.",
                host: targetHost,
                port: targetPort,
                checkedAt: new Date().toISOString(),
            };
        }

        return new Promise((resolve) => {
            const socket = tls.connect(
                {
                    host: targetHost,
                    port: targetPort,
                    servername: targetHost,
                    rejectUnauthorized: false,
                    timeout: 5000,
                },
                () => {
                    const cert = socket.getPeerCertificate(true);
                    socket.end();

                    if (!cert || Object.keys(cert).length === 0) {
                        resolve({
                            ok: false,
                            status: "NO_CERT",
                            error: "No SSL certificate returned by remote server.",
                            host: targetHost,
                            port: targetPort,
                            checkedAt: new Date().toISOString(),
                        });
                        return;
                    }

                    const validFrom = cert.valid_from ? new Date(cert.valid_from).toISOString() : "";
                    const validTo = cert.valid_to ? new Date(cert.valid_to).toISOString() : "";
                    const now = Date.now();
                    const expiry = cert.valid_to ? new Date(cert.valid_to).getTime() : now;
                    const daysRemaining = Math.max(0, Math.floor((expiry - now) / (1000 * 60 * 60 * 24)));

                    const issuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || "Unknown Issuer") : "Unknown Issuer";
                    const subject = cert.subject ? (cert.subject.CN || targetHost) : targetHost;
                    const altNames = cert.subjectaltname ? cert.subjectaltname.split(", ").map((s) => s.replace(/^DNS:/, "")) : [];

                    resolve({
                        ok: true,
                        status: daysRemaining > 30 ? "VALID" : daysRemaining > 0 ? "EXPIRING_SOON" : "EXPIRED",
                        host: targetHost,
                        port: targetPort,
                        subject,
                        issuer,
                        validFrom,
                        validTo,
                        daysRemaining,
                        fingerprint: cert.fingerprint || "",
                        serialNumber: cert.serialNumber || "",
                        subjectAltNames: altNames,
                        authorized: socket.authorized,
                        authorizationError: socket.authorizationError || null,
                        checkedAt: new Date().toISOString(),
                    });
                }
            );

            socket.on("error", (err) => {
                socket.destroy();
                resolve({
                    ok: false,
                    status: "FAILED",
                    error: `TLS Handshake failed: ${err.message}`,
                    host: targetHost,
                    port: targetPort,
                    checkedAt: new Date().toISOString(),
                });
            });

            socket.on("timeout", () => {
                socket.destroy();
                resolve({
                    ok: false,
                    status: "TIMEOUT",
                    error: "TLS Handshake connection timed out.",
                    host: targetHost,
                    port: targetPort,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }
}

module.exports = { SslExecutor };
