/**
 * Link Bandwidth & Network Capacity Utilization Calculator
 */
class LinkUtilizationCalculator {
    /**
     * Standard link capacities in bits per second (bps)
     */
    static get LINK_CAPACITIES() {
        return {
            "10M": 10 * 1000 * 1000,
            "100M": 100 * 1000 * 1000,
            "1G": 1000 * 1000 * 1000,
            "2.5G": 2500 * 1000 * 1000,
            "10G": 10000 * 1000 * 1000,
            "25G": 25000 * 1000 * 1000,
            "40G": 40000 * 1000 * 1000,
            "100G": 100000 * 1000 * 1000,
        };
    }

    /**
     * Calculate link utilization and headroom
     * @param {object} params Parameter object
     * @param {number} params.throughputMbps Current measured traffic in Mbps
     * @param {string} params.linkCapacity Link capacity ("100M", "1G", "10G", "40G", "100G")
     * @returns {object} Utilization analysis
     */
    static execute({ throughputMbps = 450, linkCapacity = "1G" }) {
        const currentMbps = Math.max(0, parseFloat(throughputMbps) || 0);
        const capacityKey = String(linkCapacity || "1G").toUpperCase();
        const capacityBps = LinkUtilizationCalculator.LINK_CAPACITIES[capacityKey] || 1000 * 1000 * 1000;
        const capacityMbps = capacityBps / 1000000;

        const utilizationPercent = Math.min(100, Math.round((currentMbps / capacityMbps) * 10000) / 100);
        const remainingHeadroomMbps = Math.max(0, Math.round((capacityMbps - currentMbps) * 100) / 100);

        let status = "HEALTHY";
        let color = "text-success";
        let recommendation = "Link utilization is well within normal engineering operating parameters (< 70%).";

        if (utilizationPercent >= 85) {
            status = "CRITICAL_SATURATION";
            color = "text-danger";
            recommendation = "CRITICAL: Link is operating near saturation (>= 85%). Buffer bloat, packet drops and queuing delays are imminent. Upgrade link capacity.";
        } else if (utilizationPercent >= 70) {
            status = "HIGH_UTILIZATION";
            color = "text-warning";
            recommendation = "WARNING: Link is experiencing elevated traffic load (70% - 85%). Plan for traffic balancing or capacity expansion.";
        }

        return {
            ok: true,
            status,
            color,
            recommendation,
            currentMbps,
            capacityKey,
            capacityMbps,
            utilizationPercent,
            remainingHeadroomMbps,
        };
    }
}

module.exports = { LinkUtilizationCalculator };
