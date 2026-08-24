<template>
    <div class="noc-topology-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="sitemap" />
                    <span>Network Topology & Dependency Correlation</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Model upstream/downstream relationships to eliminate alert storms for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="showAddModal = true">
                <font-awesome-icon icon="plus-circle" />
                <span>Add Dependency Link</span>
            </button>
        </div>

        <!-- Devices List & Hierarchy Grid -->
        <div class="row g-4">
            <div class="col-12 col-lg-8">
                <div class="noc-section-box p-3">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="project-diagram" />
                        <span>Configured Dependency Links</span>
                    </h5>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                                    <th>Upstream Parent</th>
                                    <th>Link Relationship</th>
                                    <th>Downstream Child</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="link in dependencyList" :key="link.id">
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="network-wired" class="me-2 text-warning" />
                                        {{ getDeviceName(link.parent_device_id) }}
                                    </td>
                                    <td>
                                        <span class="badge bg-secondary font-monospace">
                                            <font-awesome-icon icon="long-arrow-alt-right" class="me-1" />
                                            {{ link.dependency_type }}
                                        </span>
                                    </td>
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="desktop" class="me-2 text-info" />
                                        {{ getDeviceName(link.child_device_id) }}
                                    </td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-danger" title="Remove Link" @click="deleteLink(link.id)">
                                            <font-awesome-icon icon="trash" />
                                        </button>
                                    </td>
                                </tr>
                                <tr v-if="dependencyList.length === 0">
                                    <td colspan="4" class="text-center py-5 text-muted">
                                        <font-awesome-icon icon="sitemap" class="display-3 mb-3 text-secondary" />
                                        <h5>No Dependency Links Configured</h5>
                                        <p class="small text-secondary">Establish parent-child relationships between Core Routers, Switches, OLTs, and Servers to enable automated alert storm suppression.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-12 col-lg-4">
                <div class="noc-section-box p-3 shadow-sm">
                    <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="shield-alt" />
                        <span>Conservative Alert Storm Prevention</span>
                    </h6>
                    <p class="small text-secondary mb-3">
                        When an upstream core device goes down, InfiniNOC automatically groups all cascading downstream device failures under a single <strong>P1 Root Incident</strong>.
                    </p>
                    <div class="p-2 rounded bg-dark border border-secondary text-light small font-monospace">
                        Core Router (Down) <br />
                        └─ Aggregation Switch (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;└─ OLT 01 (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ ONU (Suppressed)
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Dependency Link -->
        <div v-if="showAddModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="sitemap" />
                            <span>Add Dependency Relationship</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAddModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-light small fw-bold text-uppercase">Upstream Parent Device</label>
                            <select v-model="newDep.parentDeviceId" class="form-select noc-input">
                                <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.ip_address }})</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-light small fw-bold text-uppercase">Dependency Type</label>
                            <select v-model="newDep.dependencyType" class="form-select noc-input">
                                <option value="UPSTREAM">UPSTREAM (Parent feeds network to child)</option>
                                <option value="DOWNSTREAM">DOWNSTREAM (Child connects to parent)</option>
                                <option value="DEPENDS_ON">DEPENDS_ON (Strict operational dependency)</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label text-light small fw-bold text-uppercase">Downstream Child Device</label>
                            <select v-model="newDep.childDeviceId" class="form-select noc-input">
                                <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.ip_address }})</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAddModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newDep.parentDeviceId || !newDep.childDeviceId || newDep.parentDeviceId === newDep.childDeviceId" @click="saveDependency">
                            Establish Link
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
            devices: [],
            dependencyList: [],
            showAddModal: false,
            newDep: {
                parentDeviceId: null,
                childDeviceId: null,
                dependencyType: "UPSTREAM",
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
            this.$root.getSocket().emit("getDeviceList", (res) => {
                if (res && res.ok) {
                    this.devices = res.devices || [];
                }
            });
            // Fetch dependency links for devices
            // We can iterate devices or fetch via device dependencies
            this.loadAllDependencies();
        },
        loadAllDependencies() {
            this.dependencyList = [];
            if (this.devices.length === 0) {
                return;
            }
            for (const d of this.devices) {
                this.$root.getSocket().emit("getDeviceDependencies", d.id, (res) => {
                    if (res && res.ok && res.children) {
                        for (const childLink of res.children) {
                            if (!this.dependencyList.some((x) => x.id === childLink.id)) {
                                this.dependencyList.push(childLink);
                            }
                        }
                    }
                });
            }
        },
        saveDependency() {
            if (!this.newDep.parentDeviceId || !this.newDep.childDeviceId) {
                return;
            }
            this.$root.getSocket().emit("addDeviceDependency", this.newDep, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Dependency link created");
                    this.showAddModal = false;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error establishing link");
                }
            });
        },
        deleteLink(linkId) {
            if (confirm("Delete this network dependency link?")) {
                this.$root.getSocket().emit("deleteDeviceDependency", linkId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Dependency link removed");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error removing link");
                    }
                });
            }
        },
        getDeviceName(devId) {
            const dev = this.devices.find((d) => d.id === Number(devId));
            return dev ? `${dev.name} (${dev.ip_address})` : `Device #${devId}`;
        },
    },
};
</script>

<style scoped>
.noc-topology-page {
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
