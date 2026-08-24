class VendorCapabilityRegistry {
    /**
     *
     */
    constructor() {
        this.transports = {
            SNMP_V2C: "SNMP v2c",
            SNMP_V3: "SNMP v3",
            ROUTEROS_API: "RouterOS API",
            REST_API: "REST API",
            SSH_CLI: "SSH CLI",
        };

        this.capabilities = {
            MIKROTIK: {
                vendor: "MikroTik",
                supportedTransports: [
                    { transport: "SNMP_V2C", status: "ACTIVE", description: "Standard SNMP v2c polling (UDP 161)" },
                    { transport: "SNMP_V3", status: "SUPPORTED", description: "Encrypted SNMP v3 polling (AuthNoPriv/AuthPriv)" },
                    { transport: "ROUTEROS_API", status: "PLANNED", description: "Future RouterOS API driver (TCP 8728/8729)" },
                ],
                metrics: {
                    cpu: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.4.1.14988.1.1.1.3.1.1" },
                    memory: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.25.2.3" },
                    temperature: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.4.1.14988.1.1.1.3.10.0" },
                    uptime: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.1.3.0" },
                    interfaces: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.2.2" },
                    hc_traffic: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.31.1.1" },
                    pppoe_sessions: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.4.1.14988.1.1.1.6.0" },
                    simple_queues: { status: "CAPABILITY_READY", driver: "SNMP_V2C", oid: "1.3.6.1.4.1.14988.1.1.2.1" },
                    bgp_peers: { status: "CAPABILITY_READY", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.15.3" },
                    ospf_neighbors: { status: "CAPABILITY_READY", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.14.10" },
                },
            },
            GENERIC: {
                vendor: "Generic",
                supportedTransports: [
                    { transport: "SNMP_V2C", status: "ACTIVE", description: "Standard SNMP v2c polling" },
                ],
                metrics: {
                    cpu: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.25.3.3.1.2" },
                    memory: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.25.2.3" },
                    uptime: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.1.3.0" },
                    interfaces: { status: "ACTIVE", driver: "SNMP_V2C", oid: "1.3.6.1.2.1.2.2" },
                },
            },
        };
    }

    /**
     * Get capability matrix for a vendor
     * @param {string} vendorName Vendor name (e.g. MikroTik, Cisco, Generic)
     * @returns {object} Vendor capability schema
     */
    getVendorCapabilities(vendorName) {
        const vKey = (vendorName || "").toUpperCase();
        if (this.capabilities[vKey]) {
            return this.capabilities[vKey];
        }
        return this.capabilities.GENERIC;
    }
}

module.exports = new VendorCapabilityRegistry();
