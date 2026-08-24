const dns = require("dns").promises;
const axios = require("axios");
const { performance } = require("perf_hooks");
const { ProviderHealth } = require("./provider-health");

/**
 * Authentic Reverse DNS PTR Provider Adapter
 * Queries system DNS resolver and Google/Cloudflare DoH for actual PTR records.
 */
class DnsPtrProvider {
    /**
     * Query PTR record for an IP address
     * @param {string} ip Target IPv4 or IPv6 address
     * @returns {Promise<object>} PTR result with DNS operation status
     */
    static async fetchPtr(ip) {
        const start = performance.now();

        // 1. Try System DNS Resolver
        try {
            const ptrs = await dns.reverse(ip);
            const elapsed = performance.now() - start;
            ProviderHealth.recordSuccess("DNS Resolver (PTR)", elapsed);

            if (ptrs && ptrs.length > 0) {
                return {
                    status: "success",
                    provider: "System DNS Resolver",
                    ip,
                    data: {
                        ptr: ptrs[0],
                        allPtrs: ptrs,
                    },
                    fetchedAt: new Date().toISOString(),
                    latencyMs: Math.round(elapsed),
                    success: true,
                };
            }
        } catch (sysError) {
            // System DNS resolver failed or returned ENOTFOUND; proceed to DoH fallback
        }

        // 2. Try Google DoH Resolver fallback
        try {
            let revArpa;
            if (ip.includes(":")) {
                // IPv6 PTR query format
                revArpa = ip.split(":").map(h => h.padStart(4, "0")).join("").split("").reverse().join(".") + ".ip6.arpa";
            } else {
                // IPv4 PTR query format
                revArpa = ip.split(".").reverse().join(".") + ".in-addr.arpa";
            }

            const dohUrl = `https://dns.google/resolve?name=${encodeURIComponent(revArpa)}&type=PTR`;
            const dohRes = await axios.get(dohUrl, { timeout: 4000, headers: { "User-Agent": "InfiniNOC-Diagnostic/1.0" } });
            const elapsed = performance.now() - start;

            if (dohRes.data && Array.isArray(dohRes.data.Answer) && dohRes.data.Answer.length > 0) {
                let ptrVal = dohRes.data.Answer[0].data;
                if (ptrVal && ptrVal.endsWith(".")) {
                    ptrVal = ptrVal.slice(0, -1);
                }
                ProviderHealth.recordSuccess("Google Public DNS (PTR)", elapsed);

                return {
                    status: "success",
                    provider: "Google Public DNS (DoH)",
                    ip,
                    data: {
                        ptr: ptrVal,
                        allPtrs: [ptrVal],
                    },
                    fetchedAt: new Date().toISOString(),
                    latencyMs: Math.round(elapsed),
                    success: true,
                };
            }

            ProviderHealth.recordSuccess("DNS Resolver (PTR)", elapsed);
            return {
                status: "no_data",
                provider: "System / DoH Resolver",
                ip,
                data: {
                    ptr: null,
                    allPtrs: [],
                    message: "No PTR record",
                },
                error: "No PTR record found in DNS",
                fetchedAt: new Date().toISOString(),
                latencyMs: Math.round(elapsed),
                success: false,
            };
        } catch (dohError) {
            const elapsed = performance.now() - start;
            ProviderHealth.recordFailure("DNS Resolver (PTR)", dohError.message);

            return {
                status: "provider_error",
                provider: "System / DoH Resolver",
                ip,
                data: null,
                error: "PTR lookup failed: " + dohError.message,
                fetchedAt: new Date().toISOString(),
                latencyMs: Math.round(elapsed),
                success: false,
            };
        }
    }
}

module.exports = { DnsPtrProvider };
