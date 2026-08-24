<template>
    <div class="noc-probes-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="satellite-dish" />
                    <span>Remote Distributed Probes</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Outbound-only customer ISP network probes scoped to <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="openCreateModal">
                <font-awesome-icon icon="plus-circle" />
                <span>Register New Probe</span>
            </button>
        </div>

        <!-- 4 Summary Telemetry Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-amber">
                    <div class="noc-card-title mb-1">Total Probes</div>
                    <div class="noc-card-value text-foreground">{{ probes.length }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-success">
                    <div class="noc-card-title mb-1">Online</div>
                    <div class="noc-card-value text-success">{{ onlineCount }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-danger">
                    <div class="noc-card-title mb-1">Offline</div>
                    <div class="noc-card-value text-danger">{{ offlineCount }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-secondary">
                    <div class="noc-card-title mb-1">Revoked</div>
                    <div class="noc-card-value text-secondary">{{ revokedCount }}</div>
                </div>
            </div>
        </div>

        <!-- Real-Time Probe Inventory Table -->
        <div class="noc-section-box p-3">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Status</th>
                            <th>Probe Name</th>
                            <th>Physical Site</th>
                            <th>IP Address</th>
                            <th>Latency</th>
                            <th>Version</th>
                            <th>Last Heartbeat</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in probes" :key="p.id">
                            <td>
                                <span class="badge" :class="getStatusBadgeClass(p.status)">
                                    {{ (p.status || 'pending').toUpperCase() }}
                                </span>
                            </td>
                            <td>
                                <div class="fw-bold text-foreground">{{ p.name }}</div>
                                <div class="small text-muted text-truncate" style="max-width: 200px;">
                                    {{ p.description || 'Remote ISP Probe' }}
                                </div>
                            </td>
                            <td>
                                <span v-if="p.site_name" class="badge bg-dark border border-secondary text-info">
                                    <font-awesome-icon icon="map-marker-alt" class="me-1" />
                                    {{ p.site_name }}
                                </span>
                                <span v-else class="text-secondary small">Global</span>
                            </td>
                            <td class="font-monospace small text-light">
                                {{ p.ip_address || 'Connecting...' }}
                            </td>
                            <td>
                                <span v-if="p.latency_ms !== null && p.latency_ms !== undefined" class="fw-bold text-info font-monospace">
                                    {{ p.latency_ms }} ms
                                </span>
                                <span v-else class="text-muted small">--</span>
                            </td>
                            <td>
                                <span class="badge bg-secondary font-monospace">v{{ p.version || '1.0.0' }}</span>
                            </td>
                            <td class="small text-muted">
                                <span v-if="p.last_heartbeat">
                                    <font-awesome-icon icon="clock" class="me-1" />
                                    {{ formatDate(p.last_heartbeat) }}
                                </span>
                                <span v-else>Never</span>
                            </td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-warning" title="Rotate Token" @click="rotateProbeToken(p.id)">
                                        <font-awesome-icon icon="sync-alt" />
                                    </button>
                                    <button v-if="p.status !== 'revoked'" class="btn btn-outline-danger" title="Revoke Probe" @click="revokeProbe(p.id)">
                                        <font-awesome-icon icon="ban" />
                                    </button>
                                    <button class="btn btn-outline-secondary" title="Delete Probe" @click="deleteProbe(p.id)">
                                        <font-awesome-icon icon="trash" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="probes.length === 0">
                            <td colspan="8" class="text-center py-5 text-muted">
                                <font-awesome-icon icon="satellite-dish" class="display-3 mb-3 text-secondary" />
                                <h5>No remote probes deployed</h5>
                                <p class="small text-secondary">Click "Register New Probe" to generate deployment tokens for your ISP/customer networks.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal 1: Register New Probe -->
        <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="satellite-dish" />
                            <span>Register New Remote Distributed Probe</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div v-if="!generatedTokenInfo">
                            <div class="mb-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Probe Name</label>
                                <input v-model="newProbe.name" type="text" class="form-control noc-input" placeholder="e.g. Vijayawada ISP Probe 01" />
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Physical Site Location</label>
                                <select v-model="newProbe.site_id" class="form-select noc-input">
                                    <option :value="null">Global / Customer Premises</option>
                                    <option v-for="site in sites" :key="site.id" :value="site.id">
                                        {{ site.name }} ({{ site.code }})
                                    </option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Description</label>
                                <textarea v-model="newProbe.description" class="form-control noc-input" rows="2" placeholder="Network deployment environment details..."></textarea>
                            </div>
                        </div>

                        <!-- One-Time Token & Docker Run Snippet Output -->
                        <div v-else class="p-3 bg-dark border border-warning rounded">
                            <div class="alert alert-warning py-2 mb-3 small d-flex align-items-center gap-2">
                                <font-awesome-icon icon="exclamation-triangle" class="fs-5" />
                                <span>Save this one-time registration token! It will be invalidated immediately after initial probe connection.</span>
                            </div>

                            <div class="mb-3">
                                <label class="form-label text-warning small fw-bold text-uppercase">One-Time Registration Token</label>
                                <div class="input-group">
                                    <input type="text" readonly class="form-control noc-input font-monospace text-warning" :value="generatedTokenInfo.registrationToken" />
                                    <button class="btn btn-warning fw-bold" @click="copyText(generatedTokenInfo.registrationToken)">Copy</button>
                                </div>
                            </div>

                            <div class="mb-0">
                                <label class="form-label text-light small fw-bold text-uppercase">Docker Deployment Command</label>
                                <pre class="p-3 bg-black text-success rounded font-monospace small mb-2 overflow-x-auto">{{ getDockerCommandSnippet(generatedTokenInfo) }}</pre>
                                <button class="btn btn-sm btn-outline-warning fw-bold float-end" @click="copyText(getDockerCommandSnippet(generatedTokenInfo))">
                                    Copy Docker Command
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateModal = false">
                            {{ generatedTokenInfo ? 'Done' : 'Cancel' }}
                        </button>
                        <button v-if="!generatedTokenInfo" type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newProbe.name || submitting" @click="createProbe">
                            <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                            <span>Generate Token</span>
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
            probes: [],
            sites: [],
            showCreateModal: false,
            submitting: false,
            newProbe: {
                name: "",
                site_id: null,
                description: "",
            },
            generatedTokenInfo: null,
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        onlineCount() {
            return this.probes.filter((p) => p.status === "online").length;
        },
        offlineCount() {
            return this.probes.filter((p) => p.status === "offline").length;
        },
        revokedCount() {
            return this.probes.filter((p) => p.status === "revoked").length;
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
            this.$root.getSocket().emit("getProbeList", (res) => {
                if (res && res.ok) {
                    this.probes = res.probes || [];
                }
            });
            this.$root.getSocket().emit("getSiteList", (res) => {
                if (res && res.ok) {
                    this.sites = res.sites || [];
                }
            });
        },
        openCreateModal() {
            this.showCreateModal = true;
            this.generatedTokenInfo = null;
            this.newProbe = { name: "", site_id: null, description: "" };
        },
        createProbe() {
            if (!this.newProbe.name || this.submitting) {
                return;
            }
            this.submitting = true;
            this.$root.getSocket().emit("createProbeToken", this.newProbe, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    this.generatedTokenInfo = res;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error generating probe token");
                }
            });
        },
        revokeProbe(probeId) {
            if (confirm("Are you sure you want to revoke this probe? Outbound connections will be immediately rejected.")) {
                this.$root.getSocket().emit("revokeProbe", probeId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Probe revoked");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error revoking probe");
                    }
                });
            }
        },
        rotateProbeToken(probeId) {
            if (confirm("Rotate probe credentials? A new one-time token will be generated.")) {
                this.$root.getSocket().emit("rotateProbeToken", probeId, (res) => {
                    if (res && res.ok) {
                        this.showCreateModal = true;
                        this.generatedTokenInfo = res;
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error rotating token");
                    }
                });
            }
        },
        deleteProbe(probeId) {
            if (confirm("Are you sure you want to delete this probe record?")) {
                this.$root.getSocket().emit("deleteProbe", probeId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Probe deleted");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error deleting probe");
                    }
                });
            }
        },
        getDockerCommandSnippet(info) {
            const host = window.location.origin;
            return `docker run -d \\
  --name infininoc-probe-${info.probe.id} \\
  --restart always \\
  -e PROBE_CLOUD_URL="${host}" \\
  -e PROBE_ID="${info.probe.id}" \\
  -e PROBE_REGISTRATION_TOKEN="${info.registrationToken}" \\
  -v probe-data:/app/data \\
  infininoc/probe:latest`;
        },
        copyText(text) {
            navigator.clipboard.writeText(text);
            this.$root.toastSuccess("Copied to clipboard");
        },
        getStatusBadgeClass(status) {
            if (status === "online") {
                return "bg-success";
            }
            if (status === "offline") {
                return "bg-danger";
            }
            if (status === "revoked") {
                return "bg-secondary";
            }
            return "bg-warning text-dark";
        },
        formatDate(dateStr) {
            if (!dateStr) {
                return "--";
            }
            const date = new Date(dateStr);
            return date.toLocaleTimeString();
        },
    },
};
</script>

<style scoped>
.noc-probes-page {
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

.noc-input:focus {
    border-color: var(--ring);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.noc-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 10px;
    height: 100%;
}

.border-left-amber { border-left: 4px solid #ff9933; }
.border-left-success { border-left: 4px solid #2ecc71; }
.border-left-danger { border-left: 4px solid #dc2626; }
.border-left-secondary { border-left: 4px solid #64748b; }

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
</style>
