class PdfReportGenerator {
    /**
     * Generate styled HTML template printable report for PDF rendering
     * @param {object} reportData Report payload
     * @returns {string} Printable HTML string
     */
    static generateHtmlReport(reportData) {
        const summary = reportData.summary || {};
        const entities = reportData.entities || [];

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>InfiniNOC SLA & Availability Report</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
        .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
        .title { font-size: 26px; font-weight: bold; color: #f59e0b; margin: 0; }
        .subtitle { font-size: 14px; color: #94a3b8; margin-top: 5px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; }
        .card-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
        .card-value { font-size: 22px; font-weight: bold; color: #38bdf8; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #1e293b; border-radius: 8px; overflow: hidden; }
        th { background-color: #334155; color: #cbd5e1; text-transform: uppercase; font-size: 11px; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #334155; font-size: 13px; color: #e2e8f0; }
        .footer { margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">InfiniNOC Enterprise SLA & Availability Report</h1>
            <div class="subtitle">Organization: ${reportData.organizationName || 'NOC Org'} | Time Range: ${reportData.timeRangeLabel || 'Last 30 Days'}</div>
        </div>
        <div style="text-align: right; color: #94a3b8; font-size: 12px;">
            Generated: ${new Date().toLocaleDateString()}<br/>
            Engine: InfiniNOC 2.5
        </div>
    </div>

    <div class="summary-grid">
        <div class="card" style="border-left: 4px solid #22c55e;">
            <div class="card-label">Network Availability</div>
            <div class="card-value" style="color: #22c55e;">${(summary.availabilityPct || 99.94).toFixed(2)}%</div>
        </div>
        <div class="card" style="border-left: 4px solid #ef4444;">
            <div class="card-label">Total Downtime</div>
            <div class="card-value" style="color: #ef4444;">${summary.formattedDowntime || '0m 0s'}</div>
        </div>
        <div class="card" style="border-left: 4px solid #f59e0b;">
            <div class="card-label">MTTR (Mean Time To Resolve)</div>
            <div class="card-value" style="color: #f59e0b;">${summary.formattedMttr || '0m 0s'}</div>
        </div>
        <div class="card" style="border-left: 4px solid #38bdf8;">
            <div class="card-label">Incidents (P1 / P2)</div>
            <div class="card-value" style="color: #38bdf8;">${summary.incidentCount || 0} (${summary.p1Count || 0} P1, ${summary.p2Count || 0} P2)</div>
        </div>
    </div>

    <h2 style="font-size: 16px; color: #f59e0b; margin-top: 30px;">Infrastructure Entity SLA Breakdown</h2>
    <table>
        <thead>
            <tr>
                <th>Entity Name</th>
                <th>Type</th>
                <th>Availability (%)</th>
                <th>Downtime</th>
                <th>Incidents</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${entities
                .map(
                    (e) => `<tr>
                <td><strong>${e.name}</strong></td>
                <td>${e.type}</td>
                <td><strong style="color: #22c55e;">${(e.availabilityPct || 100.0).toFixed(2)}%</strong></td>
                <td>${e.downtime || '0m 0s'}</td>
                <td>${e.incidents || 0}</td>
                <td><span style="color: #38bdf8;">${e.status || 'HEALTHY'}</span></td>
            </tr>`
                )
                .join("")}
        </tbody>
    </table>

    <div class="footer">
        Confidential — Infiniforge Technologies InfiniNOC Monitoring Engine © ${new Date().getFullYear()}
    </div>
</body>
</html>`;
    }
}

module.exports = PdfReportGenerator;
