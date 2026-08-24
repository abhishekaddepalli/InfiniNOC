const dns = require("dns").promises;
const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Enterprise RBL / DNSBL Provider Matrix
 */
const RBL_ZONES = [
    { zone: "zen.spamhaus.org", name: "Spamhaus ZEN", category: "Combined Spam/Exploit", delistUrl: "https://check.spamhaus.org/", info: "Combines SBL, XBL, and PBL blocklists for comprehensive threat detection." },
    { zone: "sbl.spamhaus.org", name: "Spamhaus SBL", category: "Spam Source", delistUrl: "https://check.spamhaus.org/", info: "Verified spam sources and cybercrime operations." },
    { zone: "xbl.spamhaus.org", name: "Spamhaus XBL", category: "Exploit/Botnet", delistUrl: "https://check.spamhaus.org/", info: "Illegal third-party exploits, open proxies, and malware botnets." },
    { zone: "pbl.spamhaus.org", name: "Spamhaus PBL", category: "End-User IP Range", delistUrl: "https://check.spamhaus.org/", info: "End-user dynamic IP ranges that should not send unauthenticated email." },
    { zone: "rep.mailspike.net", name: "Mailspike Reputation", category: "IP Reputation Index", delistUrl: "https://mailspike.org/iplookup.html", info: "Mailspike IP reputation system for email traffic analysis." },
    { zone: "z.mailspike.net", name: "Mailspike Zero-Hour", category: "Zero-Day Spam", delistUrl: "https://mailspike.org/iplookup.html", info: "Zero-hour active spam distribution sources." },
    { zone: "bl.mailspike.net", name: "Mailspike Blacklist", category: "Bad Reputation", delistUrl: "https://mailspike.org/iplookup.html", info: "Confirmed high-volume spamming IP addresses." },
    { zone: "b.barracudacentral.org", name: "Barracuda BRBL", category: "Spam & Abuse", delistUrl: "https://www.barracudacentral.org/lookups", info: "Barracuda Reputation Block List for spam and malware." },
    { zone: "bl.spamcop.net", name: "Spamcop", category: "User Reported Spam", delistUrl: "https://www.spamcop.net/bl.shtml", info: "Automated list based on SpamCop user report traps." },
    { zone: "cbl.abuseat.org", name: "Composite Blocking List (CBL)", category: "Botnet & Worms", delistUrl: "https://www.abuseat.org/lookup.cgi", info: "Detections of spam-sending compromise, malware, and botnets." },
    { zone: "dnsbl.sorbs.net", name: "SORBS Aggregate", category: "Spam & Open Relays", delistUrl: "http://www.sorbs.net/lookup/", info: "Spam and Open Relay Blocking System." },
    { zone: "spam.dnsbl.sorbs.net", name: "SORBS Spam", category: "Spam Emitters", delistUrl: "http://www.sorbs.net/lookup/", info: "IP addresses that have delivered spam to SORBS traps." },
    { zone: "dnsbl-1.uceprotect.net", name: "UCEPROTECT Level 1", category: "Direct Spammers", delistUrl: "https://www.uceprotect.net/en/rblcheck.php", info: "Single IP addresses verified as active spammers." },
    { zone: "dnsbl-2.uceprotect.net", name: "UCEPROTECT Level 2", category: "ISP Subnets", delistUrl: "https://www.uceprotect.net/en/rblcheck.php", info: "Subnet escalation RBL for unmanaged ISP ranges." },
    { zone: "dnsbl-3.uceprotect.net", name: "UCEPROTECT Level 3", category: "ASNs & Carriers", delistUrl: "https://www.uceprotect.net/en/rblcheck.php", info: "Carrier/ASN escalation for worst offender networks." },
    { zone: "psbl.surriel.com", name: "Passive Spam Block List (PSBL)", category: "Passive Traps", delistUrl: "https://psbl.org/listing", info: "Passive spam blocklist using honeypot receiving traps." },
    { zone: "all.spamrats.com", name: "SpamRats All", category: "Spam & Bad PTR", delistUrl: "https://www.spamrats.com/", info: "SpamRats threat intelligence list." },
    { zone: "noptr.spamrats.com", name: "SpamRats No-PTR", category: "Missing Reverse DNS", delistUrl: "https://www.spamrats.com/", info: "IPs lacking reverse DNS (PTR) or with invalid hostname formatting." },
    { zone: "spam.spamrats.com", name: "SpamRats Spam", category: "Known Spammers", delistUrl: "https://www.spamrats.com/", info: "IP addresses generating active unwanted commercial email." },
    { zone: "ubl.lashback.com", name: "LashBack Unsubscribe Blacklist", category: "Unsubscribe Abuse", delistUrl: "https://ubl.lashback.com/", info: "IPs sending email to unsubscribed address lists." },
    { zone: "dnsbl.zapbl.net", name: "ZapBL", category: "Spam Traps", delistUrl: "https://zapbl.net/", info: "ZapBL open spam trap and abuse blocking list." },
    { zone: "dnsbl.dronebl.org", name: "DroneBL", category: "Abuse & IRC Bots", delistUrl: "https://dronebl.org/lookup", info: "Real-time incident track for botnet, DDoS, and IRC abuse." },
    { zone: "ips.backscatterer.org", name: "Backscatterer", category: "Misconfigured NDRs", delistUrl: "http://www.backscatterer.org/?target=test", info: "IPs sending misconfigured NDR bounces or backscatter." },
];

/**
 * Enterprise IP Reputation & DNSBL Blacklist Provider
 */
class RblProvider {
    /**
     * Perform parallel DNSBL check across 23+ major global blacklist zones
     * @param {string} ip Target IP address
     * @returns {Promise<object>} Reputation & Blacklist check result with delisting guides
     */
    static async checkReputation(ip) {
        if (!ip || typeof ip !== "string" || !ip.trim()) {
            throw new Error("Target IP address is required.");
        }

        const cleanIp = ip.trim();
        if (net.isIP(cleanIp) !== 4) {
            throw new Error(`IP Reputation check supports IPv4 addresses. '${cleanIp}' is invalid.`);
        }

        if (SsrfValidator.isBlockedIp(cleanIp)) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: `Target IP ${cleanIp} is in a restricted internal / private network range.`,
                ip: cleanIp,
                checkedAt: new Date().toISOString(),
            };
        }

        const reversedOctets = cleanIp.split(".").reverse().join(".");

        // Execute parallel DNSBL resolution queries
        const zoneChecks = await Promise.allSettled(RBL_ZONES.map(async (rbl) => {
            const queryHost = `${reversedOctets}.${rbl.zone}`;
            try {
                const addrs = await dns.resolve4(queryHost);
                if (addrs && addrs.length > 0) {
                    return {
                        zone: rbl.zone,
                        name: rbl.name,
                        category: rbl.category,
                        delistUrl: rbl.delistUrl,
                        info: rbl.info,
                        listed: true,
                        responseCode: addrs[0],
                        status: "LISTED",
                    };
                }
            } catch (err) {
                // ENOTFOUND / NXDOMAIN means CLEAN
            }

            return {
                zone: rbl.zone,
                name: rbl.name,
                category: rbl.category,
                delistUrl: rbl.delistUrl,
                info: rbl.info,
                listed: false,
                responseCode: "CLEAN",
                status: "CLEAN",
            };
        }));

        const zones = zoneChecks.map(z => z.status === "fulfilled" ? z.value : z.reason);
        const listedZones = zones.filter(z => z.listed);
        const listedCount = listedZones.length;
        const totalZonesChecked = RBL_ZONES.length;

        // Compute Reputation Rating Score (0 to 100)
        let reputationScore = Math.max(0, 100 - listedCount * 20);

        let riskLevel = "CLEAN";
        if (listedCount > 3) {
            riskLevel = "CRITICAL";
        } else if (listedCount > 0) {
            riskLevel = "WARNING";
        }

        const remediationGuide = [
            { step: "1. Audit Mail Logs", detail: "Inspect outgoing mail server queues (postfix/exim) for compromised user accounts, unauthorized relaying, or compromised web scripts." },
            { step: "2. Verify PTR (Reverse DNS)", detail: "Ensure your IP has a valid PTR record matching your mail server's FQDN (e.g. mail.domain.com)." },
            { step: "3. Enforce Email Security (SPF/DKIM/DMARC)", detail: "Publish valid SPF (v=spf1), DKIM cryptographic signatures, and a DMARC policy (p=quarantine or p=reject)." },
            { step: "4. Submit Official Delisting", detail: "Use the direct removal links provided in the Listed Blacklists table below to submit formal removal requests." },
            { step: "5. Monitor Feedback Loops (FBL)", detail: "Subscribe to ISP Feedback Loops (Microsoft SNDS, Yahoo FBL) to receive real-time notifications of user spam complaints." },
        ];

        return {
            ok: true,
            status: listedCount === 0 ? "CLEAN" : "BLACK_LISTED",
            riskLevel,
            ip: cleanIp,
            reputationScore,
            totalZonesChecked,
            listedCount,
            cleanCount: totalZonesChecked - listedCount,
            zones,
            listedZones,
            remediationGuide,
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { RblProvider, RBL_ZONES };
