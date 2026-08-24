/**
 * Provider Health & Status Monitoring Subsystem
 * Records status, latency, last success, last error, and health metrics for each configured provider.
 */

const healthMetrics = new Map([
    ["IPinfo", { status: "Not configured", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 }],
    ["RIPEstat", { status: "Connected", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 }],
    ["DNS_PTR", { status: "Connected", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 }],
    ["Community_Fallback", { status: "Connected", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 }],
]);

class ProviderHealth {
    /**
     * Record a successful provider execution
     * @param {string} providerName Provider name
     * @param {number} latencyMs Execution duration in ms
     * @returns {void}
     */
    static recordSuccess(providerName, latencyMs) {
        const metric = healthMetrics.get(providerName) || { status: "Connected", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 };
        metric.status = "Connected";
        metric.latencyMs = Math.round(latencyMs);
        metric.lastSuccess = new Date().toISOString();
        metric.successCount += 1;
        healthMetrics.set(providerName, metric);
    }

    /**
     * Record a provider error / failure
     * @param {string} providerName Provider name
     * @param {string} errorMessage Failure message
     * @returns {void}
     */
    static recordFailure(providerName, errorMessage) {
        const metric = healthMetrics.get(providerName) || { status: "Degraded", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 };
        metric.status = "Degraded";
        metric.lastError = `${new Date().toISOString()} — ${errorMessage}`;
        metric.errorCount += 1;
        healthMetrics.set(providerName, metric);
    }

    /**
     * Mark a provider as Not Configured
     * @param {string} providerName Provider name
     * @returns {void}
     */
    static markNotConfigured(providerName) {
        const metric = healthMetrics.get(providerName) || { status: "Not configured", latencyMs: 0, lastSuccess: null, lastError: null, successCount: 0, errorCount: 0 };
        metric.status = "Not configured";
        healthMetrics.set(providerName, metric);
    }

    /**
     * Get snapshot of all provider health metrics
     * @returns {object} Health metrics map as clean JSON object
     */
    static getHealthSnapshot() {
        const snapshot = {};
        for (const [key, val] of healthMetrics.entries()) {
            snapshot[key] = { ...val };
        }
        return snapshot;
    }
}

module.exports = { ProviderHealth };
