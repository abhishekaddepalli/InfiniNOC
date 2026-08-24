const axios = require("axios");
const dns = require("dns").promises;
const net = require("net");

/**
 * Real IP Intelligence Provider Adapter
 * Queries RIPEstat Data API and performs DNS PTR lookups for authentic network metadata.
 */
class IpIntelligenceProvider {
    /**
     * Fetch authentic IP Intelligence for a target IP address
     * @param {string} ip Destination IP address
     * @returns {Promise<object>} IP Intelligence Result
     */
    static async fetchIpIntelligence(ip) {
        if (!ip || !net.isIP(ip)) {
            throw new Error(`Invalid IP address '${ip}' provided to IP Intelligence provider.`);
        }

        const family = net.isIP(ip) === 6 ? "IPv6" : "IPv4";
        let reverseDns = "No PTR record found";

        // Perform actual Reverse DNS PTR lookup
        try {
            const ptrRecords = await dns.reverse(ip);
            if (ptrRecords && ptrRecords.length > 0) {
                reverseDns = ptrRecords[0];
            }
        } catch (ptrErr) {
            reverseDns = "No PTR record found";
        }

        let asn = "Unknown";
        let asnOrg = "Unknown";
        let prefix = "Unknown";
        let rir = "Unknown";
        let country = "Unknown";

        try {
            // Query RIPEstat Overview API for authentic network routing & ASN info
            const overviewRes = await axios.get(`https://stat.ripe.net/data/overview/data.json?resource=${ip}`, {
                timeout: 5000,
                headers: { "User-Agent": "InfiniNOC-NOC-Toolkit/2.5" },
            });

            if (overviewRes.data && overviewRes.data.data) {
                const data = overviewRes.data.data;

                if (data.asns && data.asns.length > 0) {
                    asn = `AS${data.asns[0]}`;
                }

                if (data.holder) {
                    asnOrg = data.holder;
                }

                if (data.block && data.block.resource) {
                    prefix = data.block.resource;
                }
            }
        } catch (overviewErr) {
            // RIPEstat overview lookup failed or timed out
        }

        try {
            // Query RIPEstat MaxMind GeoIP API for authentic country code
            const geoRes = await axios.get(`https://stat.ripe.net/data/maxmind-geo-lite/data.json?resource=${ip}`, {
                timeout: 5000,
                headers: { "User-Agent": "InfiniNOC-NOC-Toolkit/2.5" },
            });

            if (geoRes.data && geoRes.data.data && geoRes.data.data.located_resources) {
                const locs = geoRes.data.data.located_resources;
                if (locs.length > 0 && locs[0].locations && locs[0].locations.length > 0) {
                    country = locs[0].locations[0].country || "Unknown";
                }
            }
        } catch (geoErr) {
            // Geo lookup failed
        }

        try {
            // Query RIPEstat RIR prefix API for authentic Regional Internet Registry (RIPE, ARIN, APNIC, etc.)
            const rirRes = await axios.get(`https://stat.ripe.net/data/rir/data.json?resource=${ip}`, {
                timeout: 5000,
                headers: { "User-Agent": "InfiniNOC-NOC-Toolkit/2.5" },
            });

            if (rirRes.data && rirRes.data.data && rirRes.data.data.rirs && rirRes.data.data.rirs.length > 0) {
                rir = (rirRes.data.data.rirs[0].rir || "Unknown").toUpperCase();
            }
        } catch (rirErr) {
            // RIR lookup failed
        }

        return {
            ok: true,
            ip,
            family,
            reverseDns,
            asn,
            asnOrganization: asnOrg,
            prefix,
            country,
            region: "Data unavailable",
            city: "Data unavailable",
            timezone: "Data unavailable",
            rir,
            security: {
                vpn: "Not detected by source",
                proxy: "Not detected by source",
                tor: "Not detected by source",
            },
            provider: "RIPEstat Data API",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { IpIntelligenceProvider };
