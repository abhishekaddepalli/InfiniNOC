const axios = require("axios");
const { performance } = require("perf_hooks");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Security Headers & Hardening Audit Executor
 */
class SecurityHeadersExecutor {
    /**
     * Audit HTTP Response Security Headers & compute security grade
     * @param {object} params Target URL or domain
     * @returns {Promise<object>} Security headers audit result
     */
    static async execute(params = {}) {
        let targetUrl = params.url || params.target || "https://example.com";
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://" + targetUrl;
        }

        const urlObj = new URL(targetUrl);
        const validation = await SsrfValidator.validateTarget(urlObj.hostname);
        if (!validation.safe) {
            throw new Error(validation.reason || "Target host is restricted by security policy.");
        }

        const start = performance.now();
        const res = await axios.get(targetUrl, {
            timeout: 8000,
            validateStatus: () => true, // Accept all HTTP status codes
            headers: { "User-Agent": "InfiniNOC-SecurityHeaderScanner/1.0" },
        });
        const elapsed = Math.round(performance.now() - start);

        const headers = res.headers || {};
        const getHeader = (name) => {
            const keys = Object.keys(headers);
            const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
            return found ? headers[found] : null;
        };

        // Audit Best-Practice Security Headers
        const hsts = getHeader("Strict-Transport-Security");
        const csp = getHeader("Content-Security-Policy");
        const xfo = getHeader("X-Frame-Options");
        const xcto = getHeader("X-Content-Type-Options");
        const rp = getHeader("Referrer-Policy");
        const pp = getHeader("Permissions-Policy");

        // Calculate Security Score Grade
        let score = 0;
        if (hsts) {
            score += 25;
        }
        if (csp) {
            score += 25;
        }
        if (xfo) {
            score += 20;
        }
        if (xcto) {
            score += 15;
        }
        if (rp) {
            score += 15;
        }

        let grade = "F";
        let gradeBadgeClass = "bg-danger text-white";
        if (score >= 90) {
            grade = "A+";
            gradeBadgeClass = "bg-success text-white";
        } else if (score >= 75) {
            grade = "A";
            gradeBadgeClass = "bg-success text-white";
        } else if (score >= 60) {
            grade = "B";
            gradeBadgeClass = "bg-info text-white";
        } else if (score >= 40) {
            grade = "C";
            gradeBadgeClass = "bg-warning text-dark";
        }

        const headerAuditList = [
            { name: "Strict-Transport-Security (HSTS)", present: Boolean(hsts), value: hsts || "Missing", recommendation: "Enforce HTTPS transport security (e.g. max-age=31536000; includeSubDomains)" },
            { name: "Content-Security-Policy (CSP)", present: Boolean(csp), value: csp || "Missing", recommendation: "Restrict script and style injection risks" },
            { name: "X-Frame-Options", present: Boolean(xfo), value: xfo || "Missing", recommendation: "Prevent clickjacking framing (SAMEORIGIN or DENY)" },
            { name: "X-Content-Type-Options", present: Boolean(xcto), value: xcto || "Missing", recommendation: "Prevent MIME-sniffing (nosniff)" },
            { name: "Referrer-Policy", present: Boolean(rp), value: rp || "Missing", recommendation: "Protect referrer data leakage (strict-origin-when-cross-origin)" },
            { name: "Permissions-Policy", present: Boolean(pp), value: pp || "Missing", recommendation: "Restrict browser feature access (camera, microphone, geolocation)" },
        ];

        return {
            url: targetUrl,
            status: res.status,
            statusText: res.statusText,
            resolvedIp: validation.ip,
            score,
            grade,
            gradeBadgeClass,
            headerAuditList,
            rawHeaders: headers,
            durationMs: elapsed,
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { SecurityHeadersExecutor };
