const axios = require("axios");
const { performance } = require("perf_hooks");
const { ProviderConfig } = require("../config/provider-config");
const { ProviderHealth } = require("./provider-health");

/**
 * IPinfo Provider Adapter (Supports IPinfo Lite and IPinfo Standard endpoints)
 */
class IpinfoProvider {
    /**
     * Query IPinfo for IP details with schema handling based on endpoint capability
     * @param {string} ip Target IPv4 or IPv6 address
     * @returns {Promise<object>} IPinfo result object with provider capability metadata
     */
    static async fetchIpDetails(ip) {
        const token = ProviderConfig.getApiKey("IPINFO");
        const start = performance.now();

        // 1. If IPINFO_TOKEN is provided and configured for Lite
        const isLiteMode = process.env.IPINFO_IS_LITE === "true" || process.env.IPINFO_LITE === "true";

        let url;
        let providerName;

        if (token && isLiteMode) {
            url = `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`;
            providerName = "IPinfo Lite";
        } else if (token) {
            url = `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`;
            providerName = "IPinfo Standard";
        } else {
            // Free / Public fallback without secret token
            url = `https://ipinfo.io/${encodeURIComponent(ip)}/json`;
            providerName = "IPinfo (Public)";
        }

        try {
            const response = await axios.get(url, {
                timeout: ProviderConfig.getTimeout(),
                headers: { "User-Agent": "InfiniNOC-Diagnostic/1.0" },
            });
            const elapsed = performance.now() - start;
            ProviderHealth.recordSuccess(providerName, elapsed);

            const resData = response.data || {};

            // STEP 6: Separate parsing for IPinfo Lite vs Standard
            if (isLiteMode) {
                // IPinfo Lite Schema: ip, asn, as_name, as_domain, country_code, country, continent_code, continent
                const asnRaw = resData.asn || resData.as_number || null;
                const asn = asnRaw ? (asnRaw.toString().toUpperCase().startsWith("AS") ? asnRaw.toString().toUpperCase() : `AS${asnRaw}`) : null;

                return {
                    status: "success",
                    provider: "IPinfo Lite",
                    ip: resData.ip || ip,
                    capabilities: {
                        ASN: true,
                        ASN_NAME: true,
                        ASN_DOMAIN: true,
                        COUNTRY: true,
                        CONTINENT: true,
                        CITY: false,
                        REGION: false,
                        TIMEZONE: false,
                        PRIVACY: false,
                        ABUSE: false,
                    },
                    data: {
                        asn,
                        asName: resData.as_name || null,
                        asDomain: resData.as_domain || null,
                        countryCode: resData.country_code || resData.country || null,
                        country: resData.country || null,
                        continentCode: resData.continent_code || null,
                        continent: resData.continent || null,
                        // Premium fields set to null explicitly for Lite
                        city: null,
                        region: null,
                        postal: null,
                        timezone: null,
                        latitude: null,
                        longitude: null,
                        org: resData.as_name ? `${asn} ${resData.as_name}` : null,
                        isVpn: null,
                        isProxy: null,
                        isTor: null,
                        isHosting: null,
                        isAnycast: null,
                        abuseEmail: null,
                        abuseNetwork: null,
                    },
                    fetchedAt: new Date().toISOString(),
                    latencyMs: Math.round(elapsed),
                    success: true,
                };
            }

            // IPinfo Standard Schema: ip, hostname, city, region, country, loc, org, postal, timezone, anycast
            let lat = null;
            let lon = null;
            if (resData.loc) {
                const parts = resData.loc.split(",");
                lat = parseFloat(parts[0]) || null;
                lon = parseFloat(parts[1]) || null;
            }

            let parsedAsn = null;
            let parsedAsnName = null;
            if (resData.org) {
                const orgMatch = resData.org.match(/^(AS\d+)\s+(.*)$/);
                if (orgMatch) {
                    parsedAsn = orgMatch[1];
                    parsedAsnName = orgMatch[2];
                } else {
                    parsedAsnName = resData.org;
                }
            }

            return {
                status: "success",
                provider: providerName,
                ip: resData.ip || ip,
                capabilities: {
                    ASN: true,
                    ASN_NAME: true,
                    ASN_DOMAIN: Boolean(resData.asn && resData.asn.domain),
                    COUNTRY: true,
                    CONTINENT: Boolean(resData.continent),
                    CITY: Boolean(resData.city),
                    REGION: Boolean(resData.region),
                    TIMEZONE: Boolean(resData.timezone),
                    PRIVACY: Boolean(resData.privacy),
                    ABUSE: Boolean(resData.abuse),
                },
                data: {
                    asn: parsedAsn,
                    asName: parsedAsnName,
                    asDomain: resData.asn ? resData.asn.domain : null,
                    asType: resData.asn ? resData.asn.type : null,
                    hostname: resData.hostname || null,
                    city: resData.city || null,
                    region: resData.region || null,
                    country: resData.country || null,
                    countryCode: resData.country || null,
                    continent: resData.continent || null,
                    postal: resData.postal || null,
                    timezone: resData.timezone || null,
                    latitude: lat,
                    longitude: lon,
                    org: resData.org || null,
                    companyName: resData.company ? resData.company.name : null,
                    isVpn: resData.privacy ? resData.privacy.vpn : null,
                    isProxy: resData.privacy ? resData.privacy.proxy : null,
                    isTor: resData.privacy ? resData.privacy.tor : null,
                    isHosting: resData.privacy ? resData.privacy.hosting : null,
                    isAnycast: resData.anycast || false,
                    abuseEmail: resData.abuse ? resData.abuse.email : null,
                    abuseNetwork: resData.abuse ? resData.abuse.network : null,
                },
                fetchedAt: new Date().toISOString(),
                latencyMs: Math.round(elapsed),
                success: true,
            };
        } catch (error) {
            const elapsed = performance.now() - start;
            ProviderHealth.recordFailure(providerName, error.message);

            let status = "provider_error";
            if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
                status = "timeout";
            } else if (error.response && error.response.status === 429) {
                status = "rate_limited";
            }

            return {
                status,
                provider: providerName,
                ip,
                data: null,
                error: error.message,
                fetchedAt: new Date().toISOString(),
                latencyMs: Math.round(elapsed),
                success: false,
            };
        }
    }
}

module.exports = { IpinfoProvider };
