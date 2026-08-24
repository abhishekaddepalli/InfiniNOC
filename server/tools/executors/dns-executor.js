const dns = require("dns").promises;
const axios = require("axios");

/**
 * Real DNS Resolver Executor (Native Node DNS & DNS-over-HTTPS)
 */
class DnsExecutor {
    /**
     * Execute DNS Lookup query
     * @param {object} params Query parameters
     * @param {string} params.domain Domain name to query
     * @param {string} params.recordType Record type (A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SRV, ALL)
     * @param {string} params.resolver Resolver choice (system, google_doh, cloudflare_doh)
     * @throws {Error} If domain or parameters are invalid
     * @returns {Promise<object>} DNS query result object
     */
    static async execute({ domain, recordType = "ALL", resolver = "system" }) {
        if (!domain || typeof domain !== "string" || !domain.trim()) {
            throw new Error("Domain name input is required.");
        }

        const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
        const type = (recordType || "ALL").toUpperCase();
        const selectedResolver = resolver || "system";

        // Security / SSRF check on target domain name
        if (cleanDomain === "localhost" || cleanDomain.endsWith(".local") || cleanDomain.endsWith(".internal")) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: "Target domain 'localhost' or internal TLD is blocked by security policy.",
                domain: cleanDomain,
                recordType: type,
                resolver: selectedResolver,
                records: [],
                checkedAt: new Date().toISOString(),
            };
        }

        if (selectedResolver === "google_doh" || selectedResolver === "cloudflare_doh") {
            return await this.queryDoH(cleanDomain, type, selectedResolver);
        }

        return await this.querySystemDns(cleanDomain, type);
    }

    /**
     * Query native System DNS via node:dns/promises
     * @param {string} domain Domain name
     * @param {string} recordType Target record type
     * @returns {Promise<object>} Query result
     */
    static async querySystemDns(domain, recordType) {
        const records = [];
        let status = "NOERROR";
        let queryError = null;

        const typesToQuery = recordType === "ALL" ? ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"] : [recordType];

        for (const type of typesToQuery) {
            try {
                if (type === "A") {
                    const addresses = await dns.resolve4(domain, { ttl: true });
                    for (const a of addresses) {
                        records.push({ type: "A", value: a.address, ttl: a.ttl || 300, priority: "-" });
                    }
                } else if (type === "AAAA") {
                    const addresses = await dns.resolve6(domain, { ttl: true });
                    for (const a of addresses) {
                        records.push({ type: "AAAA", value: a.address, ttl: a.ttl || 300, priority: "-" });
                    }
                } else if (type === "MX") {
                    const mxList = await dns.resolveMx(domain);
                    for (const mx of mxList) {
                        records.push({ type: "MX", value: mx.exchange, ttl: 300, priority: mx.priority });
                    }
                } else if (type === "NS") {
                    const nsList = await dns.resolveNs(domain);
                    for (const ns of nsList) {
                        records.push({ type: "NS", value: ns, ttl: 300, priority: "-" });
                    }
                } else if (type === "TXT") {
                    const txtList = await dns.resolveTxt(domain);
                    for (const txt of txtList) {
                        records.push({ type: "TXT", value: txt.join(" "), ttl: 300, priority: "-" });
                    }
                } else if (type === "CNAME") {
                    const cnameList = await dns.resolveCname(domain);
                    for (const cname of cnameList) {
                        records.push({ type: "CNAME", value: cname, ttl: 300, priority: "-" });
                    }
                } else if (type === "SOA") {
                    const soa = await dns.resolveSoa(domain);
                    if (soa) {
                        const val = `mname: ${soa.nsname}, rname: ${soa.hostmaster}, serial: ${soa.serial}`;
                        records.push({ type: "SOA", value: val, ttl: soa.minttl || 300, priority: "-" });
                    }
                } else if (type === "CAA") {
                    const caaList = await dns.resolveCaa(domain);
                    for (const caa of caaList) {
                        records.push({ type: "CAA", value: `${caa.issue || caa.iodef || ""} (flags: ${caa.critical || 0})`, ttl: 300, priority: "-" });
                    }
                } else if (type === "SRV") {
                    const srvList = await dns.resolveSrv(domain);
                    for (const srv of srvList) {
                        records.push({ type: "SRV", value: `${srv.name}:${srv.port} (weight: ${srv.weight})`, ttl: 300, priority: srv.priority });
                    }
                }
            } catch (err) {
                if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
                    // Normal missing record type, ignore
                } else if (err.code === "ESERVFAIL") {
                    status = "SERVFAIL";
                    queryError = err.message;
                } else {
                    queryError = err.message;
                }
            }
        }

        if (records.length === 0 && queryError) {
            status = "NXDOMAIN";
        }

        return {
            ok: true,
            status,
            domain,
            recordType,
            resolver: "System Resolver",
            records,
            totalRecords: records.length,
            error: records.length === 0 && status !== "NOERROR" ? queryError : null,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Query DNS-over-HTTPS (DoH) JSON API (Google or Cloudflare)
     * @param {string} domain Target domain
     * @param {string} recordType Record type
     * @param {string} provider DoH provider identifier
     * @returns {Promise<object>} Query result
     */
    static async queryDoH(domain, recordType, provider) {
        const records = [];
        let status = "NOERROR";
        const resolverName = provider === "google_doh" ? "Google Public DNS (DoH)" : "Cloudflare (DoH)";
        const typesToQuery = recordType === "ALL" ? ["A", "AAAA", "MX", "NS", "TXT"] : [recordType];

        for (const type of typesToQuery) {
            try {
                let url = "";
                let headers = { Accept: "application/dns-json" };

                if (provider === "google_doh") {
                    url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
                } else {
                    url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
                }

                const response = await axios.get(url, { timeout: 5000, headers });
                if (response.data && response.data.Answer) {
                    for (const ans of response.data.Answer) {
                        records.push({
                            type: this.getRecordTypeName(ans.type) || type,
                            value: ans.data,
                            ttl: ans.TTL || 300,
                            priority: "-",
                        });
                    }
                }
                if (response.data && response.data.Status === 3) {
                    status = "NXDOMAIN";
                }
            } catch (err) {
                // Ignore single type error
            }
        }

        return {
            ok: true,
            status,
            domain,
            recordType,
            resolver: resolverName,
            records,
            totalRecords: records.length,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Map numeric DNS record type ID to string representation
     * @param {number} typeId Type ID integer
     * @returns {string} String name e.g. "A", "AAAA"
     */
    static getRecordTypeName(typeId) {
        const map = {
            1: "A",
            28: "AAAA",
            15: "MX",
            2: "NS",
            16: "TXT",
            5: "CNAME",
            6: "SOA",
            257: "CAA",
            33: "SRV",
            12: "PTR",
        };
        return map[typeId] || `TYPE${typeId}`;
    }
}

module.exports = { DnsExecutor };
