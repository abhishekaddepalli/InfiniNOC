const axios = require("axios");
const { performance } = require("perf_hooks");
const { ProviderHealth } = require("./provider-health");

/**
 * Free Community Fallback Provider Adapter (BGP / ASN / Geolocation fallback)
 */
class CommunityFallbackProvider {
    /**
     * Fetch community fallback ASN and geolocation data
     * @param {string} ip Target IP address
     * @returns {Promise<object>} Fallback data object
     */
    static async fetchFallbackDetails(ip) {
        const start = performance.now();
        try {
            const url = `https://api.iplocation.net/?ip=${encodeURIComponent(ip)}`;
            const response = await axios.get(url, { timeout: 4000 });
            const elapsed = performance.now() - start;

            ProviderHealth.recordSuccess("Community_Fallback", elapsed);
            const data = response.data || {};

            return {
                configured: true,
                ok: true,
                source: "Community / Fallback Source",
                status: "SUCCESS",
                latencyMs: Math.round(elapsed),
                data: {
                    ip: data.ip || ip,
                    country: data.country_name || null,
                    countryCode: data.country_code2 || null,
                    isp: data.isp || null,
                },
                checkedAt: new Date().toISOString(),
            };
        } catch (error) {
            const elapsed = performance.now() - start;
            ProviderHealth.recordFailure("Community_Fallback", error.message);
            return {
                configured: true,
                ok: false,
                source: "Community / Fallback Source",
                status: "ERROR",
                error: error.message,
                latencyMs: Math.round(elapsed),
                checkedAt: new Date().toISOString(),
            };
        }
    }
}

module.exports = { CommunityFallbackProvider };
