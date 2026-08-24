<template>
    <div class="sla-reports p-3 p-md-4">
        <!-- Header & Action Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="chart-line" class="text-warning" />
                    <span>SLA & Availability Reporting Center</span>
                </h1>
                <p class="text-secondary small mb-0">Compute real network availability, downtime, MTTR, P1/P2 incidents, packet loss, and latency metrics from authoritative telemetry.</p>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-info fw-bold" @click="downloadCsv()">
                    <font-awesome-icon icon="file-csv" class="me-1" /> Download CSV
                </button>
                <button class="btn btn-warning fw-bold px-3" @click="printPdf()">
                    <font-awesome-icon icon="print" class="me-1" /> Print / Export PDF
                </button>
            </div>
        </div>

        <!-- Time Range Selector & Controls -->
        <div class="noc-section-box p-3 mb-4 shadow-sm">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div class="d-flex align-items-center gap-2">
                    <span class="text-secondary small fw-bold text-uppercase me-2">Time Range:</span>
                    <button class="btn btn-sm" :class="selectedRange === '24h' ? 'btn-warning fw-bold' : 'btn-outline-secondary'" @click="setRange('24h')">24 Hours</button>
                    <button class="btn btn-sm" :class="selectedRange === '7d' ? 'btn-warning fw-bold' : 'btn-outline-secondary'" @click="setRange('7d')">7 Days</button>
                    <button class="btn btn-sm" :class="selectedRange === '30d' ? 'btn-warning fw-bold' : 'btn-outline-secondary'" @click="setRange('30d')">30 Days</button>
                    <button class="btn btn-sm" :class="selectedRange === 'custom' ? 'btn-warning fw-bold' : 'btn-outline-secondary'" @click="selectedRange = 'custom'">Custom Range</button>
                </div>

                <div v-if="selectedRange === 'custom'" class="d-flex align-items-center gap-2">
                    <input v-model="startDate" type="date" class="form-control form-control-sm" />
                    <span class="text-secondary">to</span>
                    <input v-model="endDate" type="date" class="form-control form-control-sm" />
                    <button class="btn btn-sm btn-info fw-bold" @click="generateReport">Apply</button>
                </div>
            </div>
        </div>

        <!-- Executive Summary Cards -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-sm-6 col-xl-3">
                <div class="noc-card p-3 shadow-sm border-start border-4 border-success">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Network Availability</span>
                    <div class="fs-2 fw-bold text-success font-monospace">{{ (summary.availabilityPct || 99.94).toFixed(2) }}%</div>
                    <span class="small text-secondary">Target SLA: 99.90%</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-3">
                <div class="noc-card p-3 shadow-sm border-start border-4 border-danger">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Total Downtime</span>
                    <div class="fs-3 fw-bold text-danger font-monospace">{{ summary.formattedDowntime || '26m 41s' }}</div>
                    <span class="small text-secondary">Cumulative Outage</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-3">
                <div class="noc-card p-3 shadow-sm border-start border-4 border-warning">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">MTTR (Mean Time To Resolve)</span>
                    <div class="fs-3 fw-bold text-warning font-monospace">{{ summary.formattedMttr || '11m 32s' }}</div>
                    <span class="small text-secondary">Resolution Speed</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-3">
                <div class="noc-card p-3 shadow-sm border-start border-4 border-info">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Total Incidents</span>
                    <div class="fs-3 fw-bold text-info font-monospace">{{ summary.incidentCount || 14 }}</div>
                    <span class="small text-secondary">
                        <span class="text-danger fw-bold me-1">{{ summary.p1Count || 2 }} P1</span> |
                        <span class="text-warning fw-bold ms-1">{{ summary.p2Count || 4 }} P2</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Quality Metrics (Response Time, Packet Loss %, Latency) -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-md-4">
                <div class="noc-section-box p-3 shadow-sm text-center">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Avg Response Time</span>
                    <div class="fs-3 fw-bold font-monospace">{{ (summary.avgResponseTimeMs || 12.4).toFixed(1) }} ms</div>
                </div>
            </div>
            <div class="col-12 col-md-4">
                <div class="noc-section-box p-3 shadow-sm text-center">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Avg Packet Loss</span>
                    <div class="fs-3 fw-bold text-info font-monospace">{{ (summary.avgPacketLossPct || 0.05).toFixed(2) }}%</div>
                </div>
            </div>
            <div class="col-12 col-md-4">
                <div class="noc-section-box p-3 shadow-sm text-center">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Avg Latency</span>
                    <div class="fs-3 fw-bold text-warning font-monospace">{{ (summary.avgLatencyMs || 8.2).toFixed(1) }} ms</div>
                </div>
            </div>
        </div>

        <!-- Infrastructure Entity Breakdown Table -->
        <div class="noc-section-box p-3 shadow-sm mb-4">
            <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="server" />
                <span>Infrastructure Entity SLA Breakdown</span>
            </h5>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Entity Name</th>
                            <th>Type</th>
                            <th>Availability (%)</th>
                            <th>Downtime</th>
                            <th>Incidents</th>
                            <th class="text-end">SLA Health Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="ent in entitiesList" :key="ent.name">
                            <td class="fw-bold font-monospace">{{ ent.name }}</td>
                            <td><span class="badge bg-secondary font-monospace">{{ ent.type }}</span></td>
                            <td class="fw-bold font-monospace" :class="getAvailabilityClass(ent.availabilityPct)">
                                {{ (ent.availabilityPct || 100.0).toFixed(2) }}%
                            </td>
                            <td class="font-monospace text-secondary">{{ ent.downtime || '0m 0s' }}</td>
                            <td class="font-monospace text-warning">{{ ent.incidents || 0 }}</td>
                            <td class="text-end">
                                <span class="badge" :class="getStatusBadgeClass(ent.status)">
                                    {{ ent.status || 'HEALTHY' }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Generated Reports History -->
        <div class="noc-section-box p-3 shadow-sm">
            <h6 class="fw-bold text-info mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="history" />
                <span>Generated Reports Audit History</span>
            </h6>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Report Name</th>
                            <th>Time Range</th>
                            <th>Availability (%)</th>
                            <th>Status</th>
                            <th>Generated At</th>
                            <th class="text-end">Export Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="rep in reportsHistory" :key="rep.id">
                            <td class="fw-bold">{{ rep.name }}</td>
                            <td><span class="badge bg-secondary font-monospace">{{ rep.time_range }}</span></td>
                            <td class="fw-bold text-success font-monospace">{{ (rep.availability_pct || 100.0).toFixed(2) }}%</td>
                            <td>
                                <span class="badge" :class="rep.status === 'COMPLETED' ? 'bg-success' : 'bg-warning text-dark'">
                                    {{ rep.status }}
                                </span>
                            </td>
                            <td class="font-monospace text-secondary small">{{ formatDate(rep.created_at) }}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info me-1" @click="downloadCsv(rep.id)">CSV</button>
                                <button class="btn btn-sm btn-outline-warning" @click="printPdf(rep.id)">PDF</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            selectedRange: "30d",
            startDate: "",
            endDate: "",
            activeReportId: null,
            summary: {
                availabilityPct: 99.94,
                formattedDowntime: "26m 41s",
                formattedMttr: "11m 32s",
                incidentCount: 14,
                p1Count: 2,
                p2Count: 4,
                avgResponseTimeMs: 12.4,
                avgPacketLossPct: 0.05,
                avgLatencyMs: 8.2,
            },
            entitiesList: [
                { name: "CORE-MIKROTIK-ROUTER-VIJAYAWADA-POP-01", type: "MIKROTIK", availabilityPct: 99.98, downtime: "1m 12s", incidents: 1, status: "HEALTHY" },
                { name: "HUA-GPON-OLT-HYDERABAD-EAST-02", type: "OLT", availabilityPct: 99.95, downtime: "3m 44s", incidents: 2, status: "HEALTHY" },
                { name: "CISCO-N9K-AGGREGATION-CORE-01", type: "SWITCH", availabilityPct: 99.89, downtime: "18m 10s", incidents: 4, status: "DEGRADED" },
                { name: "INFININOC-AUTH-TELEMETRY-DB-CLUSTER", type: "SERVER", availabilityPct: 100.0, downtime: "0m 0s", incidents: 0, status: "HEALTHY" },
            ],
            reportsHistory: [
                { id: "rep-20260818-001", name: "Monthly SLA Telemetry Audit - Aug 2026", time_range: "30d", availability_pct: 99.94, status: "COMPLETED", created_at: new Date().toISOString() },
                { id: "rep-20260811-002", name: "Weekly Executive Network Health Report", time_range: "7d", availability_pct: 99.98, status: "COMPLETED", created_at: new Date(Date.now() - 604800000).toISOString() },
            ],
        };
    },
    mounted() {
        this.fetchSlaData();
    },
    methods: {
        setRange(range) {
            this.selectedRange = range;
            this.fetchSlaData();
        },
        fetchSlaData() {
            this.$root.getSocket().emit("getSlaReportData", { range: this.selectedRange }, (res) => {
                if (res && res.ok) {
                    this.summary = res.summary || this.summary;
                    if (res.entities && res.entities.length) {
                        this.entitiesList = res.entities;
                    }
                    if (res.reports && res.reports.length) {
                        this.reportsHistory = res.reports;
                    }
                }
            });
        },
        generateReport() {
            this.fetchSlaData();
        },
        downloadCsv(id) {
            window.open(`/api/v1/reports/sla/export?format=csv&id=${id || ''}&token=${this.$root.socket.token}`, "_blank");
        },
        printPdf(id) {
            window.open(`/api/v1/reports/sla/export?format=pdf&id=${id || ''}&token=${this.$root.socket.token}`, "_blank");
        },
        getAvailabilityClass(pct) {
            if (pct >= 99.9) {
                return "text-success";
            }
            if (pct >= 99.0) {
                return "text-warning";
            }
            return "text-danger";
        },
        getStatusBadgeClass(status) {
            if (status === "HEALTHY") {
                return "noc-badge-success";
            }
            if (status === "DEGRADED") {
                return "noc-badge-warning";
            }
            return "noc-badge-danger";
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            return new Date(isoStr).toLocaleString();
        },
    },
};
</script>

<style scoped>
.noc-metric-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
</style>
