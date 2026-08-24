<template>
    <div v-if="site" class="noc-site-details p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                    <router-link to="/sites" class="btn btn-sm btn-outline-secondary">
                        &larr; Back to Sites
                    </router-link>
                    <span class="badge" :class="getStatusBadgeClass(site.status)">
                        {{ site.status ? site.status.toUpperCase() : 'UNKNOWN' }}
                    </span>
                    <span class="badge bg-dark border border-secondary text-warning font-monospace">
                        {{ site.code }}
                    </span>
                </div>
                <h1 class="h3 fw-bold mb-0 text-light">{{ site.name }}</h1>
                <p class="text-secondary small mb-0">{{ site.description || site.address || 'Physical Location Site' }}</p>
            </div>

            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-warning fw-bold" @click="showEditModal = true">
                    <font-awesome-icon icon="edit" class="me-1" />
                    Edit Site
                </button>
                <button class="btn btn-sm btn-outline-danger fw-bold" @click="confirmDeleteSite">
                    <font-awesome-icon icon="trash-alt" class="me-1" />
                    Delete
                </button>
            </div>
        </div>

        <!-- 6 Site Dashboard Telemetry Cards -->
        <div class="row g-3 mb-4">
            <!-- 1. Total Devices -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm border-left-amber">
                    <div class="noc-card-title mb-1">Total Devices</div>
                    <div class="noc-card-value text-light">{{ site.health ? site.health.totalDevices : 0 }}</div>
                    <div class="text-muted small mt-1">Hardware inventory</div>
                </div>
            </div>

            <!-- 2. Online -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm border-left-success">
                    <div class="noc-card-title mb-1">Online</div>
                    <div class="noc-card-value text-success">{{ site.health ? site.health.onlineDevices : 0 }}</div>
                    <div class="text-muted small mt-1">Reachable nodes</div>
                </div>
            </div>

            <!-- 3. Offline -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm border-left-danger">
                    <div class="noc-card-title mb-1">Offline</div>
                    <div class="noc-card-value text-danger">{{ site.health ? site.health.offlineDevices : 0 }}</div>
                    <div class="text-muted small mt-1">Unreachable nodes</div>
                </div>
            </div>

            <!-- 4. Active Alerts -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm border-left-warning">
                    <div class="noc-card-title mb-1">Active Alerts</div>
                    <div class="noc-card-value text-warning">{{ site.health ? site.health.activeAlerts : 0 }}</div>
                    <div class="text-muted small mt-1">Org alert rules</div>
                </div>
            </div>

            <!-- 5. Active Incidents -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm" :class="site.health && site.health.activeIncidents > 0 ? 'border-left-danger' : 'border-left-secondary'">
                    <div class="noc-card-title mb-1">Active Incidents</div>
                    <div class="noc-card-value" :class="site.health && site.health.activeIncidents > 0 ? 'text-danger' : 'text-light'">
                        {{ site.health ? site.health.activeIncidents : 0 }}
                    </div>
                    <div class="text-muted small mt-1">Site outages</div>
                </div>
            </div>

            <!-- 6. Uptime -->
            <div class="col-6 col-sm-4 col-lg-2">
                <div class="noc-card p-3 shadow-sm border-left-blue">
                    <div class="noc-card-title mb-1">Uptime Ratio</div>
                    <div class="noc-card-value text-info">
                        {{ site.health ? site.health.uptime : 100 }}<span class="fs-6">%</span>
                    </div>
                    <div class="text-muted small mt-1">Aggregate health</div>
                </div>
            </div>
        </div>

        <!-- Two Column Content: Assigned Monitors & Devices -->
        <div class="row g-3">
            <!-- Left Column: Assigned Monitors -->
            <div class="col-12 col-lg-6">
                <div class="noc-section-box p-3 h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="desktop" />
                            <span>Assigned Monitors ({{ site.monitors ? site.monitors.length : 0 }})</span>
                        </h2>
                        <button class="btn btn-xs btn-outline-warning fw-bold" @click="openAssignMonitorsModal">
                            Assign Monitors
                        </button>
                    </div>

                    <div v-if="site.monitors && site.monitors.length > 0" class="d-flex flex-column gap-2">
                        <div
                            v-for="m in site.monitors"
                            :key="m.id"
                            class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center"
                        >
                            <div class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="desktop" class="text-warning" />
                                <router-link :to="`/dashboard/${m.id}`" class="noc-link fw-semibold">
                                    {{ m.name }}
                                </router-link>
                                <span class="badge bg-secondary text-uppercase small" style="font-size: 0.65rem;">
                                    {{ m.type }}
                                </span>
                            </div>
                            <span class="badge" :class="m.active ? 'bg-success' : 'bg-secondary'">
                                {{ m.active ? 'ACTIVE' : 'PAUSED' }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="text-center text-muted py-4">
                        No monitors linked to this site. Click "Assign Monitors" to link infrastructure targets.
                    </div>
                </div>
            </div>

            <!-- Right Column: Site Devices Inventory -->
            <div class="col-12 col-lg-6">
                <div class="noc-section-box p-3 h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="server" />
                            <span>Hardware Device Inventory ({{ site.devices ? site.devices.length : 0 }})</span>
                        </h2>
                        <button class="btn btn-xs btn-outline-warning fw-bold" @click="showAddDeviceModal = true">
                            Add Device
                        </button>
                    </div>

                    <div v-if="site.devices && site.devices.length > 0" class="d-flex flex-column gap-2">
                        <div
                            v-for="d in site.devices"
                            :key="d.id"
                            class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center"
                        >
                            <div>
                                <div class="fw-bold text-light d-flex align-items-center gap-2">
                                    <span>{{ d.device_name }}</span>
                                    <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">
                                        {{ d.device_type }}
                                    </span>
                                </div>
                                <div class="small text-muted font-monospace">{{ d.ip_address || 'No IP address' }}</div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge" :class="d.status === 'online' ? 'bg-success' : 'bg-danger'">
                                    {{ d.status.toUpperCase() }}
                                </span>
                                <button class="btn btn-xs btn-outline-danger" @click="deleteDevice(d.id)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-center text-muted py-4">
                        No hardware devices configured at this site. Click "Add Device" to add Routers, Switches, or Servers.
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 1: Edit Site -->
        <div v-if="showEditModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Edit Physical Site Details</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Site Name</label>
                            <input v-model="editForm.name" type="text" class="form-control noc-input" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Site Code</label>
                            <input v-model="editForm.code" type="text" class="form-control noc-input" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Description</label>
                            <textarea v-model="editForm.description" class="form-control noc-input" rows="2"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Status</label>
                            <select v-model="editForm.status" class="form-select noc-input">
                                <option value="Operational">Operational</option>
                                <option value="Degraded">Degraded</option>
                                <option value="Down">Down</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showEditModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" @click="saveEditSite">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 2: Assign Monitors -->
        <div v-if="showAssignMonitorsModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Assign Monitors to {{ site.name }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAssignMonitorsModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3" style="max-height: 350px; overflow-y: auto;">
                        <div v-for="m in availableMonitors" :key="m.id" class="form-check py-1">
                            <input
                                :id="`m-${m.id}`"
                                v-model="selectedMonitorIds"
                                :value="m.id"
                                type="checkbox"
                                class="form-check-input"
                            />
                            <label :for="`m-${m.id}`" class="form-check-label text-light fw-medium">
                                {{ m.name }} <span class="text-muted small">({{ m.type }})</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAssignMonitorsModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" @click="saveAssignedMonitors">Save Assignments</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 3: Add Device -->
        <div v-if="showAddDeviceModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Add Hardware Device to Site</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAddDeviceModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Device Name</label>
                            <input v-model="newDevice.device_name" type="text" class="form-control noc-input" placeholder="e.g. Core Router VJA-01" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Device Type</label>
                            <select v-model="newDevice.device_type" class="form-select noc-input">
                                <option value="Router">Router</option>
                                <option value="Switch">Switch</option>
                                <option value="MikroTik">MikroTik</option>
                                <option value="Server">Server</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">IP Address</label>
                            <input v-model="newDevice.ip_address" type="text" class="form-control noc-input" placeholder="e.g. 192.168.1.1" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Status</label>
                            <select v-model="newDevice.status" class="form-select noc-input">
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAddDeviceModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" :disabled="!newDevice.device_name" @click="addDevice">Add Device</button>
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
            site: null,
            showEditModal: false,
            showAssignMonitorsModal: false,
            showAddDeviceModal: false,
            editForm: {},
            selectedMonitorIds: [],
            newDevice: {
                device_name: "",
                device_type: "Router",
                ip_address: "",
                status: "online",
            },
        };
    },
    computed: {
        siteId() {
            return Number(this.$route.params.id);
        },
        availableMonitors() {
            return Object.values(this.$root.monitorList);
        },
    },
    mounted() {
        this.loadSite();
    },
    methods: {
        loadSite() {
            this.$root.getSocket().emit("getSite", this.siteId, (res) => {
                if (res && res.ok) {
                    this.site = res.site;
                    this.editForm = { ...res.site };
                    this.selectedMonitorIds = res.site.monitors ? res.site.monitors.map((m) => m.id) : [];
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to load site details");
                }
            });
        },
        saveEditSite() {
            this.$root.getSocket().emit("editSite", { id: this.siteId, ...this.editForm }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Site updated successfully");
                    this.showEditModal = false;
                    this.loadSite();
                } else {
                    this.$root.toastError(res ? res.msg : "Error updating site");
                }
            });
        },
        confirmDeleteSite() {
            if (confirm(`Are you sure you want to delete site "${this.site.name}"?`)) {
                this.$root.getSocket().emit("deleteSite", this.siteId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Site deleted");
                        this.$router.push("/sites");
                    } else {
                        this.$root.toastError(res ? res.msg : "Error deleting site");
                    }
                });
            }
        },
        openAssignMonitorsModal() {
            this.selectedMonitorIds = this.site.monitors ? this.site.monitors.map((m) => m.id) : [];
            this.showAssignMonitorsModal = true;
        },
        saveAssignedMonitors() {
            this.$root.getSocket().emit("assignMonitorsToSite", { siteId: this.siteId, monitorIds: this.selectedMonitorIds }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Monitors assigned successfully");
                    this.showAssignMonitorsModal = false;
                    this.loadSite();
                } else {
                    this.$root.toastError(res ? res.msg : "Error assigning monitors");
                }
            });
        },
        addDevice() {
            if (!this.newDevice.device_name) {
                return;
            }
            this.$root.getSocket().emit("addDeviceToSite", { siteId: this.siteId, device: this.newDevice }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Device added to site");
                    this.showAddDeviceModal = false;
                    this.newDevice = { device_name: "", device_type: "Router", ip_address: "", status: "online" };
                    this.loadSite();
                } else {
                    this.$root.toastError(res ? res.msg : "Error adding device");
                }
            });
        },
        deleteDevice(deviceId) {
            this.$root.getSocket().emit("deleteDeviceFromSite", { siteId: this.siteId, deviceId }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Device removed");
                    this.loadSite();
                } else {
                    this.$root.toastError(res ? res.msg : "Error removing device");
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
.noc-site-details {
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
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
.border-left-warning { border-left: 4px solid #ff9933; }
.border-left-blue { border-left: 4px solid #3b82f6; }
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
    border-radius: 10px;
}

.noc-link {
    color: var(--accent);
    text-decoration: none;
}

.noc-link:hover {
    color: var(--foreground);
    text-decoration: underline;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--input-text);
    border-radius: 8px;
}

.noc-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
}
</style>
