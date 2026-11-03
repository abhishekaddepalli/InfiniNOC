const { SsrfValidator } = require("./security/ssrf-validator");
const { ProviderRegistry } = require("./providers/provider-registry");
const { TcpPortExecutor } = require("./executors/tcp-port-executor");
const { CommonServiceExecutor } = require("./executors/common-service-executor");
const { PortScannerExecutor } = require("./executors/port-scanner-executor");
const { SubnetEngine } = require("./calculators/subnet-engine");
const { IpRangeEngine } = require("./calculators/ip-range-engine");
const { OuiService } = require("./services/oui-service");
const { DnsExecutor } = require("./executors/dns-executor");
const { ReverseDnsExecutor } = require("./executors/reverse-dns-executor");
const { DnsPropagationExecutor } = require("./executors/dns-propagation-executor");
const { DnsHealthExecutor } = require("./executors/dns-health-executor");
const { PingExecutor } = require("./executors/ping-executor");
const { TracerouteExecutor } = require("./executors/traceroute-executor");
const { MtrExecutor } = require("./executors/mtr-executor");
const { MtuExecutor } = require("./executors/mtu-executor");
const { RouteTableExecutor } = require("./executors/route-table-executor");
const { HttpExecutor } = require("./executors/http-executor");
const { RedirectExecutor } = require("./executors/redirect-executor");
const { SecurityHeadersExecutor } = require("./executors/security-headers-executor");
const { SslExecutor } = require("./executors/ssl-executor");
const { SslCiphersExecutor } = require("./executors/ssl-ciphers-executor");
const { SslDecoderExecutor } = require("./executors/ssl-decoder-executor");
const { AsnProvider } = require("./providers/asn-provider");
const { RblProvider } = require("./providers/rbl-provider");
const { RdapExecutor } = require("./executors/rdap-executor");
const { SnmpDiagnosticsExecutor } = require("./executors/snmp-diagnostics-executor");
const { BandwidthEngine } = require("./calculators/bandwidth-engine");
const { VlanCalculator } = require("./calculators/vlan-calculator");
const { OpticalBudgetCalculator } = require("./calculators/optical-budget-calculator");
const { LinkUtilizationCalculator } = require("./calculators/link-utilization-calculator");
const { LatencyConverter } = require("./calculators/latency-converter");
const { DiagnosticHistory } = require("../model/diagnostic-history");
const { ToolRegistry } = require("./tool-registry");
const { log } = require("../../src/util");

/**
 * Central InfiniNOC Tool Execution Service
 */
class ToolService {
    /**
     * Dispatch tool execution request to appropriate engine and record history
     * @param {string} slug Tool identifier slug
     * @param {object} params Execution parameters
     * @param {object} context Context containing userId and organizationId
     * @returns {Promise<object>} Diagnostic Result Object
     */
    static async execute(slug, params = {}, context = {}) {
        if (!slug) {
            throw new Error("Tool slug identifier is required.");
        }

        const start = Date.now();
        let result;

        switch (slug) {
            // Connectivity
            case "ping":
                result = await PingExecutor.execute(params);
                break;
            case "traceroute":
                result = await TracerouteExecutor.execute(params);
                break;
            case "mtr":
                result = await MtrExecutor.execute(params);
                break;
            case "mtu-test":
                result = await MtuExecutor.execute(params);
                break;

            // Routing
            case "route-table":
                result = await RouteTableExecutor.execute();
                break;

            // DNS & Domain
            case "dns-lookup":
                result = await DnsExecutor.execute(params);
                break;
            case "dns-propagation":
                result = await DnsPropagationExecutor.execute(params);
                break;
            case "reverse-dns":
                result = await ReverseDnsExecutor.execute(params);
                break;
            case "dns-health":
                result = await DnsHealthExecutor.execute(params);
                break;

            // Port & Service
            case "port-checker":
                result = await TcpPortExecutor.execute(params);
                break;
            case "common-services":
                result = await CommonServiceExecutor.execute(params);
                break;
            case "port-scanner":
                result = await PortScannerExecutor.execute(params);
                break;

            // SSL & Security
            case "ssl-checker":
                result = await SslExecutor.execute(params);
                break;
            case "ssl-ciphers":
                result = await SslCiphersExecutor.execute(params);
                break;
            case "ssl-decoder":
                result = SslDecoderExecutor.execute(params);
                break;

            // HTTP & Web
            case "http-checker":
                result = await HttpExecutor.execute(params);
                break;
            case "redirect-checker":
                result = await RedirectExecutor.execute(params);
                break;
            case "security-headers":
                result = await SecurityHeadersExecutor.execute(params);
                break;

            // IP Intelligence
            case "ip-checker":
                result = await this.executeIpChecker(params);
                break;
            case "rdap-lookup":
                result = await RdapExecutor.execute(params);
                break;
            case "ip-reputation":
                result = await this.executeIpReputation(params);
                break;
            case "asn-lookup":
                result = await this.executeAsnLookup(params);
                break;

            // SNMP & Network Infrastructure
            case "snmp-device":
                result = await SnmpDiagnosticsExecutor.execute({ queryType: "device-info", ...params, organizationId: context.organizationId || 1 });
                break;
            case "snmp-interfaces":
                result = await SnmpDiagnosticsExecutor.execute({ queryType: "interfaces", ...params, organizationId: context.organizationId || 1 });
                break;
            case "snmp-routes":
                result = await SnmpDiagnosticsExecutor.execute({ queryType: "routes", ...params, organizationId: context.organizationId || 1 });
                break;
            case "snmp-arp":
                result = await SnmpDiagnosticsExecutor.execute({ queryType: "arp", ...params, organizationId: context.organizationId || 1 });
                break;

            // Calculators & Utilities
            case "subnet-calculator":
            case "cidr-calculator":
                result = this.executeSubnetCalculator(params);
                break;
            case "ip-range-calculator":
                result = this.executeIpRangeCalculator(params);
                break;
            case "vlan-calculator":
                result = VlanCalculator.execute(params);
                break;
            case "optical-budget":
                result = OpticalBudgetCalculator.execute(params);
                break;
            case "link-utilization":
                result = LinkUtilizationCalculator.execute(params);
                break;
            case "latency-converter":
                result = LatencyConverter.execute(params);
                break;
            case "bandwidth-calculator":
                result = this.executeBandwidthCalculator(params);
                break;
            case "mac-lookup":
                result = this.executeMacLookup(params);
                break;

            default:
                throw new Error(`Tool execution for '${slug}' is unknown.`);
        }

        const durationMs = Date.now() - start;
        const toolMeta = ToolRegistry.getToolBySlug(slug);

        // Record execution asynchronously in database
        const targetSummary = params.target || params.host || params.domain || params.ip || params.cidr || params.url || params.vlanId || params.throughputMbps || "";
        DiagnosticHistory.recordExecution({
            organizationId: context.organizationId || 1,
            userId: context.userId || null,
            toolId: slug,
            category: toolMeta ? toolMeta.category : "general",
            target: String(targetSummary).substring(0, 255),
            parameters: params,
            executionLocation: params.probeId ? `probe:${params.probeId}` : (result && result.executionLocation ? result.executionLocation : "central"),
            probeId: params.probeId || null,
            status: result && result.ok ? (result.status || "SUCCESS") : (result && result.status ? result.status : "FAILED"),
            durationMs: result && result.totalDurationMs ? result.totalDurationMs : durationMs,
            result,
            errorMessage: result && !result.ok ? (result.error || result.message) : null,
        }).catch((err) => {
            log.error("tool-service", `Failed to record history: ${err.message}`);
        });

        return result;
    }

    /**
     * Execute Multi-Provider IP Intelligence
     */
    static async executeIpChecker(params) {
        const target = params.target || params.host || params.ip || "8.8.8.8";
        const refresh = Boolean(params.refresh);

        const validation = await SsrfValidator.validateTarget(target);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target address is restricted by security policy.",
                target,
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip;
        try {
            const mergedResult = await ProviderRegistry.fetchIpIntelligence(resolvedIp, refresh);
            return {
                ok: true,
                status: "SUCCESS",
                target,
                resolvedIp,
                ...mergedResult,
                executionLocation: "central",
                checkedAt: new Date().toISOString(),
            };
        } catch (error) {
            return {
                ok: false,
                status: "PROVIDER_ERROR",
                error: error.message || "Failed to fetch IP intelligence.",
                target,
                resolvedIp,
                checkedAt: new Date().toISOString(),
            };
        }
    }

    /**
     * Subnet calculation dispatch
     */
    static executeSubnetCalculator(params) {
        const cidr = params.cidr || params.target || "192.168.1.0/24";
        if (cidr.includes(":") || (params.ipVersion && params.ipVersion === "IPv6")) {
            return SubnetEngine.calculateIpv6(cidr);
        }
        return SubnetEngine.calculateIpv4(cidr);
    }

    /**
     * IP range calculation dispatch
     */
    static executeIpRangeCalculator(params) {
        const startIp = params.startIp || params.start || "192.168.1.1";
        const endIp = params.endIp || params.end || "192.168.1.50";
        return IpRangeEngine.calculate(startIp, endIp);
    }

    /**
     * MAC vendor lookup dispatch
     */
    static executeMacLookup(params) {
        const mac = params.mac || params.target || "00:50:56:00:00:00";
        return OuiService.lookup(mac);
    }

    /**
     * Bandwidth calculation dispatch
     */
    static executeBandwidthCalculator(params) {
        const fileSizeMB = params.fileSizeMB || params.fileSize || 1024;
        return BandwidthEngine.calculate(fileSizeMB);
    }

    /**
     * ASN BGP details lookup
     */
    static async executeAsnLookup(params) {
        const asn = params.asn || params.target || "13335";
        return await AsnProvider.fetchAsnDetails(asn);
    }

    /**
     * IP reputation and threat score lookup
     */
    static async executeIpReputation(params) {
        const target = params.target || params.ip || params.host || "1.1.1.1";
        const validation = await SsrfValidator.validateTarget(target);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target IP is restricted by security policy.",
                target,
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip;
        const rblResult = await RblProvider.checkBlacklists(resolvedIp);
        const listedCount = rblResult.filter((r) => r.listed).length;

        let threatScore = Math.min(100, listedCount * 25);
        let reputationStatus = "CLEAN";

        if (threatScore >= 50) {
            reputationStatus = "HIGH_RISK";
        } else if (threatScore > 0) {
            reputationStatus = "SUSPICIOUS";
        }

        return {
            ok: true,
            status: reputationStatus,
            target,
            ip: resolvedIp,
            threatScore,
            totalBlacklistsChecked: rblResult.length,
            blacklistsListedCount: listedCount,
            rblChecks: rblResult,
            executionLocation: "central",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { ToolService };
