<template>
    <div class="noc-sites-page p-3 p-md-4">
        <!-- Top Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="globe" />
                    <span>Physical Sites & POPs</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Infrastructure location management scoped to <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="openCreateModal">
                <font-awesome-icon icon="plus-circle" />
                <span>Create Site</span>
            </button>
        </div>

        <!-- Search & Filter Bar -->
        <div class="row g-2 mb-4">
            <div class="col-12 col-md-6 col-lg-4">
                <div class="input-group">
                    <span class="input-group-text text-secondary" style="background-color: var(--secondary); border-color: var(--border);">
                        <font-awesome-icon icon="search" />
                    </span>
                    <input
                        v-model="searchText"
                        type="text"
                        class="form-control noc-input"
                        placeholder="Search sites by name or code..."
                    />
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
                <select v-model="selectedStatus" class="form-select noc-input">
                    <option value="ALL">All Statuses</option>
                    <option value="Operational">Operational</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Down">Down</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Unknown">Unknown</option>
                </select>
            </div>
        </div>

        <!-- Sites List Cards Grid -->
        <div class="row g-3">
            <div v-for="site in filteredSites" :key="site.id" class="col-12 col-md-6 col-lg-4">
                <div class="noc-site-card p-3 shadow-sm h-100 d-flex flex-column justify-content-between">
                    <div>
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <router-link :to="`/sites/${site.id}`" class="h5 fw-bold noc-site-title text-decoration-none d-block">
                                    {{ site.name }}
                                </router-link>
                                <span class="badge bg-secondary text-warning small font-monospace">
                                    {{ site.code }}
                                </span>
                            </div>
                            <span class="badge" :class="getStatusBadgeClass(site.status)">
                                {{ site.status.toUpperCase() }}
                            </span>
                        </div>

                        <p class="text-secondary small mb-3 text-truncate-2">
                            {{ site.description || site.address || 'No location description provided.' }}
                        </p>

                        <!-- Telemetry Pill Summary -->
                        <div class="row g-2 text-center py-2 rounded border mb-3 small" style="background-color: var(--secondary); border-color: var(--border) !important;">
                            <div class="col-4">
                                <div class="text-muted">Devices</div>
                                <div class="fw-bold">{{ site.health ? site.health.totalDevices : 0 }}</div>
                            </div>
                            <div class="col-4">
                                <div class="text-muted">Monitors</div>
                                <div class="fw-bold text-info">{{ site.health ? site.health.totalMonitors : 0 }}</div>
                            </div>
                            <div class="col-4">
                                <div class="text-muted">Uptime</div>
                                <div class="fw-bold text-success">{{ site.health ? site.health.uptime : 100 }}%</div>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                        <span class="text-muted small">
                            <font-awesome-icon icon="clock" class="me-1" />
                            {{ site.timezone || 'UTC' }}
                        </span>
                        <router-link :to="`/sites/${site.id}`" class="btn btn-sm btn-outline-warning fw-semibold">
                            View Dashboard &rarr;
                        </router-link>
                    </div>
                </div>
            </div>

            <div v-if="filteredSites.length === 0" class="col-12 text-center py-5 text-muted">
                <font-awesome-icon icon="globe" class="display-3 mb-3 text-secondary" />
                <h5>No physical sites found</h5>
                <p class="small text-secondary">Click "Create Site" above to register a physical network location.</p>
            </div>
        </div>

        <!-- Create Site Modal -->
        <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="globe" />
                            <span>Create Physical Network Site</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Site Name</label>
                            <input
                                v-model="newSite.name"
                                type="text"
                                class="form-control noc-input"
                                placeholder="e.g. Vijayawada POP"
                                @input="autoGenerateCode"
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Site Code</label>
                            <input
                                v-model="newSite.code"
                                type="text"
                                class="form-control noc-input"
                                placeholder="e.g. VJA-POP-01"
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Description / Address</label>
                            <textarea
                                v-model="newSite.description"
                                class="form-control noc-input"
                                rows="2"
                                placeholder="Physical location address or details..."
                            ></textarea>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Timezone</label>
                                <input
                                    v-model="newSite.timezone"
                                    type="text"
                                    class="form-control noc-input"
                                    placeholder="e.g. Asia/Kolkata"
                                />
                            </div>
                            <div class="col-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Initial Status</label>
                                <select v-model="newSite.status" class="form-select noc-input">
                                    <option value="Operational">Operational</option>
                                    <option value="Degraded">Degraded</option>
                                    <option value="Down">Down</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Unknown">Unknown</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateModal = false">
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn noc-create-btn px-4 fw-bold"
                            :disabled="!newSite.name || !newSite.code || submitting"
                            @click="createSite"
                        >
                            <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                            <span>Create Site</span>
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
            sites: [],
            searchText: "",
            selectedStatus: "ALL",
            showCreateModal: false,
            submitting: false,
            newSite: {
                name: "",
                code: "",
                description: "",
                timezone: "Asia/Kolkata",
                status: "Operational",
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
        filteredSites() {
            return this.sites.filter((site) => {
                const matchesSearch =
                    site.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
                    site.code.toLowerCase().includes(this.searchText.toLowerCase());
                const matchesStatus =
                    this.selectedStatus === "ALL" || site.status === this.selectedStatus;
                return matchesSearch && matchesStatus;
            });
        },
    },
    watch: {
        "$root.activeOrganizationId"() {
            this.loadSites();
        },
    },
    mounted() {
        this.loadSites();
    },
    methods: {
        loadSites() {
            this.$root.getSocket().emit("getSiteList", (res) => {
                if (res && res.ok) {
                    this.sites = res.sites || [];
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to load sites");
                }
            });
        },
        openCreateModal() {
            this.showCreateModal = true;
            this.newSite = {
                name: "",
                code: "",
                description: "",
                timezone: "Asia/Kolkata",
                status: "Operational",
            };
        },
        autoGenerateCode() {
            if (this.newSite.name) {
                this.newSite.code = this.newSite.name
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "-")
                    .replace(/-+/g, "-");
            }
        },
        createSite() {
            if (!this.newSite.name || !this.newSite.code || this.submitting) {
                return;
            }
            this.submitting = true;
            this.$root.getSocket().emit("addSite", this.newSite, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    this.$root.toastSuccess("Site created successfully");
                    this.showCreateModal = false;
                    this.loadSites();
                } else {
                    this.$root.toastError(res ? res.msg : "Error creating site");
                }
            });
        },
        getStatusBadgeClass(status) {
            if (status === "Operational") {
                return "bg-success";
            }
            if (status === "Degraded") {
                return "bg-warning text-dark";
            }
            if (status === "Down") {
                return "bg-danger";
            }
            if (status === "Maintenance") {
                return "bg-info text-dark";
            }
            return "bg-secondary";
        },
    },
};
</script>

<style scoped>
.noc-sites-page {
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

.noc-site-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.noc-site-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border-color: var(--ring);
}

.noc-site-title {
    color: var(--accent);
    transition: color 0.15s ease-in-out;
}

.noc-site-title:hover {
    color: var(--foreground);
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.text-truncate-2 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
