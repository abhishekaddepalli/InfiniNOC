const axios = require("axios");
const { SsrfValidator } = require("../security/ssrf-validator");

/**
 * HTTP Redirect Chain Diagnostic Executor
 * Traces exact HTTP 301/302/307/308 redirect chains hop by hop, enforcing SSRF check at every hop.
 */
class RedirectExecutor {
    /**
     * Follow redirect chain hop by hop
     * @param {object} params Target parameters
     * @param {string} params.url Target URL
     * @param {number} params.maxRedirects Maximum hops (default 10)
     * @param {number} params.probeId Optional probe ID
     * @returns {Promise<object>} Trace result
     */
    static async execute({ url, maxRedirects = 10, probeId = null }) {
        if (!url || typeof url !== "string" || !url.trim()) {
            throw new Error("Target URL is required.");
        }

        let currentUrl = url.trim();
        if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
            currentUrl = `https://${currentUrl}`;
        }

        const maxHops = Math.min(Math.max(parseInt(maxRedirects || 10, 10), 1), 15);
        const chain = [];
        const visitedUrls = new Set();
        let finalDestination = currentUrl;
        let isLoop = false;

        for (let hop = 1; hop <= maxHops; hop++) {
            if (visitedUrls.has(currentUrl)) {
                isLoop = true;
                break;
            }
            visitedUrls.add(currentUrl);

            let parsed;
            try {
                parsed = new URL(currentUrl);
            } catch (e) {
                chain.push({
                    hop,
                    url: currentUrl,
                    statusCode: null,
                    error: `Invalid redirect URL syntax: ${e.message}`,
                });
                break;
            }

            const validation = await SsrfValidator.validateTarget(parsed.hostname);
            if (!validation.safe) {
                chain.push({
                    hop,
                    url: currentUrl,
                    statusCode: null,
                    error: validation.reason || "Destination host restricted by SSRF security policy.",
                });
                break;
            }

            const start = Date.now();
            try {
                const response = await axios({
                    url: currentUrl,
                    method: "GET",
                    maxRedirects: 0,
                    timeout: 5000,
                    validateStatus: () => true,
                    headers: {
                        "User-Agent": "InfiniNOC-Diagnostic-Client/1.26",
                    },
                });

                const rttMs = Date.now() - start;
                const statusCode = response.status;
                const locationHeader = response.headers.location || null;

                chain.push({
                    hop,
                    url: currentUrl,
                    statusCode,
                    statusText: response.statusText,
                    rttMs,
                    location: locationHeader,
                });

                finalDestination = currentUrl;

                if ([301, 302, 303, 307, 308].includes(statusCode) && locationHeader) {
                    currentUrl = new URL(locationHeader, currentUrl).toString();
                } else {
                    // Not a redirect; final response reached
                    break;
                }
            } catch (err) {
                const rttMs = Date.now() - start;
                chain.push({
                    hop,
                    url: currentUrl,
                    statusCode: null,
                    rttMs,
                    error: err.message,
                });
                break;
            }
        }

        const redirectCount = Math.max(0, chain.length - 1);

        return {
            ok: true,
            status: isLoop ? "REDIRECT_LOOP_DETECTED" : (redirectCount > 0 ? "REDIRECTED" : "DIRECT"),
            originalUrl: url.trim(),
            finalDestination,
            redirectCount,
            isRedirectLoop: isLoop,
            chain,
            executionLocation: probeId ? `probe:${probeId}` : "central",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { RedirectExecutor };
