const net = require("net");
const dns = require("dns").promises;

/**
 * Server-Side Request Forgery (SSRF) Protection & Destination Validator
 */
class SsrfValidator {
    /**
     * Check if a given IP address belongs to a blocked private / internal range
     * @param {string} ip Address to check
     * @returns {boolean} True if IP is blocked / unsafe
     */
    static isBlockedIp(ip) {
        if (!ip || typeof ip !== "string") {
            return true;
        }

        const cleanIp = ip.trim();
        const ipType = net.isIP(cleanIp);

        if (ipType === 4) {
            const parts = cleanIp.split(".").map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) {
                return true;
            }

            // 127.0.0.0/8 (Loopback / Localhost)
            if (parts[0] === 127) {
                return true;
            }
            // 0.0.0.0/8 (Current Network)
            if (parts[0] === 0) {
                return true;
            }
            // 10.0.0.0/8 (RFC1918 Private)
            if (parts[0] === 10) {
                return true;
            }
            // 172.16.0.0/12 (RFC1918 Private)
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
                return true;
            }
            // 192.168.0.0/16 (RFC1918 Private)
            if (parts[0] === 192 && parts[1] === 168) {
                return true;
            }
            // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
            if (parts[0] === 169 && parts[1] === 254) {
                return true;
            }
            // 100.64.0.0/10 (Carrier Grade NAT)
            if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
                return true;
            }

            return false;
        }

        if (ipType === 6) {
            const normalized = cleanIp.toLowerCase();

            // ::1 (Loopback)
            if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
                return true;
            }
            // fc00::/7 (Unique Local)
            if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
                return true;
            }
            // fe80::/10 (Link-Local)
            if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
                return true;
            }
            // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.0.0.1, etc.)
            if (normalized.startsWith("::ffff:")) {
                const embeddedIpv4 = normalized.replace("::ffff:", "");
                return this.isBlockedIp(embeddedIpv4);
            }

            return false;
        }

        // Invalid IP address format
        return true;
    }

    /**
     * Validate target hostname or IP address for safe outbound diagnostic execution
     * Performs DNS pre-resolution if hostname is supplied and validates all resolved IPs.
     * @param {string} target Destination hostname or IP address
     * @returns {Promise<{ safe: boolean, ip: string, resolvedIps: Array<string>, reason?: string }>} Validation result
     */
    static async validateTarget(target) {
        if (!target || typeof target !== "string" || !target.trim()) {
            return { safe: false, ip: "", resolvedIps: [], reason: "Target destination cannot be empty." };
        }

        const cleanTarget = target.trim().toLowerCase();

        // Block localhost strings directly
        if (cleanTarget === "localhost" || cleanTarget.endsWith(".local") || cleanTarget.endsWith(".internal")) {
            return { safe: false, ip: "", resolvedIps: [], reason: "Target destination 'localhost' or internal TLD is blocked by security policy." };
        }

        // If direct IP address
        if (net.isIP(cleanTarget)) {
            if (this.isBlockedIp(cleanTarget)) {
                return { safe: false, ip: cleanTarget, resolvedIps: [cleanTarget], reason: `Target IP ${cleanTarget} is in a restricted internal / private network range.` };
            }
            return { safe: true, ip: cleanTarget, resolvedIps: [cleanTarget] };
        }

        // If Domain / Hostname: Perform DNS pre-resolution
        try {
            const addresses = await dns.lookup(cleanTarget, { all: true });
            if (!addresses || addresses.length === 0) {
                return { safe: false, ip: "", resolvedIps: [], reason: `Unable to resolve DNS for domain '${cleanTarget}'.` };
            }

            const resolvedIps = addresses.map((a) => a.address);

            // Check every resolved IP address against blocked list
            for (const resolvedIp of resolvedIps) {
                if (this.isBlockedIp(resolvedIp)) {
                    return {
                        safe: false,
                        ip: resolvedIp,
                        resolvedIps,
                        reason: `Target domain '${cleanTarget}' resolved to restricted IP ${resolvedIp}. Access blocked.`,
                    };
                }
            }

            return { safe: true, ip: resolvedIps[0], resolvedIps };
        } catch (error) {
            return { safe: false, ip: "", resolvedIps: [], reason: `DNS resolution failed for '${cleanTarget}': ${error.message}` };
        }
    }
}

module.exports = { SsrfValidator };
