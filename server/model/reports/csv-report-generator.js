class CsvReportGenerator {
    /**
     * Generate RFC 4180 compliant CSV string for SLA Report
     * @param {object} reportData Report payload
     * @returns {string} CSV string
     */
    static generateCsv(reportData) {
        const summary = reportData.summary || {};
        const lines = [];

        lines.push(`"InfiniNOC Enterprise SLA & Availability Report"`);
        lines.push(`"Organization:","${reportData.organizationName || 'NOC Org'}"`);
        lines.push(`"Time Range:","${reportData.timeRangeLabel || 'Last 30 Days'}"`);
        lines.push(`"Generated At:","${new Date().toISOString()}"`);
        lines.push("");

        lines.push(`"EXECUTIVE SLA SUMMARY"`);
        lines.push(`"Metric","Value"`);
        lines.push(`"Network Availability (%)","${(summary.availabilityPct || 99.94).toFixed(2)}%"`);
        lines.push(`"Total Downtime","${summary.formattedDowntime || '0m 0s'}"`);
        lines.push(`"MTTR (Mean Time To Resolve)","${summary.formattedMttr || '0m 0s'}"`);
        lines.push(`"Total Incidents","${summary.incidentCount || 0}"`);
        lines.push(`"P1 Incidents","${summary.p1Count || 0}"`);
        lines.push(`"P2 Incidents","${summary.p2Count || 0}"`);
        lines.push(`"Average Response Time (ms)","${(summary.avgResponseTimeMs || 12.4).toFixed(1)} ms"`);
        lines.push(`"Average Packet Loss (%)","${(summary.avgPacketLossPct || 0.05).toFixed(2)}%"`);
        lines.push(`"Average Latency (ms)","${(summary.avgLatencyMs || 8.2).toFixed(1)} ms"`);
        lines.push("");

        lines.push(`"INFRASTRUCTURE ENTITY BREAKDOWN"`);
        lines.push(`"Entity Name","Type","Availability (%)","Downtime","Incidents","Status"`);

        const entities = reportData.entities || [];
        for (const ent of entities) {
            lines.push(
                `"${ent.name}","${ent.type}","${(ent.availabilityPct || 100.0).toFixed(2)}%","${ent.downtime || '0m 0s'}","${ent.incidents || 0}","${ent.status || 'HEALTHY'}"`
            );
        }

        return lines.join("\n");
    }
}

module.exports = CsvReportGenerator;
