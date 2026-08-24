const dns = require("dns").promises;
const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Real Reverse DNS (PTR) Query Executor
 */
class ReverseDnsExecutor {
    /**
     * Execute Reverse DNS PTR lookup for an IP address
     * @param {string} ip Target IP address
     * @throws {Error} If IP is invalid or blocked
     * @returns {Promise<object>} Reverse DNS query result
     */
    static async execute(ip) {
        if (!ip || typeof ip !== "string" || !ip.trim()) {
            throw new Error("Target IP address is required.");
        }

        const cleanIp = ip.trim();

        if (!net.isIP(cleanIp)) {
            throw new Error(`Invalid IP address syntax '${cleanIp}'.`);
        }

        // SSRF Guard
        if (SsrfValidator.isBlockedIp(cleanIp)) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: `Target IP ${cleanIp} is in a restricted internal / private network range.`,
                ip: cleanIp,
                ptrRecords: [],
                checkedAt: new Date().toISOString(),
            };
        }

        try {
            const ptrRecords = await dns.reverse(cleanIp);
            if (ptrRecords && ptrRecords.length > 0) {
                return {
                    ok: true,
                    status: "SUCCESS",
                    ip: cleanIp,
                    ptrRecords,
                    totalRecords: ptrRecords.length,
                    primaryPtr: ptrRecords[0],
                    checkedAt: new Date().toISOString(),
                };
            }

            return {
                ok: true,
                status: "NO_PTR",
                ip: cleanIp,
                ptrRecords: [],
                totalRecords: 0,
                message: "No PTR record found for this IP address.",
                checkedAt: new Date().toISOString(),
            };
        } catch (error) {
            return {
                ok: true,
                status: "NO_PTR",
                ip: cleanIp,
                ptrRecords: [],
                totalRecords: 0,
                message: `Reverse DNS query completed: No PTR record found (${error.code || error.message}).`,
                checkedAt: new Date().toISOString(),
            };
        }
    }
}

module.exports = { ReverseDnsExecutor };
