const { SsrfValidator } = require("./security/ssrf-validator");
const { ProviderRegistry } = require("./providers/provider-registry");
const { TcpPortExecutor } = require("./executors/tcp-port-executor");
const { SubnetEngine } = require("./calculators/subnet-engine");
const { IpRangeEngine } = require("./calculators/ip-range-engine");
const { OuiService } = require("./services/oui-service");
const { DnsExecutor } = require("./executors/dns-executor");
const { ReverseDnsExecutor } = require("./executors/reverse-dns-executor");
const { PingExecutor } = require("./executors/ping-executor");
const { TracerouteExecutor } = require("./executors/traceroute-executor");
const { HttpExecutor } = require("./executors/http-executor");
const { SslExecutor } = require("./executors/ssl-executor");
const { AsnProvider } = require("./providers/asn-provider");
const { RblProvider } = require("./providers/rbl-provider");
const { BandwidthEngine } = require("./calculators/bandwidth-engine");
const { DnsPropagationExecutor } = require("./executors/dns-propagation-executor");
const { SslCiphersExecutor } = require("./executors/ssl-ciphers-executor");
const { SecurityHeadersExecutor } = require("./executors/security-headers-executor");
const { log } = require("../../src/util");

/**
 * Central InfiniNOC Tool Execution Service
 */
class ToolService {
    /**
     * Dispatch tool execution request to appropriate engine
     * @param {string} slug Tool identifier slug
     * @param {object} params Execution parameters
     * @returns {Promise<object>} Diagnostic Result Object
     */
    static async execute(slug, params = {}) {
        if (!slug) {
            throw new Error("Tool slug identifier is required.");
        }

        switch (slug) {
            case "ip-checker":
                return await this.executeIpChecker(params);
            case "port-checker":
                return await this.executePortChecker(params);
            case "subnet-calculator":
            case "cidr-calculator":
                return this.executeSubnetCalculator(params);
            case "ip-range-calculator":
                return this.executeIpRangeCalculator(params);
            case "mac-lookup":
                return this.executeMacLookup(params);
            case "dns-lookup":
                return await this.executeDnsLookup(params);
            case "reverse-dns":
                return await this.executeReverseDns(params);
            case "ping":
                return await this.executePing(params);
            case "traceroute":
                return await this.executeTraceroute(params);
            case "http-checker":
                return await this.executeHttpChecker(params);
            case "ssl-checker":
                return await this.executeSslChecker(params);
            case "asn-lookup":
                return await this.executeAsnLookup(params);
            case "ip-reputation":
                return await this.executeIpReputation(params);
            case "bandwidth-calculator":
                return this.executeBandwidthCalculator(params);
            case "dns-propagation":
                return await DnsPropagationExecutor.execute(params);
            case "ssl-ciphers":
                return await SslCiphersExecutor.execute(params);
            case "security-headers":
                return await SecurityHeadersExecutor.execute(params);
            default:
                throw new Error(`Tool execution for '${slug}' is unknown.`);
        }
    }

    /**
     * Execute Real IP Intelligence Checker V3
     * @param {object} params Parameter object containing target & refresh flag
     * @returns {Promise<object>} Merged Real IP Intelligence Result with Provenance
     */
    static async executeIpChecker(params) {
        const target = params.target || params.host || params.ip || "8.8.8.8";
        const refresh = Boolean(params.refresh);
        log.info("tools-v3", `Executing Multi-Provider IP Intelligence for '${target}' (refresh=${refresh})`);

        const validation = await SsrfValidator.validateTarget(target);
        if (!validation.safe) {
            return {
                ok: false,
                error: validation.reason || "Target address is restricted by security policy.",
                target,
                checkedAt: new Date().toISOString(),
            };
        }

        const resolvedIp = validation.ip;

        try {
            const mergedResult = await ProviderRegistry.fetchIpIntelligence(resolvedIp, refresh);
            return {
                targetInput: target,
                resolvedIp,
                providerHealth: ProviderRegistry.getHealthSnapshot(),
                ...mergedResult,
            };
        } catch (error) {
            return {
                ok: false,
                error: `Data unavailable: ${error.message}`,
                targetInput: target,
                resolvedIp,
                checkedAt: new Date().toISOString(),
            };
        }
    }

    /**
     * Execute Real TCP Port Checker
     * @param {object} params Parameters { host, port, protocol, timeout }
     * @returns {Promise<object>} Real Port Test Result
     */
    static async executePortChecker(params) {
        const host = params.host || params.target || "1.1.1.1";
        let port = params.port;

        if (!port && typeof host === "string" && host.includes(":")) {
            const parts = host.split(":");
            params.host = parts[0];
            port = parseInt(parts[1], 10);
        }

        port = parseInt(port || 80, 10);
        const protocol = (params.protocol || "TCP").toUpperCase();
        const timeout = parseInt(params.timeout || 5000, 10);

        log.info("tools-engine", `Executing Real TCP Port Checker for '${params.host || host}:${port}'`);

        return await TcpPortExecutor.execute({
            host: params.host || host,
            port,
            protocol,
            timeout,
        });
    }

    /**
     * Execute Deterministic Subnet & CIDR Calculator
     * @param {object} params Parameters { cidr }
     * @returns {object} Subnet calculation result
     */
    static executeSubnetCalculator(params) {
        const cidr = params.cidr || params.target || "192.168.10.0/24";
        log.info("tools-engine", `Executing Subnet Calculator for '${cidr}'`);

        if (cidr.includes(":")) {
            return SubnetEngine.calculateIpv6(cidr);
        }
        return SubnetEngine.calculateIpv4(cidr);
    }

    /**
     * Execute Deterministic IP Range Calculator
     * @param {object} params Parameters { startIp, endIp }
     * @returns {object} IP Range calculation result
     */
    static executeIpRangeCalculator(params) {
        const startIp = params.startIp || "10.0.0.1";
        const endIp = params.endIp || "10.0.0.254";
        log.info("tools-engine", `Executing IP Range Calculator from '${startIp}' to '${endIp}'`);

        return IpRangeEngine.calculateRange(startIp, endIp);
    }

    /**
     * Execute Authentic IEEE MAC / OUI Vendor Lookup
     * @param {object} params Parameters { mac }
     * @returns {object} MAC OUI Lookup result
     */
    static executeMacLookup(params) {
        const mac = params.mac || params.target || "00:1A:2B:12:34:56";
        log.info("tools-engine", `Executing MAC OUI Lookup for '${mac}'`);

        return OuiService.lookupMac(mac);
    }

    /**
     * Execute Authentic Real DNS Lookup
     * @param {object} params Parameters { domain, recordType, resolver }
     * @returns {Promise<object>} DNS query result
     */
    static async executeDnsLookup(params) {
        const domain = params.domain || params.target || "example.com";
        const recordType = params.recordType || "ALL";
        const resolver = params.resolver || "system";
        log.info("tools-engine", `Executing Real DNS Lookup for '${domain}' (${recordType}) via ${resolver}`);

        return await DnsExecutor.execute({ domain, recordType, resolver });
    }

    /**
     * Execute Authentic Reverse DNS (PTR) Lookup
     * @param {object} params Parameters { ip }
     * @returns {Promise<object>} Reverse DNS query result
     */
    static async executeReverseDns(params) {
        const ip = params.ip || params.target || "8.8.8.8";
        log.info("tools-engine", `Executing Real Reverse DNS for '${ip}'`);

        return await ReverseDnsExecutor.execute(ip);
    }

    /**
     * Execute Real Ping Diagnostic Probe
     * @param {object} params Parameters { host, count, timeout }
     * @returns {Promise<object>} Ping result
     */
    static async executePing(params) {
        const host = params.host || params.target || "1.1.1.1";
        const count = params.count || 4;
        log.info("tools-engine", `Executing Real Ping Probe for '${host}' (${count} probes)`);

        return await PingExecutor.execute({ host, count, timeout: params.timeout });
    }

    /**
     * Execute Real Network Traceroute
     * @param {object} params Parameters { host, maxHops }
     * @returns {Promise<object>} Traceroute result
     */
    static async executeTraceroute(params) {
        const host = params.host || params.target || "8.8.8.8";
        log.info("tools-engine", `Executing Real Traceroute for '${host}'`);

        return await TracerouteExecutor.execute({ host, maxHops: params.maxHops });
    }

    /**
     * Execute Real HTTP/HTTPS Response Diagnostic
     * @param {object} params Parameters { url, method, timeout }
     * @returns {Promise<object>} HTTP diagnostic result
     */
    static async executeHttpChecker(params) {
        const url = params.url || params.target || "https://httpbin.org/get";
        log.info("tools-engine", `Executing Real HTTP Checker for '${url}'`);

        return await HttpExecutor.execute({ url, method: params.method, timeout: params.timeout });
    }

    /**
     * Execute Real SSL Certificate Handshake Inspection
     * @param {object} params Parameters { host, port }
     * @returns {Promise<object>} SSL certificate result
     */
    static async executeSslChecker(params) {
        const host = params.host || params.target || "google.com";
        const port = params.port || 443;
        log.info("tools-engine", `Executing Real SSL Checker for '${host}:${port}'`);

        return await SslExecutor.execute({ host, port });
    }

    /**
     * Execute Authentic ASN BGP Routing Lookup
     * @param {object} params Parameters { asn }
     * @returns {Promise<object>} ASN result
     */
    static async executeAsnLookup(params) {
        const asn = params.asn || params.target || "AS15169";
        log.info("tools-engine", `Executing Real ASN Lookup for '${asn}'`);

        return await AsnProvider.fetchAsnDetails(asn);
    }

    /**
     * Execute Real DNSBL Blacklist Reputation Check
     * @param {object} params Parameters { ip }
     * @returns {Promise<object>} Reputation result
     */
    static async executeIpReputation(params) {
        const ip = params.ip || params.target || "8.8.8.8";
        log.info("tools-engine", `Executing IP Reputation Check for '${ip}'`);

        return await RblProvider.checkReputation(ip);
    }

    /**
     * Execute Deterministic Bandwidth Transfer Calculation
     * @param {object} params Parameters { fileSize, sizeUnit }
     * @returns {object} Bandwidth calculation result
     */
    static executeBandwidthCalculator(params) {
        const fileSize = params.fileSize || 1;
        const sizeUnit = params.sizeUnit || "GB";
        log.info("tools-engine", `Executing Bandwidth Calculator for '${fileSize} ${sizeUnit}'`);

        return BandwidthEngine.calculateTransfer({ fileSize, sizeUnit });
    }
}

module.exports = { ToolService };
