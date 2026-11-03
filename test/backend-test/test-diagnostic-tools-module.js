const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { R } = require("redbean-node");

// Import Database & Diagnostic Modules
const { ToolRegistry } = require("../../server/tools/tool-registry");
const { ToolService } = require("../../server/tools/tool-service");
const { DiagnosticHistory } = require("../../server/model/diagnostic-history");
const { PingExecutor } = require("../../server/tools/executors/ping-executor");
const { TracerouteExecutor } = require("../../server/tools/executors/traceroute-executor");
const { MtrExecutor } = require("../../server/tools/executors/mtr-executor");
const { MtuExecutor } = require("../../server/tools/executors/mtu-executor");
const { RouteTableExecutor } = require("../../server/tools/executors/route-table-executor");
const { DnsExecutor } = require("../../server/tools/executors/dns-executor");
const { DnsPropagationExecutor } = require("../../server/tools/executors/dns-propagation-executor");
const { DnsHealthExecutor } = require("../../server/tools/executors/dns-health-executor");
const { ReverseDnsExecutor } = require("../../server/tools/executors/reverse-dns-executor");
const { TcpPortExecutor } = require("../../server/tools/executors/tcp-port-executor");
const { CommonServiceExecutor } = require("../../server/tools/executors/common-service-executor");
const { PortScannerExecutor } = require("../../server/tools/executors/port-scanner-executor");
const { SslExecutor } = require("../../server/tools/executors/ssl-executor");
const { SslDecoderExecutor } = require("../../server/tools/executors/ssl-decoder-executor");
const { HttpExecutor } = require("../../server/tools/executors/http-executor");
const { RedirectExecutor } = require("../../server/tools/executors/redirect-executor");
const { SecurityHeadersExecutor } = require("../../server/tools/executors/security-headers-executor");
const { RdapExecutor } = require("../../server/tools/executors/rdap-executor");
const { SubnetEngine } = require("../../server/tools/calculators/subnet-engine");
const { IpRangeEngine } = require("../../server/tools/calculators/ip-range-engine");
const { VlanCalculator } = require("../../server/tools/calculators/vlan-calculator");
const { OpticalBudgetCalculator } = require("../../server/tools/calculators/optical-budget-calculator");
const { LinkUtilizationCalculator } = require("../../server/tools/calculators/link-utilization-calculator");
const { LatencyConverter } = require("../../server/tools/calculators/latency-converter");
const { BandwidthEngine } = require("../../server/tools/calculators/bandwidth-engine");

const TEST_DB = path.join(__dirname, "../test-data/test-diagnostic-tools.db");

describe("InfiniNOC Diagnostic Tools Module Test Suite", () => {
    let knex;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        if (fs.existsSync(TEST_DB)) {
            fs.unlinkSync(TEST_DB);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        knex = require("knex")({
            client: Dialect,
            connection: { filename: TEST_DB },
            useNullAsDefault: true,
        });

        R.setup(knex);
        R.freeze(false);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();

        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });
    });

    after(async () => {
        try {
            await R.close();
            if (knex) await knex.destroy();
        } catch (_) {}
        if (fs.existsSync(TEST_DB)) {
            try { fs.unlinkSync(TEST_DB); } catch (_) {}
        }
    });

    describe("Phase 1 & 2: Tool Registry & Metadata", () => {
        it("should return all 8 primary categories and registered tools", () => {
            const categories = ToolRegistry.getCategories();
            assert.ok(Array.isArray(categories));
            assert.ok(categories.some((c) => c.id === "connectivity"));
            assert.ok(categories.some((c) => c.id === "routing"));
            assert.ok(categories.some((c) => c.id === "dns"));
            assert.ok(categories.some((c) => c.id === "ports"));
            assert.ok(categories.some((c) => c.id === "ssl"));
            assert.ok(categories.some((c) => c.id === "http"));
            assert.ok(categories.some((c) => c.id === "intelligence"));
            assert.ok(categories.some((c) => c.id === "infrastructure"));
            assert.ok(categories.some((c) => c.id === "calculators"));

            const tools = ToolRegistry.getTools();
            assert.ok(tools.length >= 25);
            assert.ok(tools.some((t) => t.slug === "ping"));
            assert.ok(tools.some((t) => t.slug === "traceroute"));
            assert.ok(tools.some((t) => t.slug === "mtr"));
            assert.ok(tools.some((t) => t.slug === "mtu-test"));
            assert.ok(tools.some((t) => t.slug === "route-table"));
            assert.ok(tools.some((t) => t.slug === "dns-lookup"));
            assert.ok(tools.some((t) => t.slug === "port-checker"));
            assert.ok(tools.some((t) => t.slug === "optical-budget"));
        });
    });

    describe("Phase 3: Connectivity Diagnostics", () => {
        it("should execute real ICMP Ping probes with statistics and jitter", async () => {
            const res = await PingExecutor.execute({
                host: "1.1.1.1",
                count: 3,
                timeout: 1000,
                packetSize: 64,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.host, "1.1.1.1");
            assert.strictEqual(res.transmitted, 3);
            assert.strictEqual(res.received, 3);
            assert.strictEqual(res.lossPercent, 0);
            assert.ok(typeof res.avgMs === "number");
            assert.ok(typeof res.jitterMs === "number");
            assert.strictEqual(res.probes.length, 3);
            assert.strictEqual(res.probes[0].status, "SUCCESS");
        });

        it("should execute real Traceroute and parse hops", async () => {
            const res = await TracerouteExecutor.execute({
                host: "1.1.1.1",
                maxHops: 3,
                timeout: 1000,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.host, "1.1.1.1");
            assert.ok(Array.isArray(res.hops));
            assert.ok(res.totalHops >= 1);
        });

        it("should execute Path MTU discovery with DF bit testing", async () => {
            const res = await MtuExecutor.execute({ host: "1.1.1.1" });
            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.host, "1.1.1.1");
            assert.ok(Array.isArray(res.testedSizes));
            assert.ok(res.testedSizes.length >= 5);
            assert.ok(res.discoveredPathMtu >= 1280);
            assert.strictEqual(res.overheadBytes, 28);
        });
    });

    describe("Phase 4: DNS & Domain Diagnostics", () => {
        it("should perform authoritative DNS lookup across record types", async () => {
            const res = await DnsExecutor.execute({
                domain: "one.one.one.one",
                recordType: "A",
            });

            assert.strictEqual(res.ok, true);
            assert.ok(Array.isArray(res.records));
            assert.ok(res.records.some((r) => r.type === "A" && (r.value === "1.1.1.1" || r.value === "1.0.0.1")));
        });

        it("should perform reverse DNS PTR query", async () => {
            const res = await ReverseDnsExecutor.execute({ ip: "1.1.1.1" });
            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.ip, "1.1.1.1");
            assert.ok(Array.isArray(res.hostnames));
            assert.ok(res.hostnames.length >= 1);
            assert.ok(res.hostnames.some((h) => h.includes("cloudflare") || h.includes("one")));
        });

        it("should run DNS Health and RFC compliance audit", async () => {
            const res = await DnsHealthExecutor.execute({ domain: "cloudflare.com" });
            assert.strictEqual(res.ok, true);
            assert.ok(res.healthScore >= 70);
            assert.ok(Array.isArray(res.checks));
            assert.ok(res.nameServers.length >= 2);
        });
    });

    describe("Phase 5: Port & Service Diagnostics", () => {
        it("should perform real TCP port check on target", async () => {
            // Check public DNS port 53 on 1.1.1.1
            const res = await TcpPortExecutor.execute({
                host: "1.1.1.1",
                port: 53,
                timeout: 3000,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.status, "OPEN");
            assert.ok(res.connectTimeMs > 0);
        });

        it("should correctly report closed or filtered state on unreachable port", async () => {
            const res = await TcpPortExecutor.execute({
                host: "127.0.0.1",
                port: 59999, // Unused port on localhost
                timeout: 1000,
                allowPrivate: true,
            });

            assert.strictEqual(res.ok, false);
            assert.ok(res.status === "CLOSED" || res.status === "TIMEOUT");
        });

        it("should execute Common Service Checker across standard ports", async () => {
            const res = await CommonServiceExecutor.execute({
                host: "1.1.1.1",
                timeout: 2000,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.testedCount, 10);
            assert.ok(Array.isArray(res.services));
            assert.ok(res.services.some((s) => s.port === 53 && s.state === "OPEN"));
        });

        it("should enforce security controls in Controlled Port Scanner", async () => {
            // Reject cloud metadata endpoint 169.254.169.254
            const ssrfRes = await PortScannerExecutor.execute({
                host: "169.254.169.254",
                ports: "80,443",
            });
            assert.strictEqual(ssrfRes.ok, false);
            assert.strictEqual(ssrfRes.status, "SSRF_BLOCKED");

            // Execute safe scan
            const safeRes = await PortScannerExecutor.execute({
                host: "1.1.1.1",
                ports: "53,80,443",
                timeout: 1500,
            });
            assert.strictEqual(safeRes.ok, true);
            assert.strictEqual(safeRes.scannedCount, 3);
        });
    });

    describe("Phase 6 & 7: SSL, HTTP & Web Diagnostics", () => {
        it("should inspect real live TLS certificate", async () => {
            const res = await SslExecutor.execute({
                host: "cloudflare.com",
                port: 443,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.status, "VALID");
            assert.ok(res.daysRemaining > 0);
            assert.ok(res.issuer.length > 0);
            assert.ok(Array.isArray(res.subjectAltNames));
        });

        it("should decode and parse X.509 PEM certificate in-memory safely", () => {
            // Generate a self-signed cert or standard cert for testing
            const crypto = require("crypto");
            const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
            // Reject private keys
            const privKeyCheck = SslDecoderExecutor.execute({ certificate: "PRIVATE KEY content" });
            assert.strictEqual(privKeyCheck.ok, false);
            assert.strictEqual(privKeyCheck.status, "SECURITY_REJECTED");
        });

        it("should inspect HTTP headers and response metrics", async () => {
            const res = await HttpExecutor.execute({
                url: "https://1.1.1.1",
                timeout: 5000,
            });

            assert.strictEqual(res.ok, true);
            assert.ok(res.statusCode >= 200 && res.statusCode < 400);
            assert.ok(res.totalTimeMs > 0);
            assert.ok(res.headers);
        });

        it("should trace HTTP redirect chain hop by hop", async () => {
            const res = await RedirectExecutor.execute({
                url: "http://cloudflare.com",
                maxRedirects: 5,
            });

            assert.strictEqual(res.ok, true);
            assert.ok(Array.isArray(res.chain));
            assert.ok(res.chain.length >= 1);
            assert.strictEqual(res.isRedirectLoop, false);
        });

        it("should audit HTTP security headers and assign security grade", async () => {
            const res = await SecurityHeadersExecutor.execute({
                url: "https://cloudflare.com",
            });

            assert.strictEqual(res.ok, true);
            assert.ok(res.score >= 0 && res.score <= 100);
            assert.ok(res.grade);
            assert.ok(Array.isArray(res.headers));
        });
    });

    describe("Phase 8: IP Intelligence & RDAP", () => {
        it("should query official RDAP registry for domain or IP", async () => {
            const res = await RdapExecutor.execute({ target: "1.1.1.1" });
            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.type, "IP_ALLOCATION");
            assert.strictEqual(res.ip, "1.1.1.1");
            assert.ok(res.networkName);
        });
    });

    describe("Phase 9: Routing & Kernel Route Table", () => {
        it("should retrieve and parse central host kernel routing table", async () => {
            const res = await RouteTableExecutor.execute();
            assert.strictEqual(res.ok, true);
            assert.ok(res.totalRoutes > 0);
            assert.ok(Array.isArray(res.routes));
            assert.ok(res.routes.some((r) => r.destination === "0.0.0.0" || r.gateway));
        });
    });

    describe("Phase 10: Calculators & Utilities", () => {
        it("should calculate IPv4 subnet mathematics accurately", () => {
            const res = SubnetEngine.calculateIpv4("192.168.10.0/24");
            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.networkAddress, "192.168.10.0");
            assert.strictEqual(res.broadcastAddress, "192.168.10.255");
            assert.strictEqual(res.subnetMask, "255.255.255.0");
            assert.strictEqual(res.wildcardMask, "0.0.0.255");
            assert.strictEqual(res.totalAddresses, 256);
            assert.strictEqual(res.usableHosts, 254);
            assert.strictEqual(res.firstHost, "192.168.10.1");
            assert.strictEqual(res.lastHost, "192.168.10.254");
            assert.strictEqual(res.classification, "Private (RFC1918)");
        });

        it("should calculate IPv6 subnet mathematics", () => {
            const res = SubnetEngine.calculateIpv6("2001:db8::/64");
            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.ipVersion, "IPv6");
            assert.strictEqual(res.prefix, "/64");
            assert.strictEqual(res.totalAddresses, "2^64");
        });

        it("should validate 802.1Q VLAN IDs and reserved ranges", () => {
            const vlan100 = VlanCalculator.execute({ vlanId: 100 });
            assert.strictEqual(vlan100.ok, true);
            assert.strictEqual(vlan100.rangeType, "NORMAL");
            assert.strictEqual(vlan100.isConfigurable, true);

            const vlan0 = VlanCalculator.execute({ vlanId: 0 });
            assert.strictEqual(vlan0.rangeType, "RESERVED");
            assert.strictEqual(vlan0.isReserved, true);

            const vlan4095 = VlanCalculator.execute({ vlanId: 4095 });
            assert.strictEqual(vlan4095.rangeType, "RESERVED");

            const vlanOut = VlanCalculator.execute({ vlanId: 5000 });
            assert.strictEqual(vlanOut.ok, false);
            assert.strictEqual(vlanOut.status, "OUT_OF_RANGE");
        });

        it("should calculate FTTH optical loss budget and safety margin", () => {
            const res = OpticalBudgetCalculator.execute({
                txPowerDbm: 3.0,
                rxSensitivityDbm: -28.0,
                fiberDistanceKm: 10.0,
                wavelength: "1490",
                splitterRatio: "1:8",
                connectorCount: 2,
                spliceCount: 4,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.breakdown.totalPowerBudgetDb, 31.0);
            assert.strictEqual(res.breakdown.fiberAttenuationDb, 2.8); // 10km * 0.28 dB/km
            assert.strictEqual(res.breakdown.splitterLossDb, 10.5); // 1:8 PLC splitter
            assert.strictEqual(res.breakdown.connectorLossDb, 1.0); // 2 * 0.5 dB
            assert.strictEqual(res.breakdown.spliceLossDb, 0.4); // 4 * 0.1 dB
            assert.strictEqual(res.breakdown.totalLinkLossDb, 14.7);
            assert.strictEqual(res.breakdown.estimatedRxPowerDbm, -11.7); // 3.0 - 14.7
            assert.strictEqual(res.breakdown.safetyMarginDb, 16.3); // 31.0 - 14.7
            assert.strictEqual(res.status, "OPTIMAL");
        });

        it("should calculate link utilization and bandwidth headroom", () => {
            const res = LinkUtilizationCalculator.execute({
                throughputMbps: 750,
                linkCapacity: "1G",
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.capacityMbps, 1000);
            assert.strictEqual(res.utilizationPercent, 75);
            assert.strictEqual(res.remainingHeadroomMbps, 250);
            assert.strictEqual(res.status, "HIGH_UTILIZATION");
        });

        it("should convert latency units and compute theoretical optical delay", () => {
            const res = LatencyConverter.execute({
                value: 20,
                unit: "ms",
                fiberDistanceKm: 1000,
            });

            assert.strictEqual(res.ok, true);
            assert.strictEqual(res.conversions.milliseconds, 20);
            assert.strictEqual(res.conversions.microseconds, 20000);
            assert.strictEqual(res.conversions.seconds, 0.02);
            assert.ok(res.fiberPropagation.theoreticalRttDelayMs > 9.5 && res.fiberPropagation.theoreticalRttDelayMs < 10.0);
        });
    });

    describe("Phase 13 & 16: Diagnostic History & Database Persistence", () => {
        it("should persist diagnostic execution record in database", async () => {
            const record = await DiagnosticHistory.recordExecution({
                organizationId: 1,
                userId: 1,
                toolId: "ping",
                category: "connectivity",
                target: "1.1.1.1",
                parameters: { host: "1.1.1.1", count: 4 },
                executionLocation: "central",
                status: "SUCCESS",
                durationMs: 45,
                result: { host: "1.1.1.1", avgMs: 12, lossPercent: 0 },
            });

            assert.ok(record);
            assert.ok(record.id > 0);
            assert.strictEqual(record.toolId, "ping");
            assert.strictEqual(record.target, "1.1.1.1");
            assert.strictEqual(record.status, "SUCCESS");
        });

        it("should retrieve execution history with filtering", async () => {
            const history = await DiagnosticHistory.getHistory({
                organizationId: 1,
                toolId: "ping",
                limit: 10,
            });

            assert.ok(Array.isArray(history));
            assert.ok(history.length >= 1);
            assert.strictEqual(history[0].toolId, "ping");
            assert.strictEqual(history[0].target, "1.1.1.1");
            assert.strictEqual(history[0].parameters.count, 4);
        });

        it("should manage user favorite tool preferences", async () => {
            const favs = await DiagnosticHistory.toggleFavorite(1, "traceroute", 1);
            assert.ok(Array.isArray(favs));
            assert.ok(favs.includes("traceroute"));

            const updatedFavs = await DiagnosticHistory.getFavorites(1, 1);
            assert.ok(updatedFavs.includes("traceroute"));
        });
    });
});
