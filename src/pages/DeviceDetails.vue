<template>
    <div v-if="device" class="noc-device-details p-3 p-md-4">
        <!-- Top Navigation Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                    <router-link to="/devices" class="btn btn-sm btn-outline-secondary">
                        &larr; Back to Devices
                    </router-link>
                    <span class="badge bg-warning text-dark font-monospace fw-bold">
                        {{ device.device_type }}
                    </span>
                    <span class="badge" :class="device.status === 'online' ? 'bg-success' : 'bg-danger'">
                        {{ (device.status || 'online').toUpperCase() }}
                    </span>
                </div>
                <h1 class="h3 fw-bold mb-0 text-light">{{ device.name }}</h1>
                <p class="text-secondary small mb-0 font-monospace">{{ device.hostname || 'No Hostname Configured' }}</p>
            </div>

            <div class="d-flex align-items-center gap-2">
                <router-link :to="'/devices/' + deviceId + '/olt'" class="btn btn-sm btn-outline-warning fw-bold">
                    <font-awesome-icon icon="server" class="me-1" />
                    OLT Dashboard
                </router-link>
                <router-link :to="'/devices/' + deviceId + '/mikrotik'" class="btn btn-sm btn-outline-danger fw-bold">
                    <font-awesome-icon icon="microchip" class="me-1" />
                    MikroTik Dashboard
                </router-link>
                <button class="btn btn-sm btn-outline-warning fw-bold" @click="showEditModal = true">
                    <font-awesome-icon icon="edit" class="me-1" />
                    Edit Device
                </button>
                <button class="btn btn-sm btn-outline-danger fw-bold" @click="confirmDeleteDevice">
                    <font-awesome-icon icon="trash-alt" class="me-1" />
                    Delete
                </button>
            </div>
        </div>

        <!-- Row 1: Key Metadata Cards -->
        <div class="row g-3 mb-4">
            <!-- 1. Identity & Type -->
            <div class="col-12 col-md-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm border-left-amber">
                    <div class="noc-card-title mb-1">Identity & Type</div>
                    <div class="fw-bold text-light fs-5">{{ device.name }}</div>
                    <div class="text-warning small mt-1 fw-medium">{{ device.device_type }}</div>
                </div>
            </div>

            <!-- 2. Physical Site -->
            <div class="col-12 col-md-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm border-left-blue">
                    <div class="noc-card-title mb-1">Physical Site</div>
                    <div class="fw-bold text-info fs-5">
                        <router-link v-if="device.site_id" :to="`/sites/${device.site_id}`" class="text-info text-decoration-none">
                            {{ device.site_name || 'Site #' + device.site_id }}
                        </router-link>
                        <span v-else class="text-secondary">Global / Unassigned</span>
                    </div>
                    <div class="text-muted small mt-1">Location POP</div>
                </div>
            </div>

            <!-- 3. Network Interfaces (IP / IPv6) -->
            <div class="col-12 col-md-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm border-left-success">
                    <div class="noc-card-title mb-1">IP Addresses</div>
                    <div class="fw-bold text-light font-monospace fs-6">{{ device.ip_address || 'No IPv4' }}</div>
                    <div class="text-muted small font-monospace mt-1">{{ device.ipv6_address || 'No IPv6' }}</div>
                </div>
            </div>

            <!-- 4. Hardware Vendor & Model -->
            <div class="col-12 col-md-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm border-left-secondary">
                    <div class="noc-card-title mb-1">Vendor & Model</div>
                    <div class="fw-bold text-light fs-6">{{ device.vendor || 'Generic' }} {{ device.model || '' }}</div>
                    <div class="text-muted small font-monospace mt-1">SN: {{ device.serial_number || 'N/A' }}</div>
                </div>
            </div>
        </div>

        <!-- Row 2: Status & Incident Telemetry -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm text-center">
                    <div class="text-muted small text-uppercase fw-bold">Monitoring Status</div>
                    <div class="h4 fw-bold mt-1" :class="device.status === 'online' ? 'text-success' : 'text-danger'">
                        {{ (device.status || 'online').toUpperCase() }}
                    </div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm text-center">
                    <div class="text-muted small text-uppercase fw-bold">Assigned Monitors</div>
                    <div class="h4 fw-bold text-info mt-1">{{ device.monitors ? device.monitors.length : 0 }}</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm text-center">
                    <div class="text-muted small text-uppercase fw-bold">Active Alerts</div>
                    <div class="h4 fw-bold text-warning mt-1">{{ device.activeAlerts || 0 }}</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="noc-card p-3 shadow-sm text-center">
                    <div class="text-muted small text-uppercase fw-bold">Active Incidents</div>
                    <div class="h4 fw-bold mt-1" :class="device.activeIncidents > 0 ? 'text-danger' : 'text-light'">
                        {{ device.activeIncidents || 0 }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Two Column Sections: Assigned Monitors & Encrypted Credentials Vault -->
        <div class="row g-3 mb-4">
            <!-- Left: Assigned Monitors -->
            <div class="col-12 col-lg-6">
                <div class="noc-section-box p-3 h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="desktop" />
                            <span>Assigned Monitors ({{ device.monitors ? device.monitors.length : 0 }})</span>
                        </h2>
                        <button class="btn btn-xs btn-outline-warning fw-bold" @click="openAssignMonitorsModal">
                            Assign Monitors
                        </button>
                    </div>

                    <div v-if="device.monitors && device.monitors.length > 0" class="d-flex flex-column gap-2">
                        <div v-for="m in device.monitors" :key="m.id" class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="desktop" class="text-warning" />
                                <router-link :to="`/dashboard/${m.id}`" class="noc-link fw-semibold">
                                    {{ m.name }}
                                </router-link>
                                <span class="badge bg-secondary text-uppercase small" style="font-size: 0.65rem;">{{ m.type }}</span>
                            </div>
                            <span class="badge" :class="m.active ? 'bg-success' : 'bg-secondary'">
                                {{ m.active ? 'ACTIVE' : 'PAUSED' }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="text-center text-muted py-4">
                        No active monitors linked to this hardware device. Click "Assign Monitors" to link ping/HTTP targets.
                    </div>
                </div>
            </div>

            <!-- Right: Encrypted Credential Vault -->
            <div class="col-12 col-lg-6">
                <div class="noc-section-box p-3 h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="lock" />
                            <span>Encrypted Credential Vault ({{ device.credentials ? device.credentials.length : 0 }})</span>
                        </h2>
                        <button class="btn btn-xs btn-outline-warning fw-bold" @click="showAddCredentialModal = true">
                            Add Credential
                        </button>
                    </div>

                    <div v-if="device.credentials && device.credentials.length > 0" class="d-flex flex-column gap-2">
                        <div v-for="c in device.credentials" :key="c.id" class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold text-light d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="shield-alt" class="text-success" />
                                    <span>{{ c.name }}</span>
                                    <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">{{ c.type }}</span>
                                </div>
                                <div class="small text-muted">AES-256-GCM Encrypted</div>
                            </div>
                            <button class="btn btn-xs btn-outline-danger" @click="deleteCredential(c.id)">
                                <font-awesome-icon icon="trash" />
                            </button>
                        </div>
                    </div>
                    <div v-else class="text-center text-muted py-4">
                        No credentials configured. Credentials (SNMP v2/v3, API tokens, SSH keys) are encrypted with AES-256-GCM.
                    </div>
                </div>
            </div>
        </div>

        <!-- SNMP Real Telemetry & Interface Traffic Section -->
        <div class="noc-section-box p-3 mb-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                    <font-awesome-icon icon="network-wired" />
                    <span>Real SNMP Telemetry & Network Interfaces</span>
                </h2>
                <button class="btn btn-xs btn-outline-warning fw-bold" @click="showSnmpConfigModal = true">
                    Configure SNMP
                </button>
            </div>

            <div class="row g-3 mb-3">
                <!-- CPU Load -->
                <div class="col-6 col-md-3">
                    <div class="p-3 bg-dark rounded border border-secondary text-center">
                        <div class="text-muted small text-uppercase fw-bold">CPU Load</div>
                        <div class="h4 fw-bold mt-1 text-info font-monospace">
                            {{ snmpMetrics && snmpMetrics.cpu !== null ? snmpMetrics.cpu + '%' : '--' }}
                        </div>
                    </div>
                </div>
                <!-- Memory -->
                <div class="col-6 col-md-3">
                    <div class="p-3 bg-dark rounded border border-secondary text-center">
                        <div class="text-muted small text-uppercase fw-bold">Memory</div>
                        <div class="h4 fw-bold mt-1 text-warning font-monospace">
                            {{ snmpMetrics && snmpMetrics.memory !== null ? snmpMetrics.memory + '%' : '--' }}
                        </div>
                    </div>
                </div>
                <!-- Uptime -->
                <div class="col-6 col-md-3">
                    <div class="p-3 bg-dark rounded border border-secondary text-center">
                        <div class="text-muted small text-uppercase fw-bold">System Uptime</div>
                        <div class="h4 fw-bold mt-1 text-success font-monospace">
                            {{ snmpMetrics && snmpMetrics.uptime ? formatUptime(snmpMetrics.uptime) : '--' }}
                        </div>
                    </div>
                </div>
                <!-- Temperature -->
                <div class="col-6 col-md-3">
                    <div class="p-3 bg-dark rounded border border-secondary text-center">
                        <div class="text-muted small text-uppercase fw-bold">Temperature</div>
                        <div class="h4 fw-bold mt-1 text-light font-monospace">
                            {{ snmpMetrics && snmpMetrics.temperature !== null ? snmpMetrics.temperature + ' °C' : 'N/A' }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Interface Telemetry Table -->
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Interface</th>
                            <th>Status</th>
                            <th>Inbound Traffic</th>
                            <th>Outbound Traffic</th>
                            <th>Errors</th>
                            <th>Total Packets</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(iface, key) in (snmpMetrics ? snmpMetrics.interfaces : {})" :key="key">
                            <td class="fw-bold text-light font-monospace">{{ iface.name || key }}</td>
                            <td>
                                <span class="badge" :class="iface.status === 'up' ? 'bg-success' : 'bg-danger'">
                                    {{ (iface.status || 'up').toUpperCase() }}
                                </span>
                            </td>
                            <td class="text-info font-monospace">{{ formatBps(getLastValue(iface.trafficIn)) }}</td>
                            <td class="text-warning font-monospace">{{ formatBps(getLastValue(iface.trafficOut)) }}</td>
                            <td class="font-monospace" :class="getLastValue(iface.errors) > 0 ? 'text-danger fw-bold' : 'text-muted'">
                                {{ getLastValue(iface.errors) }}
                            </td>
                            <td class="font-monospace text-light">{{ getLastValue(iface.packets) }}</td>
                        </tr>
                        <tr v-if="!snmpMetrics || !snmpMetrics.interfaces || Object.keys(snmpMetrics.interfaces).length === 0">
                            <td colspan="6" class="text-center py-4 text-muted small">
                                No SNMP interface data ingested yet. Configure SNMP credentials to enable high-frequency telemetry.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Row 3: Notes & Hardware Description -->
        <div class="noc-section-box p-3">
            <h2 class="h6 fw-bold mb-2 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                <font-awesome-icon icon="sticky-note" />
                <span>Notes & Hardware Specifications</span>
            </h2>
            <div class="p-3 bg-dark rounded border border-secondary text-light">
                <p v-if="device.notes || device.description" class="mb-0 whitespace-pre-wrap">
                    {{ device.notes || device.description }}
                </p>
                <p v-else class="mb-0 text-muted italic">
                    No custom hardware notes recorded for this device.
                </p>
            </div>
        </div>

        <!-- Modal 1: Edit Device -->
        <div v-if="showEditModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Edit Device Specifications</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3">
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Device Name</label>
                                <input v-model="editForm.name" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Device Type</label>
                                <select v-model="editForm.device_type" class="form-select noc-input">
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
                                <label class="form-label fw-semibold text-light small text-uppercase">IPv4 Address</label>
                                <input v-model="editForm.ip_address" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Hostname</label>
                                <input v-model="editForm.hostname" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Vendor</label>
                                <input v-model="editForm.vendor" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Model</label>
                                <input v-model="editForm.model" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Serial Number</label>
                                <input v-model="editForm.serial_number" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-12">
                                <label class="form-label fw-semibold text-light small text-uppercase">Notes & Hardware Specs</label>
                                <textarea v-model="editForm.notes" class="form-control noc-input" rows="3"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showEditModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" @click="saveEditDevice">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 2: Add Encrypted Credential -->
        <div v-if="showAddCredentialModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="lock" />
                            <span>Add Encrypted Credential</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAddCredentialModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Credential Label</label>
                            <input v-model="newCredential.name" type="text" class="form-control noc-input" placeholder="e.g. Primary SNMP v2 Community" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Credential Type</label>
                            <select v-model="newCredential.type" class="form-select noc-input">
                                <option value="snmp_v2c">SNMP v2c Community</option>
                                <option value="snmp_v3">SNMP v3 Auth</option>
                                <option value="api_token">REST / API Token</option>
                                <option value="ssh">SSH Login</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">Secret Payload (Community / Token / Key)</label>
                            <input v-model="newCredential.secret" type="password" class="form-control noc-input" placeholder="••••••••••••" />
                            <div class="form-text text-muted small mt-1">Secret is encrypted via AES-256-GCM before storage.</div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAddCredentialModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" :disabled="!newCredential.name || !newCredential.secret" @click="addCredential">
                            Encrypt & Store
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 3: Assign Monitors -->
        <div v-if="showAssignMonitorsModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Assign Monitors to {{ device.name }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAssignMonitorsModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3" style="max-height: 350px; overflow-y: auto;">
                        <div v-for="m in availableMonitors" :key="m.id" class="form-check py-1">
                            <input
                                :id="`dm-${m.id}`"
                                v-model="selectedMonitorIds"
                                :value="m.id"
                                type="checkbox"
                                class="form-check-input"
                            />
                            <label :for="`dm-${m.id}`" class="form-check-label text-light fw-medium">
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

        <!-- Modal 4: Configure SNMP Settings -->
        <div v-if="showSnmpConfigModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="network-wired" />
                            <span>Configure Device SNMP Polling</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showSnmpConfigModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">SNMP Version</label>
                            <select v-model="snmpConfigForm.snmp_version" class="form-select noc-input">
                                <option value="v2c">SNMP v2c</option>
                                <option value="v3">SNMP v3 (USM Security)</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-light small text-uppercase">AES Encrypted Credential Vault Reference</label>
                            <select v-model="snmpConfigForm.credential_id" class="form-select noc-input">
                                <option :value="null">None / Default Public</option>
                                <option v-for="c in (device ? device.credentials : [])" :key="c.id" :value="c.id">
                                    {{ c.name }} ({{ c.type }})
                                </option>
                            </select>
                        </div>
                        <div class="row g-2">
                            <div class="col-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">SNMP Port</label>
                                <input v-model.number="snmpConfigForm.port" type="number" class="form-control noc-input" />
                            </div>
                            <div class="col-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Timeout (ms)</label>
                                <input v-model.number="snmpConfigForm.timeout" type="number" class="form-control noc-input" />
                            </div>
                            <div class="col-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Poll Interval (s)</label>
                                <input v-model.number="snmpConfigForm.poll_interval" type="number" class="form-control noc-input" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showSnmpConfigModal = false">Cancel</button>
                        <button type="button" class="btn noc-btn px-4 fw-bold" @click="saveSnmpConfig">Save SNMP Config</button>
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
            device: null,
            showEditModal: false,
            showAddCredentialModal: false,
            showAssignMonitorsModal: false,
            showSnmpConfigModal: false,
            editForm: {},
            selectedMonitorIds: [],
            newCredential: {
                name: "",
                type: "snmp_v2c",
                secret: "",
            },
            snmpConfigForm: {
                snmp_version: "v2c",
                credential_id: null,
                port: 161,
                timeout: 5000,
                retries: 2,
                poll_interval: 30,
            },
            snmpMetrics: null,
        };
    },
    computed: {
        deviceId() {
            return Number(this.$route.params.id);
        },
        availableMonitors() {
            return Object.values(this.$root.monitorList);
        },
    },
    mounted() {
        this.loadDevice();
        this.loadSnmpConfig();
        this.loadDeviceMetrics();
    },
    methods: {
        loadDevice() {
            this.$root.getSocket().emit("getDevice", this.deviceId, (res) => {
                if (res && res.ok) {
                    this.device = res.device;
                    this.editForm = { ...res.device };
                    this.selectedMonitorIds = res.device.monitors ? res.device.monitors.map((m) => m.id) : [];
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to load device details");
                }
            });
        },
        saveEditDevice() {
            this.$root.getSocket().emit("editDevice", { id: this.deviceId, ...this.editForm }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Device updated successfully");
                    this.showEditModal = false;
                    this.loadDevice();
                } else {
                    this.$root.toastError(res ? res.msg : "Error updating device");
                }
            });
        },
        confirmDeleteDevice() {
            if (confirm(`Are you sure you want to delete device "${this.device.name}"?`)) {
                this.$root.getSocket().emit("deleteDevice", this.deviceId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Device removed from inventory");
                        this.$router.push("/devices");
                    } else {
                        this.$root.toastError(res ? res.msg : "Error deleting device");
                    }
                });
            }
        },
        addCredential() {
            if (!this.newCredential.name || !this.newCredential.secret) {
                return;
            }
            const payload = {
                deviceId: this.deviceId,
                credential: {
                    name: this.newCredential.name,
                    type: this.newCredential.type,
                    secretPayload: { secret: this.newCredential.secret },
                },
            };
            this.$root.getSocket().emit("addDeviceCredential", payload, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Encrypted credential stored");
                    this.showAddCredentialModal = false;
                    this.newCredential = { name: "", type: "snmp_v2c", secret: "" };
                    this.loadDevice();
                } else {
                    this.$root.toastError(res ? res.msg : "Error storing credential");
                }
            });
        },
        deleteCredential(credentialId) {
            this.$root.getSocket().emit("deleteDeviceCredential", { deviceId: this.deviceId, credentialId }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Credential deleted");
                    this.loadDevice();
                } else {
                    this.$root.toastError(res ? res.msg : "Error deleting credential");
                }
            });
        },
        openAssignMonitorsModal() {
            this.selectedMonitorIds = this.device.monitors ? this.device.monitors.map((m) => m.id) : [];
            this.showAssignMonitorsModal = true;
        },
        saveAssignedMonitors() {
            this.$root.getSocket().emit("assignMonitorsToDevice", { deviceId: this.deviceId, monitorIds: this.selectedMonitorIds }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Monitors assigned to device");
                    this.showAssignMonitorsModal = false;
                    this.loadDevice();
                } else {
                    this.$root.toastError(res ? res.msg : "Error assigning monitors");
                }
            });
        },
        loadSnmpConfig() {
            this.$root.getSocket().emit("getSnmpConfig", this.deviceId, (res) => {
                if (res && res.ok && res.config) {
                    this.snmpConfigForm = { ...res.config };
                }
            });
        },
        saveSnmpConfig() {
            const payload = { deviceId: this.deviceId, config: this.snmpConfigForm };
            this.$root.getSocket().emit("saveSnmpConfig", payload, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("SNMP configuration saved");
                    this.showSnmpConfigModal = false;
                    this.loadSnmpConfig();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving SNMP config");
                }
            });
        },
        loadDeviceMetrics() {
            this.$root.getSocket().emit("getDeviceMetrics", this.deviceId, (res) => {
                if (res && res.ok && res.metrics) {
                    this.snmpMetrics = res.metrics;
                }
            });
        },
        formatBps(value) {
            if (value === null || value === undefined || isNaN(value)) {
                return "0 bps";
            }
            if (value >= 1000000000) {
                return (value / 1000000000).toFixed(2) + " Gbps";
            }
            if (value >= 1000000) {
                return (value / 1000000).toFixed(2) + " Mbps";
            }
            if (value >= 1000) {
                return (value / 1000).toFixed(2) + " Kbps";
            }
            return value + " bps";
        },
        formatUptime(sec) {
            if (!sec) {
                return "--";
            }
            const days = Math.floor(sec / 86400);
            const hrs = Math.floor((sec % 86400) / 3600);
            const mins = Math.floor((sec % 3600) / 60);
            return `${days}d ${hrs}h ${mins}m`;
        },
        getLastValue(arr) {
            if (Array.isArray(arr) && arr.length > 0) {
                return arr[arr.length - 1].value;
            }
            return Number(arr) || 0;
        },
    },
};
</script>

<style scoped>
.noc-device-details {
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
