/**
 * Central Server-Side Provider Configuration System
 * Manages external provider secrets and options securely without exposing keys to frontend clients.
 */
class ProviderConfig {
    /**
     * Get Provider API Key or Token from environment variables
     * @param {string} providerName Provider key name
     * @returns {string} Configured key or empty string
     */
    static getApiKey(providerName) {
        switch (providerName.toUpperCase()) {
            case "IPINFO":
                return process.env.IPINFO_TOKEN || "";
            case "ABUSEIPDB":
                return process.env.ABUSEIPDB_KEY || "";
            case "RIPESTAT":
                return process.env.RIPESTAT_SOURCEAPP || "infini-noc-saas";
            default:
                return "";
        }
    }

    /**
     * Check if a provider has required API keys / configuration
     * @param {string} providerName Provider identifier
     * @returns {boolean} True if configured
     */
    static isConfigured(providerName) {
        const key = providerName.toUpperCase();
        if (key === "RIPESTAT" || key === "DNS_PTR" || key === "COMMUNITY_FALLBACK") {
            return true; // Public / No key required
        }
        return Boolean(this.getApiKey(key));
    }

    /**
     * Get default timeout for provider requests in ms
     * @returns {number} Timeout in ms
     */
    static getTimeout() {
        return parseInt(process.env.PROVIDER_TIMEOUT_MS || 5000, 10);
    }
}

module.exports = { ProviderConfig };
