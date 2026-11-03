<template>
    <div class="noc-probes-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="satellite-dish" class="text-cyan" style="color: #06B6D4;" />
                    <span>Remote Distributed Probes</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Enterprise multi-region agent mesh & private LAN monitors for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 d-flex align-items-center gap-2 shadow-sm" @click="openCreateModal">
                <font-awesome-icon icon="plus-circle" />
                <span>Register New Probe</span>
            </button>
        </div>

        <!-- 5 Summary Telemetry Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-md">
                <div class="noc-card p-3 shadow-sm border-left-amber h-100">
                    <div class="noc-card-title mb-1">Total Probes</div>
                    <div class="noc-card-value text-foreground">{{ probes.length }}</div>
                </div>
            </div>
            <div class="col-6 col-md">
                <div class="noc-card p-3 shadow-sm border-left-success h-100">
                    <div class="noc-card-title mb-1">Online</div>
                    <div class="noc-card-value text-success">{{ onlineCount }}</div>
                </div>
            </div>
            <div class="col-6 col-md">
                <div class="noc-card p-3 shadow-sm border-left-warning h-100">
                    <div class="noc-card-title mb-1">Degraded</div>
                    <div class="noc-card-value text-warning">{{ degradedCount }}</div>
                </div>
            </div>
            <div class="col-6 col-md">
                <div class="noc-card p-3 shadow-sm border-left-danger h-100">
                    <div class="noc-card-title mb-1">Offline</div>
                    <div class="noc-card-value text-danger">{{ offlineCount }}</div>
                </div>
            </div>
            <div class="col-6 col-md">
                <div class="noc-card p-3 shadow-sm border-left-secondary h-100">
                    <div class="noc-card-title mb-1">Pending / Revoked</div>
                    <div class="noc-card-value text-secondary">{{ pendingCount + revokedCount }}</div>
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
                            <th>Probe Identity</th>
                            <th>Region / Site</th>
                            <th>IP Address</th>
                            <th>CPU Usage</th>
                            <th>Memory</th>
                            <th>Latency</th>
                            <th>Version</th>
                            <th>Assigned Targets</th>
                            <th>Last Heartbeat</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in probes" :key="p.id">
                            <td>
                                <span class="badge" :class="getStatusBadgeClass(p)">
                                    {{ getProbeStatusLabel(p) }}
                                </span>
                            </td>
                            <td>
                                <div class="fw-bold text-foreground">{{ p.name }}</div>
                                <div class="small text-muted text-truncate" style="max-width: 180px;">
                                    {{ p.description || 'Remote Network Probe' }}
                                </div>
                            </td>
                            <td>
                                <div class="d-flex flex-column" style="line-height: 1.2;">
                                    <span v-if="p.region" class="badge bg-secondary font-monospace mb-1" style="font-size: 0.65rem;">
                                        {{ p.region }}
                                    </span>
                                    <span v-if="p.site_name" class="text-info small">
                                        <font-awesome-icon icon="map-marker-alt" class="me-1" />{{ p.site_name }}
                                    </span>
                                    <span v-else class="text-muted small">Global / Cloud</span>
                                </div>
                            </td>
                            <td class="font-monospace small text-light">
                                {{ p.ip_address || 'Connecting...' }}
                            </td>
                            <td style="min-width: 90px;">
                                <div v-if="p.cpu_usage !== null && p.cpu_usage !== undefined" class="d-flex align-items-center gap-1">
                                    <div class="progress flex-grow-1" style="height: 6px; background: rgba(255,255,255,0.1);">
                                        <div class="progress-bar" :class="p.cpu_usage > 85 ? 'bg-danger' : (p.cpu_usage > 60 ? 'bg-warning' : 'bg-success')" :style="{ width: Math.min(100, p.cpu_usage) + '%' }"></div>
                                    </div>
                                    <span class="small font-monospace">{{ Math.round(p.cpu_usage) }}%</span>
                                </div>
                                <span v-else class="text-muted small">--</span>
                            </td>
                            <td style="min-width: 90px;">
                                <div v-if="p.memory_usage !== null && p.memory_usage !== undefined" class="d-flex align-items-center gap-1">
                                    <div class="progress flex-grow-1" style="height: 6px; background: rgba(255,255,255,0.1);">
                                        <div class="progress-bar" :class="p.memory_usage > 85 ? 'bg-danger' : (p.memory_usage > 70 ? 'bg-warning' : 'bg-info')" :style="{ width: Math.min(100, p.memory_usage) + '%' }"></div>
                                    </div>
                                    <span class="small font-monospace">{{ Math.round(p.memory_usage) }}%</span>
                                </div>
                                <span v-else class="text-muted small">--</span>
                            </td>
                            <td>
                                <span v-if="p.latency_ms !== null && p.latency_ms !== undefined" class="fw-bold font-monospace" :class="p.latency_ms > 100 ? 'text-warning' : 'text-info'">
                                    {{ p.latency_ms }} ms
                                </span>
                                <span v-else class="text-muted small">--</span>
                            </td>
                            <td>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">v{{ p.version || '1.0.0' }}</span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-secondary font-monospace py-0 px-2" style="font-size: 0.75rem;" @click="openAssignTargetsModal(p)">
                                    {{ p.assigned_monitors || 0 }} Targets
                                </button>
                            </td>
                            <td class="small text-muted text-nowrap">
                                <span v-if="p.last_heartbeat">
                                    <font-awesome-icon icon="clock" class="me-1" />
                                    {{ formatDate(p.last_heartbeat) }}
                                </span>
                                <span v-else>Never</span>
                            </td>
                            <td class="text-end text-nowrap">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-info" title="Inspect Probe Telemetry" @click="openProbeInspector(p)">
                                        <font-awesome-icon icon="chart-bar" />
                                    </button>
                                    <button class="btn btn-outline-success" title="Assign Monitoring Targets" @click="openAssignTargetsModal(p)">
                                        <font-awesome-icon icon="tasks" />
                                    </button>
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
                            <td colspan="11" class="text-center py-5 text-muted">
                                <font-awesome-icon icon="satellite-dish" class="display-3 mb-3 text-secondary" />
                                <h5>No distributed probes registered.</h5>
                                <p class="small text-secondary">Click "Register New Probe" to generate deployment tokens for your ISP/customer networks.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal 1: Register New Probe -->
        <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); z-index: 1055;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content border border-secondary shadow-lg">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="satellite-dish" />
                            <span>Register New Remote Distributed Probe</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div v-if="!generatedTokenInfo">
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-6">
                                    <label class="form-label fw-semibold text-light small text-uppercase">Probe Name</label>
                                    <input v-model="newProbe.name" type="text" class="form-control noc-input" placeholder="e.g. Hyderabad DC Probe 01" />
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="form-label fw-semibold text-light small text-uppercase">Geographic Region</label>
                                    <input v-model="newProbe.region" type="text" class="form-control noc-input" placeholder="e.g. ap-south-1 / Andhra Pradesh" />
                                </div>
                            </div>
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-6">
                                    <label class="form-label fw-semibold text-light small text-uppercase">Physical Site Location</label>
                                    <select v-model="newProbe.site_id" class="form-select noc-input">
                                        <option :value="null">Global / Customer Premises</option>
                                        <option v-for="site in sites" :key="site.id" :value="site.id">
                                            {{ site.name }} ({{ site.code }})
                                        </option>
                                    </select>
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="form-label fw-semibold text-light small text-uppercase">Subnet / Facility Location</label>
                                    <input v-model="newProbe.location" type="text" class="form-control noc-input" placeholder="e.g. Building B - Rack 04" />
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Description</label>
                                <textarea v-model="newProbe.description" class="form-control noc-input" rows="2" placeholder="Network deployment environment details..."></textarea>
                            </div>
                        </div>

                        <!-- One-Time Token & Multi-Platform Commands -->
                        <div v-else class="p-3 bg-dark border border-warning rounded">
                            <div class="alert alert-warning py-2 mb-3 small d-flex align-items-center gap-2">
                                <font-awesome-icon icon="exclamation-triangle" class="fs-5" />
                                <span>Save this one-time registration token! It will be invalidated immediately after initial probe agent connection.</span>
                            </div>

                            <div class="mb-3">
                                <label class="form-label text-warning small fw-bold text-uppercase">One-Time Registration Token</label>
                                <div class="input-group">
                                    <input type="text" readonly class="form-control noc-input font-monospace text-warning" :value="generatedTokenInfo.registrationToken" />
                                    <button class="btn btn-warning fw-bold" @click="copyText(generatedTokenInfo.registrationToken)">Copy</button>
                                </div>
                            </div>

                            <!-- Install Tabs -->
                            <ul class="nav nav-pills mb-2 gap-1" role="tablist">
                                <li class="nav-item">
                                    <button class="btn btn-sm btn-outline-info active" data-bs-toggle="pill" data-bs-target="#tab-linux" type="button">
                                        Ubuntu / Linux
                                    </button>
                                </li>
                                <li class="nav-item">
                                    <button class="btn btn-sm btn-outline-info" data-bs-toggle="pill" data-bs-target="#tab-windows" type="button">
                                        Windows (PowerShell)
                                    </button>
                                </li>
                                <li class="nav-item">
                                    <button class="btn btn-sm btn-outline-info" data-bs-toggle="pill" data-bs-target="#tab-docker" type="button">
                                        Docker
                                    </button>
                                </li>
                            </ul>

                            <div class="tab-content border border-secondary rounded p-3 bg-black">
                                <div id="tab-linux" class="tab-pane fade show active">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <label class="text-secondary small fw-bold font-monospace mb-0">Ubuntu / Debian / RHEL Automated Service Installer:</label>
                                        <a :href="`/api/probe/download/install.sh?probeId=${generatedTokenInfo.probe.id}&token=${generatedTokenInfo.registrationToken}`" download="install.sh" class="btn btn-xs btn-outline-info py-0">
                                            <font-awesome-icon icon="download" class="me-1" />Download install.sh
                                        </a>
                                    </div>
                                    <pre class="p-2 text-success rounded font-monospace small mb-2 overflow-x-auto">{{ getLinuxAgentCommand(generatedTokenInfo) }}</pre>
                                    <button class="btn btn-xs btn-outline-warning fw-bold" @click="copyText(getLinuxAgentCommand(generatedTokenInfo))">Copy Linux Command</button>
                                </div>
                                <div id="tab-windows" class="tab-pane fade">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <label class="text-secondary small fw-bold font-monospace mb-0">Windows Automated PowerShell Installer (Admin):</label>
                                        <a :href="`/api/probe/download/install.ps1?probeId=${generatedTokenInfo.probe.id}&token=${generatedTokenInfo.registrationToken}`" download="install.ps1" class="btn btn-xs btn-outline-info py-0">
                                            <font-awesome-icon icon="download" class="me-1" />Download install.ps1
                                        </a>
                                    </div>
                                    <pre class="p-2 text-success rounded font-monospace small mb-2 overflow-x-auto">{{ getWindowsAgentCommand(generatedTokenInfo) }}</pre>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="text-muted small">Auto-detects Node.js LTS, configures Scheduled Task background service, persists on reboot.</span>
                                        <button class="btn btn-xs btn-outline-warning fw-bold" @click="copyText(getWindowsAgentCommand(generatedTokenInfo))">Copy PowerShell Command</button>
                                    </div>
                                </div>
                                <div id="tab-docker" class="tab-pane fade">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <label class="text-secondary small fw-bold font-monospace mb-0">Docker Run / Container Mesh Command:</label>
                                        <a href="/api/probe/download/docker-compose.yml" download="docker-compose.yml" class="btn btn-xs btn-outline-info py-0">
                                            <font-awesome-icon icon="download" class="me-1" />Download docker-compose.yml
                                        </a>
                                    </div>
                                    <pre class="p-2 text-success rounded font-monospace small mb-2 overflow-x-auto">{{ getDockerCommandSnippet(generatedTokenInfo) }}</pre>
                                    <button class="btn btn-xs btn-outline-warning fw-bold" @click="copyText(getDockerCommandSnippet(generatedTokenInfo))">Copy Docker Command</button>
                                </div>
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

        <!-- Modal 2: Probe Inspector / Telemetry Modal -->
        <div v-if="inspectProbe" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); z-index: 1055;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content border border-secondary shadow-lg">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge" :class="getStatusBadgeClass(inspectProbe)">{{ getProbeStatusLabel(inspectProbe) }}</span>
                            <h5 class="modal-title fw-bold text-foreground mb-0">{{ inspectProbe.name }} (#{{ inspectProbe.id }})</h5>
                        </div>
                        <button type="button" class="btn-close btn-close-white" @click="inspectProbe = null"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <!-- Resource Telemetry Strip -->
                        <div class="row g-3 mb-4">
                            <div class="col-6 col-md-3">
                                <div class="noc-card p-3 shadow-sm">
                                    <div class="text-secondary small text-uppercase fw-bold">CPU Usage</div>
                                    <div class="fs-4 fw-bold font-monospace text-info">{{ inspectProbe.cpu_usage ? inspectProbe.cpu_usage + '%' : '0%' }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="noc-card p-3 shadow-sm">
                                    <div class="text-secondary small text-uppercase fw-bold">RAM Usage</div>
                                    <div class="fs-4 fw-bold font-monospace text-warning">{{ inspectProbe.memory_usage ? inspectProbe.memory_usage + '%' : '0%' }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="noc-card p-3 shadow-sm">
                                    <div class="text-secondary small text-uppercase fw-bold">Link Latency</div>
                                    <div class="fs-4 fw-bold font-monospace text-success">{{ inspectProbe.latency_ms ? inspectProbe.latency_ms + ' ms' : '< 1 ms' }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="noc-card p-3 shadow-sm">
                                    <div class="text-secondary small text-uppercase fw-bold">Tasks Executed</div>
                                    <div class="fs-4 fw-bold font-monospace text-foreground">{{ inspectProbe.tasks_executed || 0 }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- System Details -->
                        <div class="p-3 bg-dark rounded border border-secondary mb-3 small font-monospace">
                            <div class="row g-2">
                                <div class="col-6"><span class="text-muted">IP Address:</span> <span class="text-light">{{ inspectProbe.ip_address || '127.0.0.1' }}</span></div>
                                <div class="col-6"><span class="text-muted">Agent Version:</span> <span class="text-light">v{{ inspectProbe.version || '1.0.0' }}</span></div>
                                <div class="col-6"><span class="text-muted">Region:</span> <span class="text-light">{{ inspectProbe.region || 'Default' }}</span></div>
                                <div class="col-6"><span class="text-muted">OS Host:</span> <span class="text-light">{{ inspectProbe.os_info || 'Linux / POSIX' }}</span></div>
                                <div class="col-12"><span class="text-muted">Last Heartbeat:</span> <span class="text-light">{{ inspectProbe.last_heartbeat ? new Date(inspectProbe.last_heartbeat).toISOString() : 'Never' }}</span></div>
                            </div>
                        </div>

                        <!-- Assigned Monitors List -->
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="fw-bold mb-0 text-foreground">Assigned Monitoring Targets ({{ (inspectProbe.assignedMonitors || []).length }})</h6>
                                <button class="btn btn-sm btn-outline-success" @click="openAssignTargetsModal(inspectProbe)">+ Assign Targets</button>
                            </div>
                            <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                                <table class="table table-sm table-hover align-middle mb-0">
                                    <thead>
                                        <tr class="text-secondary small">
                                            <th>ID</th>
                                            <th>Target Name</th>
                                            <th>Protocol</th>
                                            <th>Target Address</th>
                                            <th>Active</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="m in inspectProbe.assignedMonitors" :key="m.id">
                                            <td class="font-monospace text-muted">#{{ m.id }}</td>
                                            <td class="fw-bold text-foreground">{{ m.name }}</td>
                                            <td><span class="badge bg-secondary font-monospace">{{ (m.type || 'PING').toUpperCase() }}</span></td>
                                            <td class="font-monospace small text-muted">{{ m.hostname || m.url }}</td>
                                            <td><span class="badge" :class="m.active ? 'bg-success' : 'bg-secondary'">{{ m.active ? 'YES' : 'PAUSED' }}</span></td>
                                        </tr>
                                        <tr v-if="!inspectProbe.assignedMonitors || inspectProbe.assignedMonitors.length === 0">
                                            <td colspan="5" class="text-center py-3 text-muted small">No monitors currently assigned to this probe.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-2">
                        <button type="button" class="btn btn-sm btn-secondary" @click="inspectProbe = null">Close</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 3: Assign Targets to Probe -->
        <div v-if="assignProbe" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); z-index: 1055;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content border border-secondary shadow-lg">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-foreground mb-0">
                            Assign Targets to {{ assignProbe.name }} (#{{ assignProbe.id }})
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="assignProbe = null"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <p class="text-secondary small mb-3">
                            Select the monitoring targets that should be executed locally by this distributed probe agent:
                        </p>
                        <div class="target-select-list d-flex flex-column gap-2" style="max-height: 350px; overflow-y: auto;">
                            <div
                                v-for="m in allMonitors"
                                :key="m.id"
                                class="p-2 bg-dark rounded border border-secondary d-flex align-items-center justify-content-between"
                            >
                                <div class="d-flex align-items-center gap-2">
                                    <input
                                        type="checkbox"
                                        class="form-check-input mt-0"
                                        :checked="isMonitorAssigned(m.id)"
                                        @change="toggleMonitorAssignment(m.id, $event.target.checked)"
                                    />
                                    <div>
                                        <span class="fw-bold text-light small">{{ m.name }}</span>
                                        <span class="badge bg-secondary ms-2 font-monospace" style="font-size: 0.65rem;">{{ (m.type || 'PING').toUpperCase() }}</span>
                                        <div class="text-muted font-monospace small" style="font-size: 0.72rem;">{{ m.hostname || m.url }}</div>
                                    </div>
                                </div>
                                <span v-if="m.probe_id === assignProbe.id" class="badge bg-success-subtle text-success font-monospace" style="font-size: 0.65rem;">ASSIGNED</span>
                                <span v-else-if="m.probe_id" class="badge bg-warning-subtle text-warning font-monospace" style="font-size: 0.65rem;">Other Probe (#{{ m.probe_id }})</span>
                                <span v-else class="badge bg-secondary-subtle text-muted font-monospace" style="font-size: 0.65rem;">Central Engine</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-2">
                        <button type="button" class="btn btn-sm btn-secondary" @click="assignProbe = null">Done</button>
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
            inspectProbe: null,
            assignProbe: null,
            submitting: false,
            newProbe: {
                name: "",
                site_id: null,
                region: "",
                location: "",
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
        allMonitors() {
            return Object.values(this.$root.monitorList || {});
        },
        onlineCount() {
            return this.probes.filter((p) => p.status === "online" && (p.latency_ms === null || p.latency_ms <= 100)).length;
        },
        degradedCount() {
            return this.probes.filter((p) => p.status === "online" && p.latency_ms > 100).length;
        },
        offlineCount() {
            return this.probes.filter((p) => p.status === "offline").length;
        },
        pendingCount() {
            return this.probes.filter((p) => p.status === "pending").length;
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
        if (this.$root.getSocket()) {
            this.$root.getSocket().on("updateProbeList", this.loadData);
        }
    },
    beforeUnmount() {
        if (this.$root.getSocket()) {
            this.$root.getSocket().off("updateProbeList", this.loadData);
        }
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
            this.newProbe = { name: "", site_id: null, region: "", location: "", description: "" };
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
        openProbeInspector(p) {
            this.$root.getSocket().emit("getProbeDetails", p.id, (res) => {
                if (res && res.ok && res.probe) {
                    this.inspectProbe = res.probe;
                } else {
                    this.inspectProbe = p;
                }
            });
        },
        openAssignTargetsModal(p) {
            this.assignProbe = p;
        },
        isMonitorAssigned(monitorId) {
            if (!this.assignProbe) return false;
            const mon = this.$root.monitorList[monitorId];
            return mon && mon.probe_id === this.assignProbe.id;
        },
        toggleMonitorAssignment(monitorId, assign) {
            if (!this.assignProbe) return;
            const probeId = assign ? this.assignProbe.id : null;
            this.$root.getSocket().emit("assignMonitorProbe", { monitorId, probeId }, (res) => {
                if (res && res.ok) {
                    if (this.$root.monitorList[monitorId]) {
                        this.$root.monitorList[monitorId].probe_id = probeId;
                    }
                    this.$root.toastSuccess(assign ? "Target assigned to probe" : "Target unassigned");
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Assignment failed");
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
        getLinuxAgentCommand(info) {
            const host = window.location.origin;
            return `curl -fsSL "${host}/api/probe/download/install.sh?probeId=${info.probe.id}&token=${info.registrationToken}" | sudo bash`;
        },
        getWindowsAgentCommand(info) {
            const host = window.location.origin;
            return `irm "${host}/api/probe/download/install.ps1?probeId=${info.probe.id}&token=${info.registrationToken}" | iex`;
        },
        getDockerCommandSnippet(info) {
            const host = window.location.origin;
            return `docker run -d \\
  --name infininoc-probe-${info.probe.id} \\
  --restart always \\
  --network host \\
  -e SERVER="${host}" \\
  -e PROBE_ID="${info.probe.id}" \\
  -e TOKEN="${info.registrationToken}" \\
  -v probe-data:/data \\
  node:20-alpine sh -c "wget -qO /app.js ${host}/api/probe/download/agent.js && node /app.js --server=${host} --probe-id=${info.probe.id} --token=${info.registrationToken} --config=/data/config.json"`;
        },
        copyText(text) {
            navigator.clipboard.writeText(text);
            this.$root.toastSuccess("Copied to clipboard");
        },
        getStatusBadgeClass(p) {
            if (p.status === "online") {
                return (p.latency_ms && p.latency_ms > 100) ? "bg-warning text-dark font-monospace" : "bg-success font-monospace";
            }
            if (p.status === "offline") {
                return "bg-danger font-monospace";
            }
            if (p.status === "revoked") {
                return "bg-secondary font-monospace";
            }
            return "bg-warning text-dark font-monospace";
        },
        getProbeStatusLabel(p) {
            if (p.status === "online") {
                return (p.latency_ms && p.latency_ms > 100) ? "DEGRADED" : "ONLINE";
            }
            return (p.status || "PENDING").toUpperCase();
        },
        formatDate(dateStr) {
            if (!dateStr) {
                return "--";
            }
            return new Date(dateStr).toLocaleTimeString();
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
    color: #FFFFFF;
    height: 38px;
    border-radius: 8px;
    transition: all 0.2s ease-in-out;
}

.noc-create-btn:hover:not(:disabled) {
    background-color: #059669;
    border-color: #059669;
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.35);
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
    border-radius: 12px;
}

.border-left-amber { border-left: 4px solid #F59E0B !important; }
.border-left-success { border-left: 4px solid #10B981 !important; }
.border-left-danger { border-left: 4px solid #EF4444 !important; }
.border-left-warning { border-left: 4px solid #F59E0B !important; }
.border-left-secondary { border-left: 4px solid #64748B !important; }

.noc-card-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
}

.noc-card-value {
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.2;
}

.noc-section-box {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
