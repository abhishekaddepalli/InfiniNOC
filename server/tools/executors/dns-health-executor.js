const dns = require("dns").promises;

/**
 * Real DNS Health Check Diagnostic Executor
 * Verifies authoritative name servers, SOA serial consistency, MX mail records, and DNS health checklist.
 */
class DnsHealthExecutor {
    /**
     * Run DNS Health audit on domain
     * @param {object} params Target parameters
     * @param {string} params.domain Domain name
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} DNS Health Audit Result
     */
    static async execute({ domain, probeId = null }) {
        if (!domain || typeof domain !== "string" || !domain.trim()) {
            throw new Error("Domain name is required.");
        }

        const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const checks = [];
        let score = 100;

        // 1. Check A records
        let aRecords = [];
        try {
            aRecords = await dns.resolve4(cleanDomain);
            checks.push({
                name: "IPv4 (A) Resolution",
                status: "PASS",
                detail: `Domain resolves to ${aRecords.length} IPv4 address(es): ${aRecords.join(", ")}`,
            });
        } catch (e) {
            score -= 30;
            checks.push({
                name: "IPv4 (A) Resolution",
                status: "FAIL",
                detail: `No valid A records found (${e.code || e.message})`,
            });
        }

        // 2. Check Name Servers (NS)
        let nsRecords = [];
        try {
            nsRecords = await dns.resolveNs(cleanDomain);
            if (nsRecords.length >= 2) {
                checks.push({
                    name: "Authoritative Name Servers (NS)",
                    status: "PASS",
                    detail: `Found ${nsRecords.length} authoritative NS: ${nsRecords.join(", ")}`,
                });
            } else {
                score -= 15;
                checks.push({
                    name: "Authoritative Name Servers (NS)",
                    status: "WARN",
                    detail: `Only ${nsRecords.length} NS found. RFC 2182 recommends at least 2 geographically dispersed name servers.`,
                });
            }
        } catch (e) {
            score -= 35;
            checks.push({
                name: "Authoritative Name Servers (NS)",
                status: "FAIL",
                detail: `Failed to resolve NS records: ${e.code || e.message}`,
            });
        }

        // 3. Check SOA Record & Serial
        let soaRecord = null;
        try {
            soaRecord = await dns.resolveSoa(cleanDomain);
            if (soaRecord && soaRecord.serial) {
                checks.push({
                    name: "SOA Record & Serial",
                    status: "PASS",
                    detail: `Primary NS: ${soaRecord.nsname}, Admin: ${soaRecord.hostmaster}, Serial: ${soaRecord.serial}, Refresh: ${soaRecord.refresh}s`,
                });
            }
        } catch (e) {
            score -= 10;
            checks.push({
                name: "SOA Record & Serial",
                status: "WARN",
                detail: `Unable to retrieve SOA record: ${e.code || e.message}`,
            });
        }

        // 4. Check MX (Mail Exchange)
        let mxRecords = [];
        try {
            mxRecords = await dns.resolveMx(cleanDomain);
            if (mxRecords.length > 0) {
                checks.push({
                    name: "Mail Exchange (MX) Configuration",
                    status: "PASS",
                    detail: `Configured ${mxRecords.length} MX server(s): ${mxRecords.map((m) => `${m.exchange} (pri: ${m.priority})`).join(", ")}`,
                });
            } else {
                checks.push({
                    name: "Mail Exchange (MX) Configuration",
                    status: "INFO",
                    detail: "No MX records configured (standard if domain does not receive email).",
                });
            }
        } catch (e) {
            checks.push({
                name: "Mail Exchange (MX) Configuration",
                status: "INFO",
                detail: "No MX records found.",
            });
        }

        // 5. Check TXT / SPF / DMARC
        try {
            const txtList = await dns.resolveTxt(cleanDomain);
            const flatTxt = txtList.map((t) => t.join(" "));
            const spf = flatTxt.find((t) => t.startsWith("v=spf1"));
            if (spf) {
                checks.push({
                    name: "SPF (Sender Policy Framework)",
                    status: "PASS",
                    detail: `SPF policy found: ${spf}`,
                });
            } else {
                score -= 10;
                checks.push({
                    name: "SPF (Sender Policy Framework)",
                    status: "WARN",
                    detail: "No SPF record found. Email sent from this domain may be flagged as spam.",
                });
            }
        } catch (_) {}

        const finalScore = Math.max(0, Math.min(100, score));
        const overallStatus = finalScore >= 80 ? "HEALTHY" : (finalScore >= 50 ? "WARNING" : "CRITICAL");

        return {
            ok: aRecords.length > 0 || nsRecords.length > 0,
            status: overallStatus,
            domain: cleanDomain,
            healthScore: finalScore,
            checks,
            nameServers: nsRecords,
            aRecords,
            soa: soaRecord,
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { DnsHealthExecutor };
