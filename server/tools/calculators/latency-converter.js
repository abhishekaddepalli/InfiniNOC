/**
 * Network Latency & Propagation Delay Calculator
 */
class LatencyConverter {
    /**
     * Convert latency units and calculate optical propagation delay
     * @param {object} params Parameter object
     * @param {number} params.value Latency value
     * @param {string} params.unit Input unit ("ms", "us", "s")
     * @param {number} params.fiberDistanceKm Optional fiber distance in km
     * @returns {object} Unit conversions and propagation breakdown
     */
    static execute({ value = 25, unit = "ms", fiberDistanceKm = 500 }) {
        const val = Math.max(0, parseFloat(value) || 0);
        const u = String(unit || "ms").toLowerCase();
        const distKm = Math.max(0, parseFloat(fiberDistanceKm) || 0);

        // Convert to milliseconds as baseline
        let ms = val;
        if (u === "s") ms = val * 1000;
        if (u === "us" || u === "µs") ms = val / 1000;
        if (u === "ns") ms = val / 1000000;

        const seconds = ms / 1000;
        const microseconds = Math.round(ms * 1000 * 100) / 100;
        const nanoseconds = Math.round(ms * 1000000);

        // Theoretical optical propagation delay in G.652 silica core (speed in glass ~ 204,190 km/s)
        // One-way propagation delay: ~ 4.9 microseconds per kilometer
        // Round-trip delay (RTT): ~ 9.8 microseconds per kilometer (or ~ 0.0098 ms/km)
        const theoreticalOneWayMs = Math.round((distKm * 0.004897) * 1000) / 1000;
        const theoreticalRttMs = Math.round((theoreticalOneWayMs * 2) * 1000) / 1000;

        return {
            ok: true,
            status: "SUCCESS",
            input: { value: val, unit: u },
            conversions: {
                milliseconds: ms,
                seconds,
                microseconds,
                nanoseconds,
            },
            fiberPropagation: {
                distanceKm: distKm,
                theoreticalOneWayDelayMs: theoreticalOneWayMs,
                theoreticalRttDelayMs: theoreticalRttMs,
                speedOfLightInGlassKmS: 204190,
                latencyPerKmUs: 4.897,
            },
        };
    }
}

module.exports = { LatencyConverter };
