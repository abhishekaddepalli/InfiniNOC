const axios = require("axios");
const net = require("net");
const { SsrfValidator } = require("../security/ssrf-validator");
const { log } = require("../../../src/util");

/**
 * Real WHOIS & RDAP Lookup Diagnostic Executor
 * Queries ICANN / ARIN / RIPE / APNIC Registration Data Access Protocol (RDAP) REST APIs.
 */
class RdapExecutor {
    /**
     * Perform authentic RDAP query on a domain or IP address
     * @param {object} params Target parameters
     * @param {string} params.target Domain name or IP address
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} Parsed RDAP registration record
     */
    static async execute({ target, probeId = null }) {
        if (!target || typeof target !== "string" || !target.trim()) {
            throw new Error("Domain name or IP address is required.");
        }

        const cleanTarget = target.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
        const isIp = net.isIP(cleanTarget);

        const validation = await SsrfValidator.validateTarget(cleanTarget);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target is restricted by security policy.",
                target: cleanTarget,
                executionLocation: probeId ? `probe:${probeId}` : "central",
                checkedAt: new Date().toISOString(),
            };
        }

        const rdapUrl = isIp
            ? `https://rdap.arin.net/registry/ip/${cleanTarget}`
            : `https://rdap.org/domain/${cleanTarget}`;

        try {
            const res = await axios.get(rdapUrl, {
                timeout: 8000,
                headers: {
                    Accept: "application/rdap+json, application/json",
                    "User-Agent": "InfiniNOC-RDAP-Client/1.26",
                },
            });

            const data = res.data || {};
            const parsed = isIp
                ? RdapExecutor.parseIpRdap(data, cleanTarget)
                : RdapExecutor.parseDomainRdap(data, cleanTarget);

            return {
                ok: true,
                status: "SUCCESS",
                target: cleanTarget,
                source: "Official RDAP Registry",
                ...parsed,
                type: isIp ? "IP_ALLOCATION" : "DOMAIN_REGISTRATION",
                ipStatus: parsed.type || "ASSIGNED",
                executionLocation: probeId ? `probe:${probeId}` : "central",
                checkedAt: new Date().toISOString(),
            };
        } catch (err) {
            log.error("rdap-executor", `RDAP query failed: ${err.message}`);
            return {
                ok: false,
                status: "QUERY_FAILED",
                error: `RDAP registry query failed: ${err.response ? `${err.response.status} ${err.response.statusText}` : err.message}`,
                target: cleanTarget,
                executionLocation: probeId ? `probe:${probeId}` : "central",
                checkedAt: new Date().toISOString(),
            };
        }
    }

    static parseDomainRdap(data, domain) {
        let registrar = "Unknown Registrar";
        let creationDate = null;
        let expirationDate = null;
        let updatedDate = null;

        if (Array.isArray(data.events)) {
            for (const ev of data.events) {
                if (ev.eventAction === "registration") creationDate = ev.eventDate;
                if (ev.eventAction === "expiration") expirationDate = ev.eventDate;
                if (ev.eventAction === "last changed") updatedDate = ev.eventDate;
            }
        }

        if (Array.isArray(data.entities)) {
            for (const ent of data.entities) {
                if (Array.isArray(ent.roles) && ent.roles.includes("registrar")) {
                    if (ent.vcardArray && ent.vcardArray[1]) {
                        const fnItem = ent.vcardArray[1].find((item) => item[0] === "fn");
                        if (fnItem && fnItem[3]) registrar = fnItem[3];
                    }
                }
            }
        }

        const nameServers = [];
        if (Array.isArray(data.nameservers)) {
            for (const ns of data.nameservers) {
                if (ns.ldhName) nameServers.push(ns.ldhName);
            }
        }

        return {
            domain: data.ldhName || domain,
            handle: data.handle || domain,
            registrar,
            status: data.status || ["active"],
            creationDate,
            expirationDate,
            updatedDate,
            nameServers,
        };
    }

    static parseIpRdap(data, ip) {
        let networkName = data.name || "Allocated IP Range";
        let startAddress = data.startAddress || ip;
        let endAddress = data.endAddress || ip;
        let cidr = data.cidr0_cidrs ? data.cidr0_cidrs.map((c) => `${c.v4prefix || c.v6prefix}/${c.length}`).join(", ") : null;
        let organization = "Unknown Organization";

        if (Array.isArray(data.entities)) {
            for (const ent of data.entities) {
                if (Array.isArray(ent.roles) && (ent.roles.includes("registrant") || ent.roles.includes("administrative"))) {
                    if (ent.vcardArray && ent.vcardArray[1]) {
                        const fnItem = ent.vcardArray[1].find((item) => item[0] === "fn");
                        if (fnItem && fnItem[3]) organization = fnItem[3];
                    }
                }
            }
        }

        return {
            ip,
            networkName,
            startAddress,
            endAddress,
            cidrRange: cidr,
            handle: data.handle || ip,
            organization,
            country: data.country || "GLOBAL",
            type: data.type || "ASSIGNED",
        };
    }
}

module.exports = { RdapExecutor };
