const genericProfile = require("./snmp-profiles/generic");
const mikrotikProfile = require("./snmp-profiles/mikrotik");

class SnmpProfileRegistry {
    /**
     * Initialize SnmpProfileRegistry and register generic and mikrotik profiles
     */
    constructor() {
        this.profiles = new Map();
        this.registerProfile(genericProfile);
        this.registerProfile(mikrotikProfile);
    }

    /**
     * Register a vendor profile
     * @param {object} profile Profile definition containing id, name, oids, parseMetrics
     * @returns {void}
     */
    registerProfile(profile) {
        if (!profile || !profile.id) {
            throw new Error("Invalid profile definition.");
        }
        this.profiles.set(profile.id, profile);
    }

    /**
     * Get profile by vendor ID or default to 'generic'
     * @param {string} profileId Profile ID (e.g., 'mikrotik', 'huawei', 'generic')
     * @returns {object} Profile object
     */
    getProfile(profileId) {
        if (!profileId || !this.profiles.has(profileId)) {
            return this.profiles.get("generic");
        }
        return this.profiles.get(profileId);
    }

    /**
     * List all supported vendor profile IDs
     * @returns {Array<object>} Profile list
     */
    listProfiles() {
        return Array.from(this.profiles.values()).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
        }));
    }
}

const registry = new SnmpProfileRegistry();
module.exports = registry;
