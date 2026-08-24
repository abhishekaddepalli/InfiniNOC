const { IpinfoProvider } = require("./ipinfo-provider");
const { RipestatProvider } = require("./ripestat-provider");
const { DnsPtrProvider } = require("./dns-ptr-provider");
const { CommunityFallbackProvider } = require("./community-fallback-provider");
const { NetworkIntelligenceMerger } = require("../mergers/network-intelligence-merger");
const { ProviderHealth } = require("./provider-health");
const { log } = require("../../../src/util");

/**
 * Central Tools V3 Provider Registry
 */
class ProviderRegistry {
    /**
     * Query all configured IP Intelligence providers concurrently and merge into normalized model
     * @param {string} ip Target IP address
     * @param {boolean} refresh If true, bypass cache and perform fresh request
     * @returns {Promise<object>} Merged normalized IP Intelligence result with provenance
     */
    static async fetchIpIntelligence(ip, refresh = false) {
        log.info("tools-v3", `Fetching IP Intelligence for '${ip}' (refresh=${refresh})`);

        const [ipinfoRes, ripestatRes, dnsPtrRes, fallbackRes] = await Promise.allSettled([
            IpinfoProvider.fetchIpDetails(ip),
            RipestatProvider.fetchIpRoutingDetails(ip),
            DnsPtrProvider.fetchPtr(ip),
            CommunityFallbackProvider.fetchFallbackDetails(ip),
        ]);

        const providerResults = {
            ipinfo: ipinfoRes.status === "fulfilled" ? ipinfoRes.value : null,
            ripestat: ripestatRes.status === "fulfilled" ? ripestatRes.value : null,
            dnsPtr: dnsPtrRes.status === "fulfilled" ? dnsPtrRes.value : null,
            fallback: fallbackRes.status === "fulfilled" ? fallbackRes.value : null,
        };

        return NetworkIntelligenceMerger.mergeIpIntelligence(ip, providerResults);
    }

    /**
     * Get Provider Health Metrics Snapshot
     * @returns {object} Provider Health Snapshot JSON
     */
    static getHealthSnapshot() {
        return ProviderHealth.getHealthSnapshot();
    }
}

module.exports = { ProviderRegistry };
