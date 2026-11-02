const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
    getMonitorTargetDisplay,
    getMonitorProtocolLabel,
    formatTelemetryMessage,
} = require("../../src/util.js");

describe("InfiniNOC Target Display & Telemetry Diagnostic Resolver Test Suite", () => {
    describe("getMonitorTargetDisplay", () => {
        it("should return clean IP or hostname for Ping/ICMP without https:// prefix even if url field has default", () => {
            const monitorWithUrlDefault = {
                type: "ping",
                hostname: "192.168.1.1",
                url: "https://",
            };
            const result = getMonitorTargetDisplay(monitorWithUrlDefault);
            assert.strictEqual(result, "192.168.1.1");
            assert.ok(!result.startsWith("https://"), "Ping target must never start with https://");
        });

        it("should strip accidental https:// prefix from ping monitor url if hostname is absent", () => {
            const monitorAccidentalScheme = {
                type: "ping",
                url: "https://10.200.0.1",
            };
            const result = getMonitorTargetDisplay(monitorAccidentalScheme);
            assert.strictEqual(result, "10.200.0.1");
        });

        it("should format TCP port monitor with host:port", () => {
            const tcpMonitor = {
                type: "port",
                hostname: "db.internal.net",
                port: 5432,
            };
            const result = getMonitorTargetDisplay(tcpMonitor);
            assert.strictEqual(result, "db.internal.net:5432");
        });

        it("should format DNS query domain with record type", () => {
            const dnsMonitor = {
                type: "dns",
                hostname: "api.infiniforge.cloud",
                dns_resolve_type: "A",
            };
            const result = getMonitorTargetDisplay(dnsMonitor);
            assert.strictEqual(result, "[A] api.infiniforge.cloud");
        });

        it("should format SNMP target with host and community/version note", () => {
            const snmpMonitor = {
                type: "snmp",
                hostname: "172.16.0.1",
                port: 161,
            };
            const result = getMonitorTargetDisplay(snmpMonitor);
            assert.strictEqual(result, "172.16.0.1 (SNMP v2c)");
        });

        it("should format HTTP and HTTPS monitors preserving full URL", () => {
            const httpMonitor = {
                type: "http",
                url: "https://monitor.infiniforge.cloud/health",
            };
            const result = getMonitorTargetDisplay(httpMonitor);
            assert.strictEqual(result, "https://monitor.infiniforge.cloud/health");
        });
    });

    describe("getMonitorProtocolLabel", () => {
        it("should return correct badge labels for network protocols", () => {
            assert.strictEqual(getMonitorProtocolLabel("ping"), "ICMP / PING");
            assert.strictEqual(getMonitorProtocolLabel("port"), "TCP PORT");
            assert.strictEqual(getMonitorProtocolLabel("dns"), "DNS QUERY");
            assert.strictEqual(getMonitorProtocolLabel("snmp"), "SNMP TELEMETRY");
            assert.strictEqual(getMonitorProtocolLabel("http"), "HTTP / REST");
        });
    });

    describe("formatTelemetryMessage", () => {
        it("should never return '-' for an active heartbeat event", () => {
            const event = {
                status: 1,
                ping: 14.2,
                msg: "", // Empty or null message from legacy engine
            };
            const monitor = {
                type: "ping",
                hostname: "8.8.8.8",
            };

            const formatted = formatTelemetryMessage(event, monitor);
            assert.notStrictEqual(formatted, "-");
            assert.ok(formatted.length > 5, "Message must provide descriptive telemetry");
            assert.ok(formatted.includes("ICMP"), "Should identify ICMP protocol");
            assert.ok(formatted.includes("14.2 ms") || formatted.includes("14 ms"), "Should include roundtrip latency");
        });

        it("should provide meaningful outage message on down heartbeat event", () => {
            const event = {
                status: 0,
                msg: "",
            };
            const monitor = {
                type: "port",
                hostname: "10.0.0.1",
                port: 3306,
            };

            const formatted = formatTelemetryMessage(event, monitor);
            assert.notStrictEqual(formatted, "-");
            assert.ok(formatted.includes("failed") || formatted.includes("refused") || formatted.includes("DOWN"), "Should indicate failure");
        });

        it("should preserve rich diagnostic message when provided by backend", () => {
            const event = {
                status: 1,
                ping: 2.1,
                msg: "ICMP echo response received from 1.1.1.1. Latency: 2.1ms. Packet loss: 0%.",
            };
            const monitor = {
                type: "ping",
                hostname: "1.1.1.1",
            };

            const formatted = formatTelemetryMessage(event, monitor);
            assert.strictEqual(formatted, "ICMP echo response received from 1.1.1.1. Latency: 2.1ms. Packet loss: 0%.");
        });
    });
});
