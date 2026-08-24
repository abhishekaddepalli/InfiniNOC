/**
 * Generic Vendor-Neutral MIB-II / IF-MIB OID Profile
 */
module.exports = {
    id: "generic",
    name: "Generic MIB-II / IF-MIB",
    description: "Standard RFC1213 / RFC2863 vendor-neutral MIB OIDs",

    oids: {
        sysDescr: ".1.3.6.1.2.1.1.1.0",
        sysUpTime: ".1.3.6.1.2.1.1.3.0",
        sysName: ".1.3.6.1.2.1.1.5.0",
        sysLocation: ".1.3.6.1.2.1.1.6.0",

        // Host Resources MIB
        hrProcessorLoad: ".1.3.6.1.2.1.25.3.3.1.2",
        hrMemorySize: ".1.3.6.1.2.1.25.2.2.0",
        hrStorageUsed: ".1.3.6.1.2.1.25.2.3.1.6",

        // IF-MIB Interface Table
        ifIndex: ".1.3.6.1.2.1.2.2.1.1",
        ifDescr: ".1.3.6.1.2.1.2.2.1.2",
        ifType: ".1.3.6.1.2.1.2.2.1.3",
        ifSpeed: ".1.3.6.1.2.1.2.2.1.5",
        ifOperStatus: ".1.3.6.1.2.1.2.2.1.8", // 1=up, 2=down, 3=testing
        ifInOctets: ".1.3.6.1.2.1.2.2.1.10",
        ifInUcastPkts: ".1.3.6.1.2.1.2.2.1.11",
        ifInErrors: ".1.3.6.1.2.1.2.2.1.14",
        ifOutOctets: ".1.3.6.1.2.1.2.2.1.16",
        ifOutUcastPkts: ".1.3.6.1.2.1.2.2.1.17",
        ifOutErrors: ".1.3.6.1.2.1.2.2.1.20",

        // High Capacity (64-bit) IF-MIB Counters
        ifHCInOctets: ".1.3.6.1.2.1.31.1.1.1.6",
        ifHCOutOctets: ".1.3.6.1.2.1.31.1.1.1.10",
    },

    /**
     * Transform raw SNMP varbinds into structured metric payload
     * @param {object} rawResults Raw OID value map
     * @returns {object} Standardized metric object
     */
    parseMetrics(rawResults) {
        const metrics = {
            uptime: rawResults[this.oids.sysUpTime] ? Math.floor(rawResults[this.oids.sysUpTime] / 100) : null,
            cpu: rawResults[this.oids.hrProcessorLoad] !== undefined ? Number(rawResults[this.oids.hrProcessorLoad]) : null,
            memory: rawResults[this.oids.hrStorageUsed] !== undefined ? Number(rawResults[this.oids.hrStorageUsed]) : null,
            temperature: rawResults["temperature"] !== undefined ? Number(rawResults["temperature"]) : null,
            interfaces: [],
        };

        if (rawResults.interfaces && Array.isArray(rawResults.interfaces)) {
            metrics.interfaces = rawResults.interfaces.map((iface) => ({
                index: iface.index || 1,
                name: iface.name || "eth0",
                status: iface.operStatus === 1 ? "up" : "down",
                inBps: iface.inOctets || 0,
                outBps: iface.outOctets || 0,
                errors: (iface.inErrors || 0) + (iface.outErrors || 0),
                packets: (iface.inPkts || 0) + (iface.outPkts || 0),
            }));
        }

        return metrics;
    },
};
