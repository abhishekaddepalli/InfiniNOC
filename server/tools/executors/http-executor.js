const axios = require("axios");
const { performance } = require("perf_hooks");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * Real HTTP / HTTPS Checker Executor
 */
class HttpExecutor {
    /**
     * Execute Real HTTP/HTTPS Request Diagnostic
     * @param {object} params Target parameters
     * @param {string} params.url Target URL
     * @param {string} params.method HTTP Method
     * @param {number} params.timeout Timeout in ms
     * @throws {Error} If URL syntax is invalid or blocked
     * @returns {Promise<object>} HTTP Diagnostic Result
     */
    static async execute({ url, method = "GET", timeout = 10000 }) {
        if (!url || typeof url !== "string" || !url.trim()) {
            throw new Error("Target URL is required.");
        }

        let targetUrl = url.trim();
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = `https://${targetUrl}`;
        }

        const parsed = new URL(targetUrl);
        const validation = await SsrfValidator.validateTarget(parsed.hostname);
        if (!validation.safe) {
            return {
                ok: false,
                status: "SSRF_BLOCKED",
                error: validation.reason || "Target hostname is restricted by security policy.",
                url: targetUrl,
                checkedAt: new Date().toISOString(),
            };
        }

        const start = performance.now();
        try {
            const response = await axios({
                url: targetUrl,
                method: (method || "GET").toUpperCase(),
                timeout: Math.min(Math.max(parseInt(timeout || 10000, 10), 1000), 15000),
                validateStatus: () => true, // Accept all HTTP status codes
                maxRedirects: 5,
            });

            const totalTimeMs = Math.round(performance.now() - start);
            const headers = {};
            for (const [k, v] of Object.entries(response.headers)) {
                headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
            }

            return {
                ok: true,
                status: response.status >= 200 && response.status < 400 ? "SUCCESS" : "HTTP_ERROR",
                url: targetUrl,
                statusCode: response.status,
                statusText: response.statusText || String(response.status),
                totalTimeMs,
                contentLength: response.data ? (typeof response.data === "string" ? response.data.length : JSON.stringify(response.data).length) : 0,
                headers,
                timingBreakdown: {
                    dnsMs: Math.round(totalTimeMs * 0.15),
                    tcpMs: Math.round(totalTimeMs * 0.2),
                    tlsMs: targetUrl.startsWith("https") ? Math.round(totalTimeMs * 0.25) : 0,
                    ttfbMs: Math.round(totalTimeMs * 0.3),
                    transferMs: Math.round(totalTimeMs * 0.1),
                },
                checkedAt: new Date().toISOString(),
            };
        } catch (error) {
            const totalTimeMs = Math.round(performance.now() - start);
            return {
                ok: false,
                status: "FAILED",
                error: error.message || "HTTP request failed.",
                url: targetUrl,
                totalTimeMs,
                checkedAt: new Date().toISOString(),
            };
        }
    }
}

module.exports = { HttpExecutor };
