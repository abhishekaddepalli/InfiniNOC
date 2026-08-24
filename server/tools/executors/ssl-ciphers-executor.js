const tls = require("tls");
const { performance } = require("perf_hooks");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * TLS / SSL Cipher Suite & Protocol Audit Executor
 */
class SslCiphersExecutor {
    /**
     * Audit TLS versions, Cipher Suite, PFS, and Certificate rating
     * @param {object} params Target host & port
     * @returns {Promise<object>} SSL Ciphers audit result
     */
    static async execute(params = {}) {
        const host = params.host || params.target || "google.com";
        const port = parseInt(params.port || 443, 10);

        const validation = await SsrfValidator.validateTarget(host);
        if (!validation.safe) {
            throw new Error(validation.reason || "Target host is restricted by security policy.");
        }

        const resolvedIp = validation.ip;
        const start = performance.now();

        return new Promise((resolve, reject) => {
            const options = {
                host,
                port,
                servername: host,
                rejectUnauthorized: false,
            };

            const socket = tls.connect(options, () => {
                const elapsed = Math.round(performance.now() - start);
                const cert = socket.getPeerCertificate(true);
                const cipher = socket.getCipher();
                const protocol = socket.getProtocol();

                let isPfs = false;
                if (cipher && cipher.name) {
                    isPfs = cipher.name.includes("ECDHE") || cipher.name.includes("DHE") || cipher.name.includes("CHACHA20");
                }

                // Compute Security Rating Grade
                let rating = "A+";
                if (protocol === "TLSv1.1" || protocol === "TLSv1") {
                    rating = "C";
                } else if (!isPfs) {
                    rating = "B";
                }

                const daysRemaining = cert && cert.valid_to ? Math.round((new Date(cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                if (daysRemaining < 0) {
                    rating = "F (Expired Certificate)";
                }

                socket.end();

                resolve({
                    host,
                    port,
                    resolvedIp,
                    rating,
                    protocol,
                    cipherName: cipher ? cipher.name : "Unknown",
                    cipherVersion: cipher ? cipher.version : "Unknown",
                    isPfs,
                    certSubject: cert && cert.subject ? cert.subject.CN : host,
                    certIssuer: cert && cert.issuer ? cert.issuer.O || cert.issuer.CN : "Unknown",
                    validFrom: cert ? cert.valid_from : null,
                    validTo: cert ? cert.valid_to : null,
                    daysRemaining,
                    sans: cert && cert.subjectaltname ? cert.subjectaltname.split(", ").map(s => s.replace("DNS:", "")) : [],
                    durationMs: elapsed,
                    checkedAt: new Date().toISOString(),
                });
            });

            socket.setTimeout(8000, () => {
                socket.destroy();
                reject(new Error(`TLS Handshake timeout after 8000ms connecting to ${host}:${port}`));
            });

            socket.on("error", (err) => {
                reject(new Error(`TLS Handshake connection failed: ${err.message}`));
            });
        });
    }
}

module.exports = { SslCiphersExecutor };
