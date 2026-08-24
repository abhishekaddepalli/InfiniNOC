<template>
    <div class="noc-incidents-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="exclamation-triangle" />
                    <span>NOC Incident Management</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Enterprise outage handling, MTTR tracking, and incident timelines for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <div class="d-flex align-items-center gap-2">
                <button v-if="stats.activeCount > 0 || incidents.length > 0" class="btn btn-outline-success fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="resolveAll">
                    <font-awesome-icon icon="check-double" />
                    <span>Resolve All</span>
                </button>
                <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="showCreateModal = true">
                    <font-awesome-icon icon="plus-circle" />
                    <span>Create Incident</span>
                </button>
            </div>
        </div>

        <!-- 4 KPI Telemetry Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-amber">
                    <div class="noc-card-title mb-1">Active Incidents</div>
                    <div class="noc-card-value">{{ stats.activeCount }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-danger">
                    <div class="noc-card-title mb-1">P1 Critical Outages</div>
                    <div class="noc-card-value text-danger">{{ stats.p1Count }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-warning">
                    <div class="noc-card-title mb-1">P2 Major Incidents</div>
                    <div class="noc-card-value text-warning">{{ stats.p2Count }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-info">
                    <div class="noc-card-title mb-1">MTTR (Mean Time to Resolve)</div>
                    <div class="noc-card-value text-info">{{ stats.mttrMinutes }} <span class="fs-6 text-muted fw-normal">mins</span></div>
                </div>
            </div>
        </div>

        <!-- Filter Controls -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
                <span class="text-secondary small fw-bold text-uppercase">Filter Status:</span>
                <button
                    v-for="st in ['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MONITORING', 'RESOLVED', 'CLOSED']"
                    :key="st"
                    class="btn btn-sm"
                    :class="selectedStatus === st ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'"
                    @click="selectedStatus = st; loadIncidents()"
                >
                    {{ st }}
                </button>
            </div>

            <div class="d-flex align-items-center gap-2">
                <span class="text-secondary small fw-bold text-uppercase">Severity:</span>
                <button
                    v-for="sev in ['ALL', 'P1', 'P2', 'P3', 'P4']"
                    :key="sev"
                    class="btn btn-sm"
                    :class="selectedSeverity === sev ? 'btn-danger fw-bold' : 'btn-outline-secondary'"
                    @click="selectedSeverity = sev; loadIncidents()"
                >
                    {{ sev }}
                </button>
            </div>
        </div>

        <!-- Incidents Table -->
        <div class="noc-section-box p-3">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>ID</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Title</th>
                            <th>Site Location</th>
                            <th>Assigned Engineer</th>
                            <th>Created At</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="inc in incidents" :key="inc.id">
                            <td class="font-monospace text-muted">#INC-{{ inc.id }}</td>
                            <td>
                                <span class="badge" :class="getSeverityBadgeClass(inc.severity)">
                                    {{ inc.severity }}
                                </span>
                            </td>
                            <td>
                                <span class="badge" :class="getStatusBadgeClass(inc.status)">
                                    {{ inc.status }}
                                </span>
                            </td>
                            <td>
                                <router-link :to="'/incidents/' + inc.id" class="text-light fw-bold text-decoration-none hover-warning">
                                    {{ inc.title }}
                                </router-link>
                            </td>
                            <td>
                                <span v-if="inc.site_name" class="text-info small"><font-awesome-icon icon="map-marker-alt" class="me-1" />{{ inc.site_name }}</span>
                                <span v-else class="text-muted small">Global</span>
                            </td>
                            <td>
                                <span v-if="inc.assigned_username" class="text-warning small font-monospace"><font-awesome-icon icon="user" class="me-1" />{{ inc.assigned_username }}</span>
                                <span v-else class="text-secondary small fst-italic">Unassigned</span>
                            </td>
                            <td class="small text-muted">{{ formatDate(inc.created_at) }}</td>
                            <td class="text-end">
                                <router-link :to="'/incidents/' + inc.id" class="btn btn-sm btn-outline-warning">
                                    Manage <font-awesome-icon icon="arrow-right" class="ms-1" />
                                </router-link>
                            </td>
                        </tr>
                        <tr v-if="incidents.length === 0">
                            <td colspan="8" class="text-center py-5 text-muted">
                                <font-awesome-icon icon="check-circle" class="display-3 mb-3 text-success" />
                                <h5>No Incidents Found</h5>
                                <p class="small text-secondary">There are no active or historical incidents matching your filter criteria.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal: Create Incident -->
        <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="exclamation-triangle" />
                            <span>Declare New NOC Incident</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3">
                            <div class="col-12 col-md-8">
                                <label class="form-label fw-semibold text-light small text-uppercase">Incident Title</label>
                                <input v-model="newInc.title" type="text" class="form-control noc-input" placeholder="e.g. Vijayawada POP Core Switch Down" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Severity Level</label>
                                <select v-model="newInc.severity" class="form-select noc-input fw-bold">
                                    <option value="P1" class="text-danger">P1 - Critical Outage</option>
                                    <option value="P2" class="text-warning">P2 - Major Degradation</option>
                                    <option value="P3" class="text-info">P3 - Minor Issue</option>
                                    <option value="P4" class="text-secondary">P4 - Low Priority</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label fw-semibold text-light small text-uppercase">Description</label>
                                <textarea v-model="newInc.description" class="form-control noc-input" rows="3" placeholder="Provide details of the outage or impact..."></textarea>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Affected Physical Site</label>
                                <select v-model="newInc.site_id" class="form-select noc-input">
                                    <option :value="null">Global / Unassigned</option>
                                    <option v-for="s in sites" :key="s.id" :value="s.id">{{ s.name }} ({{ s.code }})</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Assign Primary Engineer</label>
                                <select v-model="newInc.assigned_user_id" class="form-select noc-input">
                                    <option :value="null">Unassigned</option>
                                    <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newInc.title" @click="saveIncident">
                            Declare Incident
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            incidents: [],
            stats: { activeCount: 0, p1Count: 0, p2Count: 0, mttrMinutes: 0 },
            sites: [],
            users: [],
            selectedStatus: "ALL",
            selectedSeverity: "ALL",
            showCreateModal: false,
            newInc: {
                title: "",
                description: "",
                severity: "P2",
                site_id: null,
                assigned_user_id: null,
            },
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
    },
    watch: {
        "$root.activeOrganizationId"() {
            this.loadData();
        },
    },
    mounted() {
        this.loadData();
    },
    methods: {
        loadData() {
            this.loadStats();
            this.loadIncidents();
            this.loadSites();
        },
        loadStats() {
            this.$root.getSocket().emit("getIncidentDashboardStats", (res) => {
                if (res && res.ok) {
                    this.stats = res.stats || { activeCount: 0, p1Count: 0, p2Count: 0, mttrMinutes: 0 };
                }
            });
        },
        loadIncidents() {
            const filters = {};
            if (this.selectedStatus !== "ALL") {
                filters.status = this.selectedStatus;
            }
            if (this.selectedSeverity !== "ALL") {
                filters.severity = this.selectedSeverity;
            }

            this.$root.getSocket().emit("getIncidents", filters, (res) => {
                if (res && res.ok) {
                    this.incidents = res.incidents || [];
                }
            });
        },
        loadSites() {
            this.$root.getSocket().emit("getSiteList", (res) => {
                if (res && res.ok) {
                    this.sites = res.sites || [];
                }
            });
        },
        saveIncident() {
            if (!this.newInc.title) {
                return;
            }
            this.$root.getSocket().emit("createIncident", this.newInc, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Incident declared");
                    this.showCreateModal = false;
                    this.newInc = { title: "", description: "", severity: "P2", site_id: null, assigned_user_id: null };
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error declaring incident");
                }
            });
        },
        resolveAll() {
            if (confirm("Are you sure you want to resolve all active incidents?")) {
                this.$root.getSocket().emit("resolveAllIncidents", (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Resolved ${res.count} active incident(s)`);
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to resolve incidents");
                    }
                });
            }
        },
        getSeverityBadgeClass(sev) {
            switch (sev) {
                case "P1": return "bg-danger text-light font-monospace fw-bold";
                case "P2": return "bg-warning text-dark font-monospace fw-bold";
                case "P3": return "bg-info text-dark font-monospace";
                case "P4": return "bg-secondary text-light font-monospace";
                default: return "bg-secondary";
            }
        },
        getStatusBadgeClass(st) {
            switch (st) {
                case "OPEN": return "bg-danger";
                case "ACKNOWLEDGED": return "bg-warning text-dark";
                case "IN_PROGRESS": return "bg-primary";
                case "MONITORING": return "bg-info text-dark";
                case "RESOLVED": return "bg-success";
                case "CLOSED": return "bg-secondary";
                default: return "bg-secondary";
            }
        },
        formatDate(dateStr) {
            if (!dateStr) {
                return "--";
            }
            return new Date(dateStr).toLocaleString();
        },
    },
};
</script>

<style scoped>
.noc-incidents-page {
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
}

.noc-create-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
    transition: all 0.2s ease-in-out;
}

.noc-create-btn:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: 0 0 15px rgba(255, 153, 51, 0.35);
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--input-text);
    border-radius: 8px;
}

.noc-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 10px;
    height: 100%;
}

.border-left-amber { border-left: 4px solid #ff9933; }
.border-left-danger { border-left: 4px solid #dc2626; }
.border-left-warning { border-left: 4px solid #f59e0b; }
.border-left-info { border-left: 4px solid #0ea5e9; }

.noc-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--muted-foreground);
}

.noc-card-value {
    font-size: 1.75rem;
    font-weight: 800;
}

.noc-section-box {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.hover-warning:hover {
    color: var(--accent) !important;
}
</style>
