/**
 * FTTH Optical Loss Budget & GPON Splitter Loss Calculator
 * Implements ITU-T G.984 GPON and ITU-T G.652 single-mode optical link budget calculations.
 */
class OpticalBudgetCalculator {
    /**
     * Standard insertion loss per PLC splitter ratio
     */
    static get SPLITTER_LOSSES() {
        return {
            "1:2": 3.5,
            "1:4": 7.2,
            "1:8": 10.5,
            "1:16": 13.8,
            "1:32": 17.0,
            "1:64": 20.5,
            "none": 0.0,
        };
    }

    /**
     * Attenuation coefficient in dB/km by wavelength (ITU-T G.652.D standard)
     */
    static get WAVELENGTH_ATTENUATION() {
        return {
            "1310": 0.35, // Upstream GPON
            "1490": 0.28, // Downstream GPON
            "1550": 0.22, // Video overlay / Long-haul
        };
    }

    /**
     * Calculate optical link loss budget and power margin
     * @param {object} params Optical parameters
     * @param {number} params.txPowerDbm Transmitter Launch Power in dBm (e.g. +3.0 dBm for Class B+, +5.0 dBm for Class C+)
     * @param {number} params.rxSensitivityDbm Receiver Sensitivity in dBm (e.g. -28.0 dBm)
     * @param {number} params.fiberDistanceKm Fiber distance in kilometers
     * @param {string} params.wavelength Operating wavelength ("1310", "1490", "1550")
     * @param {string} params.splitterRatio Splitter ratio ("1:2", "1:4", "1:8", "1:16", "1:32", "1:64", "none")
     * @param {number} params.connectorCount Number of mated connector pairs (default 2)
     * @param {number} params.spliceCount Number of fusion splices (default 4)
     * @returns {object} Calculated optical budget breakdown
     */
    static execute({
        txPowerDbm = 3.0,
        rxSensitivityDbm = -28.0,
        fiberDistanceKm = 10.0,
        wavelength = "1490",
        splitterRatio = "1:8",
        connectorCount = 2,
        spliceCount = 4,
    }) {
        const txPower = parseFloat(txPowerDbm) || 3.0;
        const rxSensitivity = parseFloat(rxSensitivityDbm) || -28.0;
        const distance = Math.max(0, parseFloat(fiberDistanceKm) || 0);
        const wl = String(wavelength || "1490");
        const ratio = String(splitterRatio || "1:8");
        const connectors = Math.max(0, parseInt(connectorCount || 2, 10));
        const splices = Math.max(0, parseInt(spliceCount || 4, 10));

        // 1. Total available power budget
        const totalPowerBudgetDb = Math.round((txPower - rxSensitivity) * 100) / 100;

        // 2. Fiber cable attenuation
        const alphaDbPerKm = OpticalBudgetCalculator.WAVELENGTH_ATTENUATION[wl] || 0.28;
        const fiberLossDb = Math.round(distance * alphaDbPerKm * 100) / 100;

        // 3. Splitter loss
        const splitterLossDb = OpticalBudgetCalculator.SPLITTER_LOSSES[ratio] || 10.5;

        // 4. Connector loss (standard: 0.5 dB per mated pair)
        const connectorLossDb = Math.round(connectors * 0.5 * 100) / 100;

        // 5. Splice loss (standard: 0.1 dB per fusion splice)
        const spliceLossDb = Math.round(splices * 0.1 * 100) / 100;

        // 6. Total estimated link loss
        const totalLinkLossDb = Math.round((fiberLossDb + splitterLossDb + connectorLossDb + spliceLossDb) * 100) / 100;

        // 7. Estimated Received Power at ONU/ONT
        const estimatedRxPowerDbm = Math.round((txPower - totalLinkLossDb) * 100) / 100;

        // 8. Power Operating Margin (Safety Margin)
        const safetyMarginDb = Math.round((totalPowerBudgetDb - totalLinkLossDb) * 100) / 100;

        let status = "OPTIMAL";
        let recommendation = "Optical link budget is within healthy design specifications (safety margin >= 3 dB).";

        if (safetyMarginDb < 0) {
            status = "BUDGET_EXCEEDED";
            recommendation = "CRITICAL: Link attenuation exceeds available optical budget. The ONU will not establish link or will experience severe optical loss.";
        } else if (safetyMarginDb < 3.0) {
            status = "MARGINAL";
            recommendation = "WARNING: Safety margin is under 3.0 dB. Link is prone to degradation from temperature fluctuations or fiber aging.";
        }

        return {
            ok: true,
            status,
            recommendation,
            inputs: {
                txPowerDbm: txPower,
                rxSensitivityDbm: rxSensitivity,
                fiberDistanceKm: distance,
                wavelengthNm: parseInt(wl, 10),
                splitterRatio: ratio,
                connectorCount: connectors,
                spliceCount: splices,
            },
            breakdown: {
                totalPowerBudgetDb,
                fiberAttenuationDb: fiberLossDb,
                splitterLossDb,
                connectorLossDb,
                spliceLossDb,
                totalLinkLossDb,
                estimatedRxPowerDbm,
                safetyMarginDb,
            },
        };
    }
}

module.exports = { OpticalBudgetCalculator };
