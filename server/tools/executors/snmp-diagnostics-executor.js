const snmp = require("net-snmp");
const { R } = require("redbean-node");
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Real SNMP Network Infrastructure Diagnostic Executor
 * Retrieves system info, interface tables, routing tables, and ARP tables from authorized network devices.
 */
class SnmpDiagnosticsExecutor {
    /**
     * Execute SNMP Diagnostic
     * @param {object} params Diagnostic parameters
     * @param {string} params.queryType "device-info" | "interfaces" | "routes" | "arp"
     * @param {number} params.deviceId Optional Device ID from database
     * @param {string} params.host Hostname or IP
     * @param {string} params.community SNMP Community string (default: "public")
     * @param {string} params.version SNMP version ("v1" | "v2c")
     * @param {number} params.port SNMP UDP port (default: 161)
     * @param {number} params.organizationId Organization ID
     * @returns {Promise<object>} SNMP Diagnostic Result
     */
    static async execute({ queryType = "device-info", deviceId = null, host = null, community = "public", version = "v2c", port = 161, organizationId = 1 }) {
        let targetHost = host;
        let snmpCommunity = community || "public";
        let snmpPort = parseInt(port || 161, 10);
        let snmpVersion = version === "v1" ? snmp.Version1 : snmp.Version2c;
        let deviceName = null;

        // If deviceId is provided, load device credentials securely from database
        if (deviceId) {
            const orgId = parseInt(organizationId || 1, 10);
            const dev = await R.getRow("SELECT id, name, ip_address, snmp_community, snmp_port, snmp_version FROM device WHERE id = ? AND organization_id = ?", [deviceId, orgId]);
            if (dev) {
                targetHost = dev.ip_address;
                deviceName = dev.name;
                if (dev.snmp_community) snmpCommunity = dev.snmp_community;
                if (dev.snmp_port) snmpPort = dev.snmp_port;
                if (dev.snmp_version === "v1") snmpVersion = snmp.Version1;
            }
        }

        if (!targetHost || typeof targetHost !== "string" || !targetHost.trim()) {
            throw new Error("Target device IP or hostname is required.");
        }

        targetHost = targetHost.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];

        // Security / SSRF check: allow private targets ONLY if user has valid authorized deviceId or admin access
        const validation = await SsrfValidator.validateTarget(targetHost);
        if (!validation.safe && !deviceId) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "SNMP target is restricted by security policy. Use an authorized managed device.",
                host: targetHost,
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip || targetHost;

        switch (queryType) {
            case "interfaces":
                return await SnmpDiagnosticsExecutor.fetchInterfaces(resolvedIp, snmpCommunity, snmpPort, snmpVersion, deviceName || targetHost);
            case "routes":
                return await SnmpDiagnosticsExecutor.fetchRoutes(resolvedIp, snmpCommunity, snmpPort, snmpVersion, deviceName || targetHost);
            case "arp":
                return await SnmpDiagnosticsExecutor.fetchArp(resolvedIp, snmpCommunity, snmpPort, snmpVersion, deviceName || targetHost);
            case "device-info":
            default:
                return await SnmpDiagnosticsExecutor.fetchSystemInfo(resolvedIp, snmpCommunity, snmpPort, snmpVersion, deviceName || targetHost);
        }
    }

    /**
     * Fetch standard MIB-II System Group
     */
    static fetchSystemInfo(ip, community, port, version, label) {
        return new Promise((resolve) => {
            const session = snmp.createSession(ip, community, { port, version, timeout: 3000, retries: 1 });
            const oids = [
                "1.3.6.1.2.1.1.1.0", // sysDescr
                "1.3.6.1.2.1.1.2.0", // sysObjectID
                "1.3.6.1.2.1.1.3.0", // sysUpTime
                "1.3.6.1.2.1.1.4.0", // sysContact
                "1.3.6.1.2.1.1.5.0", // sysName
                "1.3.6.1.2.1.1.6.0", // sysLocation
            ];

            session.get(oids, (error, varbinds) => {
                session.close();
                if (error) {
                    resolve({
                        ok: false,
                        status: "SNMP_TIMEOUT",
                        error: `SNMP request failed: ${error.message} (verify community string & device reachability)`,
                        host: ip,
                        label,
                        checkedAt: new Date().toISOString(),
                    });
                    return;
                }

                const res = {
                    sysDescr: varbinds[0] && !snmp.isVarbindError(varbinds[0]) ? varbinds[0].value.toString() : "N/A",
                    sysObjectID: varbinds[1] && !snmp.isVarbindError(varbinds[1]) ? varbinds[1].value.toString() : "N/A",
                    sysUpTimeRaw: varbinds[2] && !snmp.isVarbindError(varbinds[2]) ? varbinds[2].value : 0,
                    sysContact: varbinds[3] && !snmp.isVarbindError(varbinds[3]) ? varbinds[3].value.toString() : "N/A",
                    sysName: varbinds[4] && !snmp.isVarbindError(varbinds[4]) ? varbinds[4].value.toString() : label,
                    sysLocation: varbinds[5] && !snmp.isVarbindError(varbinds[5]) ? varbinds[5].value.toString() : "N/A",
                };

                // Format uptime in days, hours, mins
                const seconds = Math.floor(Number(res.sysUpTimeRaw) / 100);
                const days = Math.floor(seconds / (3600 * 24));
                const hours = Math.floor((seconds % (3600 * 24)) / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                res.sysUpTimeFormatted = `${days}d ${hours}h ${minutes}m`;

                resolve({
                    ok: true,
                    status: "SUCCESS",
                    host: ip,
                    label,
                    system: res,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Walk ifTable and ifXTable for interface states
     */
    static fetchInterfaces(ip, community, port, version, label) {
        return new Promise((resolve) => {
            const session = snmp.createSession(ip, community, { port, version, timeout: 4000, retries: 1 });
            const ifaces = {};

            session.table("1.3.6.1.2.1.2.2.1", 20, (error, table) => {
                session.close();
                if (error) {
                    resolve({
                        ok: false,
                        status: "SNMP_FAILED",
                        error: `Interface table query failed: ${error.message}`,
                        host: ip,
                        label,
                        checkedAt: new Date().toISOString(),
                    });
                    return;
                }

                for (const idx in table) {
                    const row = table[idx];
                    const ifIndex = parseInt(idx, 10);
                    const descr = row[2] ? row[2].toString() : `Interface ${ifIndex}`;
                    const operStatus = row[8] === 1 ? "UP" : "DOWN";
                    const adminStatus = row[7] === 1 ? "UP" : "DOWN";
                    const speed = row[5] ? Number(row[5]) : 0;
                    const inOctets = row[10] ? Number(row[10]) : 0;
                    const outOctets = row[16] ? Number(row[16]) : 0;

                    ifaces[ifIndex] = {
                        index: ifIndex,
                        name: descr,
                        operStatus,
                        adminStatus,
                        speedBps: speed,
                        speedFormatted: speed >= 1000000000 ? `${speed / 1000000000} Gbps` : (speed >= 1000000 ? `${speed / 1000000} Mbps` : `${speed} bps`),
                        inOctets,
                        outOctets,
                    };
                }

                const list = Object.values(ifaces);
                resolve({
                    ok: true,
                    status: "SUCCESS",
                    host: ip,
                    label,
                    totalInterfaces: list.length,
                    upCount: list.filter((i) => i.operStatus === "UP").length,
                    interfaces: list,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Walk ipRouteTable for route table
     */
    static fetchRoutes(ip, community, port, version, label) {
        return new Promise((resolve) => {
            const session = snmp.createSession(ip, community, { port, version, timeout: 4000, retries: 1 });
            session.table("1.3.6.1.2.1.4.21.1", 50, (error, table) => {
                session.close();
                if (error) {
                    resolve({
                        ok: false,
                        status: "SNMP_FAILED",
                        error: `Routing table query failed: ${error.message}`,
                        host: ip,
                        label,
                        checkedAt: new Date().toISOString(),
                    });
                    return;
                }

                const routes = [];
                for (const idx in table) {
                    const row = table[idx];
                    routes.push({
                        destination: row[1] ? row[1].toString() : "0.0.0.0",
                        netmask: row[11] ? row[11].toString() : "0.0.0.0",
                        nextHop: row[7] ? row[7].toString() : "0.0.0.0",
                        ifIndex: row[2] ? Number(row[2]) : 0,
                        metric: row[3] ? Number(row[3]) : 0,
                        type: row[8] === 4 ? "INDIRECT (GATEWAY)" : (row[8] === 3 ? "DIRECT" : "OTHER"),
                    });
                }

                resolve({
                    ok: true,
                    status: "SUCCESS",
                    host: ip,
                    label,
                    totalRoutes: routes.length,
                    routes,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Walk ipNetToMediaTable for ARP entries
     */
    static fetchArp(ip, community, port, version, label) {
        return new Promise((resolve) => {
            const session = snmp.createSession(ip, community, { port, version, timeout: 4000, retries: 1 });
            session.table("1.3.6.1.2.1.4.22.1", 50, (error, table) => {
                session.close();
                if (error) {
                    resolve({
                        ok: false,
                        status: "SNMP_FAILED",
                        error: `ARP table query failed: ${error.message}`,
                        host: ip,
                        label,
                        checkedAt: new Date().toISOString(),
                    });
                    return;
                }

                const arpEntries = [];
                for (const idx in table) {
                    const row = table[idx];
                    let mac = "00:00:00:00:00:00";
                    if (row[2] && Buffer.isBuffer(row[2])) {
                        mac = Array.from(row[2]).map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
                    }

                    arpEntries.push({
                        ifIndex: row[1] ? Number(row[1]) : 0,
                        macAddress: mac,
                        ipAddress: row[3] ? row[3].toString() : "0.0.0.0",
                        type: row[4] === 3 ? "DYNAMIC" : (row[4] === 4 ? "STATIC" : "OTHER"),
                    });
                }

                resolve({
                    ok: true,
                    status: "SUCCESS",
                    host: ip,
                    label,
                    totalEntries: arpEntries.length,
                    arp: arpEntries,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }
}

module.exports = { SnmpDiagnosticsExecutor };
