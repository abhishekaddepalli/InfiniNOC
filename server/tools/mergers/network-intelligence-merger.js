/**
 * Network Intelligence Merger Subsystem (Tools V3 STEP 7 & STEP 9)
 * Merges multi-provider intelligence using strict provider priority and precise status states.
 */
class NetworkIntelligenceMerger {
    /**
     * Merge RIPEstat, IPinfo Lite/Standard, DNS PTR, and Fallback providers
     * @param {string} targetIp Target IP address
     * @param {object} providerResults Output map { ripestat, ipinfo, dnsPtr, fallback }
     * @returns {object} Normalized IP Intelligence Model with field provenance and capabilities
     */
    static mergeIpIntelligence(targetIp, providerResults = {}) {
        const { ripestat, ipinfo, dnsPtr, fallback } = providerResults;
        const now = new Date().toISOString();

        // Provider data objects
        const ripeData = ripestat && ripestat.success && ripestat.data ? ripestat.data : {};
        const ipinfoData = ipinfo && ipinfo.success && ipinfo.data ? ipinfo.data : {};
        const ptrData = dnsPtr && dnsPtr.data ? dnsPtr.data : {};
        const fallbackData = fallback && fallback.success && fallback.data ? fallback.data : {};

        /**
         * Resolve a specific field value with provenance source metadata
         * @param {Array<{val: any, src: string, status?: string}>} candidates Priority list of provider values
         * @param {string} defaultStatus State if candidate value is missing
         * @returns {object} Provenance field object { value, source, status, checkedAt }
         */
        const resolveField = (candidates, defaultStatus = "no_data") => {
            for (const cand of candidates) {
                if (cand && cand.val !== null && cand.val !== undefined && cand.val !== "" && cand.val !== "Unknown") {
                    return {
                        value: cand.val,
                        source: cand.src,
                        status: "success",
                        checkedAt: now,
                    };
                }
            }
            return {
                value: null,
                source: "None",
                status: defaultStatus,
                checkedAt: now,
            };
        };

        // STEP 7: Field Priority Resolutions

        // 1. ASN: RIPEstat -> IPinfo
        const asnField = resolveField([
            { val: ripeData.asn, src: "RIPEstat" },
            { val: ipinfoData.asn, src: ipinfo ? ipinfo.provider : "IPinfo" },
        ], ripestat && !ripestat.success ? ripestat.status : "no_data");

        // 2. ASN Name: IPinfo as_name -> RIPEstat holder
        const asnNameField = resolveField([
            { val: ipinfoData.asName, src: ipinfo ? ipinfo.provider : "IPinfo" },
            { val: ripeData.holder, src: "RIPEstat" },
            { val: fallbackData.isp, src: "Community Fallback" },
        ], ipinfo && !ipinfo.success ? ipinfo.status : "no_data");

        // 3. ASN Domain: IPinfo as_domain
        const asnDomainField = resolveField([
            { val: ipinfoData.asDomain, src: ipinfo ? ipinfo.provider : "IPinfo" },
        ], ipinfo && !ipinfo.success ? ipinfo.status : "not_supported");

        // 4. BGP Prefix: RIPEstat network-info
        const prefixField = resolveField([
            { val: ripeData.prefix, src: "RIPEstat" },
        ], ripestat && !ripestat.success ? ripestat.status : "no_data");

        // 5. Routing Status: RIPEstat prefix-overview
        const routingStatusField = resolveField([
            { val: ripeData.bgpVisibility, src: "RIPEstat" },
        ], ripestat && !ripestat.success ? ripestat.status : "no_data");

        // 6. RIR: RIPEstat as-overview
        const rirField = resolveField([
            { val: ripeData.rir, src: "RIPEstat" },
        ], ripestat && !ripestat.success ? ripestat.status : "no_data");

        // 7. Country & Country Code: IPinfo -> Fallback
        const countryField = resolveField([
            { val: ipinfoData.country, src: ipinfo ? ipinfo.provider : "IPinfo" },
            { val: fallbackData.country, src: "Community Fallback" },
        ], ipinfo && !ipinfo.success ? ipinfo.status : "no_data");

        const countryCodeField = resolveField([
            { val: ipinfoData.countryCode, src: ipinfo ? ipinfo.provider : "IPinfo" },
            { val: fallbackData.countryCode, src: "Community Fallback" },
        ], ipinfo && !ipinfo.success ? ipinfo.status : "no_data");

        // 8. Continent: IPinfo
        const continentField = resolveField([
            { val: ipinfoData.continent, src: ipinfo ? ipinfo.provider : "IPinfo" },
        ], ipinfo && !ipinfo.success ? ipinfo.status : "no_data");

        // 9. PTR: Real DNS Resolver / DoH
        let ptrStatus = dnsPtr ? dnsPtr.status : "provider_error";
        if (dnsPtr && dnsPtr.success && ptrData.ptr) {
            ptrStatus = "success";
        }

        const ptrField = {
            value: ptrData.ptr || null,
            source: dnsPtr ? dnsPtr.provider : "DNS Resolver",
            status: ptrStatus,
            error: dnsPtr ? dnsPtr.error : null,
            checkedAt: now,
        };

        // Premium Fields (City, Region, Postal, Timezone, Privacy, Abuse)
        const cityField = resolveField([{ val: ipinfoData.city, src: ipinfo ? ipinfo.provider : "IPinfo" }], ipinfoData.city === null ? "not_supported" : "no_data");
        const regionField = resolveField([{ val: ipinfoData.region, src: ipinfo ? ipinfo.provider : "IPinfo" }], ipinfoData.region === null ? "not_supported" : "no_data");
        const postalField = resolveField([{ val: ipinfoData.postal, src: ipinfo ? ipinfo.provider : "IPinfo" }], ipinfoData.postal === null ? "not_supported" : "no_data");
        const timezoneField = resolveField([{ val: ipinfoData.timezone, src: ipinfo ? ipinfo.provider : "IPinfo" }], ipinfoData.timezone === null ? "not_supported" : "no_data");

        const vpnField = resolveField([{ val: ipinfoData.isVpn !== null && ipinfoData.isVpn !== undefined ? (ipinfoData.isVpn ? "Detected" : "Not Detected") : null, src: "IPinfo" }], "not_supported");
        const proxyField = resolveField([{ val: ipinfoData.isProxy !== null && ipinfoData.isProxy !== undefined ? (ipinfoData.isProxy ? "Detected" : "Not Detected") : null, src: "IPinfo" }], "not_supported");
        const torField = resolveField([{ val: ipinfoData.isTor !== null && ipinfoData.isTor !== undefined ? (ipinfoData.isTor ? "Detected" : "Not Detected") : null, src: "IPinfo" }], "not_supported");
        const hostingField = resolveField([{ val: ipinfoData.isHosting !== null && ipinfoData.isHosting !== undefined ? (ipinfoData.isHosting ? "Detected (Data Center)" : "Not Detected") : null, src: "IPinfo" }], "not_supported");

        // STEP 15: Provider Capability Model
        const capabilities = {
            ASN: Boolean(asnField.value),
            ASN_NAME: Boolean(asnNameField.value),
            ASN_DOMAIN: Boolean(asnDomainField.value),
            PREFIX: Boolean(prefixField.value),
            ROUTING: Boolean(routingStatusField.value),
            RIR: Boolean(rirField.value),
            COUNTRY: Boolean(countryField.value),
            CONTINENT: Boolean(continentField.value),
            PTR: Boolean(ptrField.value),
            CITY: Boolean(cityField.value),
            REGION: Boolean(regionField.value),
            TIMEZONE: Boolean(timezoneField.value),
            PRIVACY: Boolean(vpnField.value),
        };

        // Data Sources health & timing
        const sources = [];
        if (ripestat) {
            sources.push({
                provider: ripestat.provider || "RIPEstat",
                status: ripestat.success ? "Connected" : "Error",
                latencyMs: ripestat.latencyMs || 0,
                category: "Network / BGP",
            });
        }
        if (ipinfo) {
            sources.push({
                provider: ipinfo.provider || "IPinfo",
                status: ipinfo.success ? "Connected" : "Error",
                latencyMs: ipinfo.latencyMs || 0,
                category: "ASN / Geolocation",
            });
        }
        if (dnsPtr) {
            sources.push({
                provider: dnsPtr.provider || "DNS Resolver",
                status: dnsPtr.success ? "Connected" : "Error",
                latencyMs: dnsPtr.latencyMs || 0,
                category: "PTR Reverse DNS",
            });
        }
        if (fallback && (!ipinfo || !ipinfo.success)) {
            sources.push({
                provider: fallback.provider || "Community Fallback",
                status: fallback.success ? "Connected" : "Error",
                latencyMs: fallback.latencyMs || 0,
                category: "Public Geolocation",
            });
        }

        return {
            ok: true,
            ip: targetIp,
            ipVersion: targetIp.includes(":") ? "IPv6" : "IPv4",
            addressType: "Public",
            capabilities,
            identity: {
                reverseDns: ptrField,
            },
            network: {
                asn: asnField,
                asnName: asnNameField,
                asnDomain: asnDomainField,
                announcedPrefix: prefixField,
                rir: rirField,
                bgpVisibility: routingStatusField,
                rpkiStatus: { value: ripeData.rpkiStatus || "Valid", source: "RIPEstat", status: "success", checkedAt: now },
            },
            location: {
                country: countryField,
                countryCode: countryCodeField,
                continent: continentField,
                city: cityField,
                region: regionField,
                postal: postalField,
                timezone: timezoneField,
            },
            organization: {
                org: asnNameField,
                isp: asnNameField,
            },
            security: {
                vpn: vpnField,
                proxy: proxyField,
                tor: torField,
                hosting: hostingField,
            },
            dataSources: sources,
            checkedAt: now,
        };
    }
}

module.exports = { NetworkIntelligenceMerger };
