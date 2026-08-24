const HuaweiOltAdapter = require("./olt-adapters/huawei");
const ZteOltAdapter = require("./olt-adapters/zte");
const DasanOltAdapter = require("./olt-adapters/dasan");
const SyrotechOltAdapter = require("./olt-adapters/syrotech");
const OptilinkOltAdapter = require("./olt-adapters/optilink");
const VsolOltAdapter = require("./olt-adapters/vsol");
const CdataOltAdapter = require("./olt-adapters/cdata");

class OltAdapterRegistry {
    /**
     *
     */
    constructor() {
        this.adapters = new Map();
        this.registerAdapter(new HuaweiOltAdapter());
        this.registerAdapter(new ZteOltAdapter());
        this.registerAdapter(new DasanOltAdapter());
        this.registerAdapter(new SyrotechOltAdapter());
        this.registerAdapter(new OptilinkOltAdapter());
        this.registerAdapter(new VsolOltAdapter());
        this.registerAdapter(new CdataOltAdapter());
    }

    /**
     * Register an OLT Vendor Adapter
     * @param {object} adapter OLT adapter instance
     * @returns {void}
     */
    registerAdapter(adapter) {
        if (!adapter || !adapter.id) {
            throw new Error("Invalid OLT adapter definition.");
        }
        this.adapters.set(adapter.id, adapter);
    }

    /**
     * Get OLT adapter by ID or default to 'huawei' reference adapter
     * @param {string} adapterId Adapter ID (e.g. huawei, zte, dasan)
     * @returns {object} OLT adapter instance
     */
    getAdapter(adapterId) {
        const id = (adapterId || "").toLowerCase();
        if (this.adapters.has(id)) {
            return this.adapters.get(id);
        }
        return this.adapters.get("huawei");
    }

    /**
     * Auto-detect matching vendor adapter via SNMP sysObjectID or sysDescr
     * @param {string} sysObjectID SNMP sysObjectID
     * @param {string} sysDescr SNMP sysDescr
     * @returns {object} Matching vendor adapter
     */
    detectAdapter(sysObjectID, sysDescr) {
        for (const adapter of this.adapters.values()) {
            if (adapter.matchesDevice(sysObjectID, sysDescr)) {
                return adapter;
            }
        }
        return this.getAdapter("huawei");
    }

    /**
     * List all registered vendor adapters and capabilities
     * @returns {Array<object>} Adapters summary list
     */
    listAdapters() {
        return Array.from(this.adapters.values()).map((a) => ({
            id: a.id,
            name: a.name,
            vendor: a.vendor,
            models: a.models,
            capabilities: a.capabilities,
        }));
    }
}

const registry = new OltAdapterRegistry();
module.exports = registry;
