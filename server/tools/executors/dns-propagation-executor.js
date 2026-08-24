const axios = require("axios");
const { performance } = require("perf_hooks");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Global Resolvers Dataset for DNS Propagation Checking
 */
const GLOBAL_RESOLVERS = [
    { name: "Google Public DNS (Primary)", region: "North America", country: "US", endpoint: "https://dns.google/resolve" },
    { name: "Cloudflare DoH (Primary)", region: "Europe / Global", country: "LU", endpoint: "https://cloudflare-dns.com/dns-query" },
    { name: "Quad9 Secure Resolver", region: "Switzerland / EU", country: "CH", endpoint: "https://dns.quad9.net:5053/dns-query" },
    { name: "OpenDNS / Cisco Security", region: "North America", country: "US", endpoint: "https://doh.opendns.com/dns-query" },
    { name: "Google Public DNS (Secondary)", region: "Asia Pacific", country: "SG", endpoint: "https://dns.google/resolve" },
];

/**
 * DNS Propagation Diagnostic Executor
 */
class DnsPropagationExecutor {
    /**
     * Execute DNS record propagation lookup across global DoH resolvers
     * @param {object} params Target domain & recordType
     * @returns {Promise<object>} Propagation result matrix
     */
    static async execute(params = {}) {
        const domain = params.domain || params.target || "example.com";
        const recordType = (params.recordType || "A").toUpperCase();

        const validation = await SsrfValidator.validateTarget(domain);
        if (!validation.safe) {
            throw new Error(validation.reason || "Target domain is restricted by security policy.");
        }

        const start = performance.now();

        const results = await Promise.allSettled(GLOBAL_RESOLVERS.map(async (r) => {
            const pStart = performance.now();
            try {
                let url;
                const headers = { Accept: "application/dns-json", "User-Agent": "InfiniNOC-Diagnostic/1.0" };
                if (r.endpoint.includes("google")) {
                    url = `${r.endpoint}?name=${encodeURIComponent(domain)}&type=${recordType}`;
                } else {
                    url = `${r.endpoint}?name=${encodeURIComponent(domain)}&type=${recordType}`;
                }

                const res = await axios.get(url, { timeout: 5000, headers });
                const elapsed = Math.round(performance.now() - pStart);
                const data = res.data || {};

                let records = [];
                if (Array.isArray(data.Answer)) {
                    records = data.Answer.map(ans => ans.data ? ans.data.replace(/\.$/, "") : "");
                }

                const status = data.Status === 0 ? "NOERROR" : `Status ${data.Status}`;

                return {
                    resolver: r.name,
                    region: r.region,
                    country: r.country,
                    status,
                    latencyMs: elapsed,
                    records,
                    match: true,
                };
            } catch (err) {
                const elapsed = Math.round(performance.now() - pStart);
                return {
                    resolver: r.name,
                    region: r.region,
                    country: r.country,
                    status: "TIMEOUT / ERROR",
                    latencyMs: elapsed,
                    records: [],
                    error: err.message,
                    match: false,
                };
            }
        }));

        const propagationMatrix = results.map(r => r.status === "fulfilled" ? r.value : r.reason);
        const totalElapsed = Math.round(performance.now() - start);

        // Determine if all operational resolvers agree on records
        const successfulResolvers = propagationMatrix.filter(m => m.status === "NOERROR" && m.records.length > 0);
        let propagated = false;
        if (successfulResolvers.length > 0) {
            const firstSet = successfulResolvers[0].records.sort().join(",");
            propagated = successfulResolvers.every(m => m.records.sort().join(",") === firstSet);
        }

        return {
            domain,
            recordType,
            propagated,
            consensusCount: successfulResolvers.length,
            totalResolvers: GLOBAL_RESOLVERS.length,
            propagationMatrix,
            totalDurationMs: totalElapsed,
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { DnsPropagationExecutor };
