<template>
    <div class="noc-devices-page p-3 p-md-4">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="server" />
                    <span>Hardware Device Inventory</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Infrastructure nodes & hardware inventory scoped to <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="openCreateModal">
                <font-awesome-icon icon="plus-circle" />
                <span>Add Device</span>
            </button>
        </div>

        <!-- Filter Bar -->
        <div class="row g-2 mb-4">
            <div class="col-12 col-md-5 col-lg-4">
                <div class="input-group">
                    <span class="input-group-text text-secondary" style="background-color: var(--secondary); border-color: var(--border);">
                        <font-awesome-icon icon="search" />
                    </span>
                    <input
                        v-model="searchText"
                        type="text"
                        class="form-control noc-input"
                        placeholder="Search by name, IP, vendor, model..."
                    />
                </div>
            </div>
            <div class="col-6 col-md-3.5 col-lg-3">
                <select v-model="selectedType" class="form-select noc-input">
                    <option value="ALL">All Device Types</option>
                    <option value="Router">Router</option>
                    <option value="MikroTik">MikroTik</option>
                    <option value="Switch">Switch</option>
                    <option value="OLT">OLT</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Server">Server</option>
                    <option value="Access Point">Access Point</option>
                    <option value="UPS">UPS</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="col-6 col-md-3.5 col-lg-3">
                <select v-model="selectedSiteId" class="form-select noc-input">
                    <option :value="null">All Sites</option>
                    <option v-for="site in sites" :key="site.id" :value="site.id">
                        {{ site.name }} ({{ site.code }})
                    </option>
                </select>
            </div>
        </div>

        <!-- Devices Grid -->
        <div class="row g-3">
            <div v-for="dev in filteredDevices" :key="dev.id" class="col-12 col-md-6 col-lg-4">
                <div class="noc-device-card p-3 shadow-sm h-100 d-flex flex-column justify-content-between">
                    <div>
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <router-link :to="`/devices/${dev.id}`" class="h5 fw-bold noc-device-title text-decoration-none d-block">
                                    {{ dev.name }}
                                </router-link>
                                <div class="d-flex align-items-center gap-1 mt-1">
                                    <span class="badge bg-secondary text-warning small">
                                        {{ dev.device_type }}
                                    </span>
                                    <span v-if="dev.site_name" class="badge bg-secondary text-info small">
                                        <font-awesome-icon icon="map-marker-alt" class="me-1" />
                                        {{ dev.site_name }}
                                    </span>
                                </div>
                            </div>
                            <span class="badge" :class="dev.status === 'online' ? 'noc-badge-success' : 'noc-badge-danger'">
                                {{ (dev.status || 'online').toUpperCase() }}
                            </span>
                        </div>

                        <div class="p-2 rounded border mb-3 small" style="background-color: var(--secondary); border-color: var(--border) !important;">
                            <div class="d-flex justify-content-between mb-1">
                                <span class="text-muted">IP Address:</span>
                                <span class="font-monospace fw-bold">{{ dev.ip_address || 'Unassigned' }}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span class="text-muted">Vendor / Model:</span>
                                <span>{{ dev.vendor || 'Generic' }} {{ dev.model || '' }}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">Assigned Monitors:</span>
                                <span class="text-warning fw-bold">{{ dev.assigned_monitors_count || 0 }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                        <span class="text-muted small font-monospace">
                            {{ dev.hostname || 'No Hostname' }}
                        </span>
                        <router-link :to="`/devices/${dev.id}`" class="btn btn-sm btn-outline-warning fw-semibold">
                            View Details &rarr;
                        </router-link>
                    </div>
                </div>
            </div>

            <div v-if="filteredDevices.length === 0" class="col-12 text-center py-5 text-muted">
                <font-awesome-icon icon="server" class="display-3 mb-3 text-secondary" />
                <h5>No hardware devices found</h5>
                <p class="small text-secondary">Click "Add Device" above to add Routers, MikroTik, Switches, Servers, or UPS nodes.</p>
            </div>
        </div>

        <!-- Add Device Modal -->
        <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="plus-circle" />
                            <span>Add Hardware Device to Inventory</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3">
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Device Name</label>
                                <input v-model="newDevice.name" type="text" class="form-control noc-input" placeholder="e.g. Core Router VJA-01" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Device Type</label>
                                <select v-model="newDevice.device_type" class="form-select noc-input">
                                    <option value="Router">Router</option>
                                    <option value="MikroTik">MikroTik</option>
                                    <option value="Switch">Switch</option>
                                    <option value="OLT">OLT</option>
                                    <option value="Firewall">Firewall</option>
                                    <option value="Server">Server</option>
                                    <option value="Access Point">Access Point</option>
                                    <option value="UPS">UPS</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Physical Site Location</label>
                                <select v-model="newDevice.site_id" class="form-select noc-input">
                                    <option :value="null">Unassigned / Global</option>
                                    <option v-for="site in sites" :key="site.id" :value="site.id">
                                        {{ site.name }} ({{ site.code }})
                                    </option>
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Hostname</label>
                                <input v-model="newDevice.hostname" type="text" class="form-control noc-input" placeholder="e.g. cr01.vja.infininoc.net" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">IPv4 Address</label>
                                <input v-model="newDevice.ip_address" type="text" class="form-control noc-input" placeholder="e.g. 10.100.1.1" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">IPv6 Address</label>
                                <input v-model="newDevice.ipv6_address" type="text" class="form-control noc-input" placeholder="e.g. 2001:db8::1" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Vendor</label>
                                <input v-model="newDevice.vendor" type="text" class="form-control noc-input" placeholder="e.g. Cisco / MikroTik" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Model</label>
                                <input v-model="newDevice.model" type="text" class="form-control noc-input" placeholder="e.g. CCR2004-16G-2S+" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Serial Number</label>
                                <input v-model="newDevice.serial_number" type="text" class="form-control noc-input" placeholder="e.g. SN123456789" />
                            </div>
                            <div class="col-12">
                                <label class="form-label fw-semibold text-light small text-uppercase">Description</label>
                                <textarea v-model="newDevice.description" class="form-control noc-input" rows="2" placeholder="Hardware rack position or notes..."></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newDevice.name || submitting" @click="createDevice">
                            <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                            <span>Add Device</span>
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
            sites: [],
            searchText: "",
            selectedType: "ALL",
            selectedSiteId: null,
            showCreateModal: false,
            submitting: false,
            newDevice: {
                name: "",
                device_type: "Router",
                site_id: null,
                hostname: "",
                ip_address: "",
                ipv6_address: "",
                vendor: "",
                model: "",
                serial_number: "",
                description: "",
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
        filteredDevices() {
            return this.devices.filter((dev) => {
                const query = this.searchText.toLowerCase();
                const matchesSearch =
                    dev.name.toLowerCase().includes(query) ||
                    (dev.ip_address && dev.ip_address.toLowerCase().includes(query)) ||
                    (dev.vendor && dev.vendor.toLowerCase().includes(query)) ||
                    (dev.model && dev.model.toLowerCase().includes(query));
                const matchesType = this.selectedType === "ALL" || dev.device_type.toLowerCase() === this.selectedType.toLowerCase();
                const matchesSite = !this.selectedSiteId || dev.site_id === this.selectedSiteId;
                return matchesSearch && matchesType && matchesSite;
            });
        },
    },
    watch: {
        "$route.params.type"(newType) {
            if (newType) {
                this.syncTypeFilter(newType);
            }
        },
        "$root.activeOrganizationId"() {
            this.loadData();
        },
    },
    mounted() {
        if (this.$route.params && this.$route.params.type) {
            this.syncTypeFilter(this.$route.params.type);
        }
        this.loadData();
    },
    methods: {
        syncTypeFilter(typeParam) {
            const typesMap = {
                routers: "Router",
                mikrotik: "MikroTik",
                switches: "Switch",
                olts: "OLT",
                servers: "Server",
                other: "Other",
            };
            this.selectedType = typesMap[typeParam.toLowerCase()] || "ALL";
        },
        loadData() {
            this.$root.getSocket().emit("getDeviceList", (res) => {
                if (res && res.ok) {
                    this.devices = res.devices || [];
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
            this.newDevice = {
                name: "",
                device_type: this.selectedType !== "ALL" ? this.selectedType : "Router",
                site_id: this.selectedSiteId || null,
                hostname: "",
                ip_address: "",
                ipv6_address: "",
                vendor: "",
                model: "",
                serial_number: "",
                description: "",
            };
        },
        createDevice() {
            if (!this.newDevice.name || this.submitting) {
                return;
            }
            this.submitting = true;
            this.$root.getSocket().emit("addDevice", this.newDevice, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    this.$root.toastSuccess("Device added to inventory");
                    this.showCreateModal = false;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error creating device");
                }
            });
        },
    },
};
</script>

<style scoped>
.noc-devices-page {
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

.noc-device-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.noc-device-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    border-color: var(--ring);
}

.noc-device-title {
    color: var(--accent);
    transition: color 0.15s ease-in-out;
}

.noc-device-title:hover {
    color: var(--foreground);
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
