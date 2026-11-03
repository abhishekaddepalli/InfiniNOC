const crypto = require("crypto");

/**
 * Real SSL / X.509 Certificate Decoder Executor
 * Decodes PEM certificates using Node.js built-in crypto.X509Certificate securely without private key exposure.
 */
class SslDecoderExecutor {
    /**
     * Decode and inspect X.509 PEM certificate
     * @param {object} params Input parameters
     * @param {string} params.certificate PEM formatted certificate string
     * @returns {object} Parsed certificate details
     */
    static execute({ certificate }) {
        if (!certificate || typeof certificate !== "string" || !certificate.trim()) {
            throw new Error("PEM Certificate text is required.");
        }

        let pem = certificate.trim();

        // Safety: Reject any input containing PRIVATE KEY
        if (/PRIVATE KEY/i.test(pem)) {
            return {
                ok: false,
                status: "SECURITY_REJECTED",
                error: "Security Alert: Private keys must never be submitted. Only provide public certificates.",
                checkedAt: new Date().toISOString(),
            };
        }

        // Add standard PEM header/footer if missing
        if (!pem.includes("-----BEGIN CERTIFICATE-----")) {
            pem = `-----BEGIN CERTIFICATE-----\n${pem}\n-----END CERTIFICATE-----`;
        }

        try {
            const x509 = new crypto.X509Certificate(pem);

            const now = Date.now();
            const validFromDate = new Date(x509.validFrom);
            const validToDate = new Date(x509.validTo);
            const expiryTime = validToDate.getTime();
            const daysRemaining = Math.max(0, Math.floor((expiryTime - now) / (1000 * 60 * 60 * 24)));
            const isExpired = expiryTime < now;
            const isNotYetValid = validFromDate.getTime() > now;

            // Extract SANs (Subject Alternative Names)
            const subjectAltName = x509.subjectAltName || "";
            const sanList = subjectAltName ? subjectAltName.split(", ").map((s) => s.replace(/^DNS:/, "")) : [];

            return {
                ok: true,
                status: isExpired ? "EXPIRED" : isNotYetValid ? "NOT_YET_VALID" : (daysRemaining <= 30 ? "EXPIRING_SOON" : "VALID"),
                subject: x509.subject,
                issuer: x509.issuer,
                serialNumber: x509.serialNumber,
                validFrom: validFromDate.toISOString(),
                validTo: validToDate.toISOString(),
                daysRemaining,
                isExpired,
                isNotYetValid,
                fingerprint256: x509.fingerprint256,
                fingerprint512: x509.fingerprint512,
                subjectAltNames: sanList,
                keyUsage: x509.keyUsage || [],
                publicKeyType: x509.publicKey ? x509.publicKey.asymmetricKeyType : "RSA",
                ca: x509.ca,
                checkedAt: new Date().toISOString(),
            };
        } catch (err) {
            return {
                ok: false,
                status: "INVALID_CERTIFICATE",
                error: `Unable to parse certificate: ${err.message}`,
                checkedAt: new Date().toISOString(),
            };
        }
    }
}

module.exports = { SslDecoderExecutor };
