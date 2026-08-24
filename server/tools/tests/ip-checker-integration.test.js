const { ProviderRegistry } = require("../providers/provider-registry");

/**
 * Run integration test suite for 8.8.8.8, 1.1.1.1, and IPv6
 * @returns {Promise<void>}
 */
async function runIntegrationTests() {
    console.log("==================================================");
    console.log("RUNNING TOOLS V3 BACKEND IP CHECKER INTEGRATION TESTS");
    console.log("==================================================\n");

    let testPassCount = 0;

    // TEST 1: 8.8.8.8 (Google Public DNS)
    console.log("--- TEST 1: 8.8.8.8 (Google IPv4) ---");
    const res8 = await ProviderRegistry.fetchIpIntelligence("8.8.8.8", true);
    console.log("8.8.8.8 Result Summary:");
    console.log("  IP:", res8.ip);
    console.log("  ASN:", res8.network.asn.value, `[Source: ${res8.network.asn.source}]`);
    console.log("  ASN Name:", res8.network.asnName.value, `[Source: ${res8.network.asnName.source}]`);
    console.log("  Prefix:", res8.network.announcedPrefix.value, `[Source: ${res8.network.announcedPrefix.source}]`);
    console.log("  Country:", res8.location.country.value, `[Source: ${res8.location.country.source}]`);
    console.log("  PTR:", res8.identity.reverseDns.value, `[Source: ${res8.identity.reverseDns.source}]`);

    // Assertions for 8.8.8.8
    if (res8.ip !== "8.8.8.8") {
        throw new Error("Assertion Failed: IP is not 8.8.8.8");
    }
    if (!res8.network.asn.value || res8.network.asn.value !== "AS15169") {
        throw new Error(`Assertion Failed: Expected AS15169, got '${res8.network.asn.value}'`);
    }
    if (!res8.network.announcedPrefix.value || res8.network.announcedPrefix.value !== "8.8.8.0/24") {
        throw new Error(`Assertion Failed: Expected prefix 8.8.8.0/24, got '${res8.network.announcedPrefix.value}'`);
    }
    if (!res8.location.country.value) {
        throw new Error("Assertion Failed: Country value is missing");
    }
    console.log("✔ TEST 1 PASSED: 8.8.8.8 returns real network data\n");
    testPassCount++;

    // TEST 2: 1.1.1.1 (Cloudflare IPv4)
    console.log("--- TEST 2: 1.1.1.1 (Cloudflare IPv4) ---");
    const res1 = await ProviderRegistry.fetchIpIntelligence("1.1.1.1", true);
    console.log("1.1.1.1 Result Summary:");
    console.log("  IP:", res1.ip);
    console.log("  ASN:", res1.network.asn.value, `[Source: ${res1.network.asn.source}]`);
    console.log("  ASN Name:", res1.network.asnName.value, `[Source: ${res1.network.asnName.source}]`);
    console.log("  Prefix:", res1.network.announcedPrefix.value, `[Source: ${res1.network.announcedPrefix.source}]`);

    if (res1.network.asn.value !== "AS13335") {
        throw new Error(`Assertion Failed: Expected AS13335 for Cloudflare 1.1.1.1, got '${res1.network.asn.value}'`);
    }
    if (res1.network.asn.value === res8.network.asn.value) {
        throw new Error("Assertion Failed: 1.1.1.1 and 8.8.8.8 returned identical ASN!");
    }
    console.log("✔ TEST 2 PASSED: 1.1.1.1 differs appropriately from 8.8.8.8\n");
    testPassCount++;

    // TEST 3: 2001:4860:4860::8888 (Google IPv6)
    console.log("--- TEST 3: 2001:4860:4860::8888 (Google IPv6) ---");
    const resV6 = await ProviderRegistry.fetchIpIntelligence("2001:4860:4860::8888", true);
    console.log("IPv6 Result Summary:");
    console.log("  IP:", resV6.ip);
    console.log("  IP Version:", resV6.ipVersion);
    console.log("  ASN:", resV6.network.asn.value, `[Source: ${resV6.network.asn.source}]`);

    if (resV6.ipVersion !== "IPv6") {
        throw new Error("Assertion Failed: Expected IP Version IPv6");
    }
    if (resV6.network.asn.value !== "AS15169") {
        throw new Error(`Assertion Failed: Expected AS15169 for IPv6 2001:4860:4860::8888, got '${resV6.network.asn.value}'`);
    }
    console.log("✔ TEST 3 PASSED: IPv6 diagnostic execution succeeded\n");
    testPassCount++;

    console.log("==================================================");
    console.log(`ALL ${testPassCount} INTEGRATION TESTS PASSED CLEANLY!`);
    console.log("==================================================");
}

runIntegrationTests().catch(err => {
    console.error("❌ INTEGRATION TEST FAILED:", err.message);
    process.exit(1);
});
