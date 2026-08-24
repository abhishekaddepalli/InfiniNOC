<template>
    <div class="noc-incident-details-page p-3 p-md-4">
        <!-- Top Navigation & Header -->
        <div class="d-flex align-items-center gap-3 mb-4 border-bottom border-secondary pb-3 flex-wrap">
            <router-link to="/incidents" class="btn btn-outline-secondary btn-sm">
                <font-awesome-icon icon="arrow-left" class="me-1" /> Back to Incidents
            </router-link>
            <div class="d-flex align-items-center gap-2 flex-grow-1">
                <span class="badge font-monospace fs-6" :class="getSeverityBadgeClass(incident ? incident.severity : '')">
                    {{ incident ? incident.severity : '' }}
                </span>
                <span class="badge fs-6" :class="getStatusBadgeClass(incident ? incident.status : '')">
                    {{ incident ? incident.status : '' }}
                </span>
                <h1 class="h4 fw-bold mb-0 text-light me-auto">
                    #INC-{{ incident ? incident.id : '' }}: {{ incident ? incident.title : 'Loading...' }}
                </h1>
            </div>

            <!-- Action Controls -->
            <div v-if="incident" class="d-flex align-items-center gap-2 flex-wrap">
                <button v-if="incident.status === 'OPEN'" class="btn btn-warning text-dark fw-bold btn-sm" @click="updateStatus('ACKNOWLEDGED')">
                    <font-awesome-icon icon="check-double" class="me-1" /> Acknowledge
                </button>
                <button v-if="['OPEN', 'ACKNOWLEDGED'].includes(incident.status)" class="btn btn-primary btn-sm fw-bold" @click="updateStatus('IN_PROGRESS')">
                    <font-awesome-icon icon="tools" class="me-1" /> In Progress
                </button>
                <button v-if="['IN_PROGRESS', 'MONITORING'].includes(incident.status)" class="btn btn-success btn-sm fw-bold" @click="showResolveModal = true">
                    <font-awesome-icon icon="check-circle" class="me-1" /> Resolve
                </button>
                <button v-if="incident.status === 'RESOLVED'" class="btn btn-secondary btn-sm fw-bold" @click="updateStatus('CLOSED')">
                    <font-awesome-icon icon="archive" class="me-1" /> Close Incident
                </button>
                <button v-if="['RESOLVED', 'CLOSED'].includes(incident.status)" class="btn btn-outline-danger btn-sm fw-bold" @click="reopenIncident">
                    <font-awesome-icon icon="redo" class="me-1" /> Reopen
                </button>
            </div>
        </div>

        <div v-if="incident" class="row g-4">
            <!-- Left 8 Columns: Details, Timeline, Investigation Notes -->
            <div class="col-12 col-lg-8">
                <!-- Overview Info Card -->
                <div class="noc-section-box p-4 mb-4 shadow-sm">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="info-circle" />
                        <span>Incident Overview</span>
                    </h5>
                    <!-- Impact Analysis Summary Box -->
                    <div class="p-3 rounded bg-dark border border-secondary mb-3">
                        <div class="row g-2 text-center align-items-center">
                            <div class="col-6 col-sm-3 border-end border-secondary">
                                <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.65rem;">Root Device</span>
                                <span class="text-warning font-monospace fw-bold">{{ incident.root_device_id ? ('Device #' + incident.root_device_id) : 'Primary Event' }}</span>
                            </div>
                            <div class="col-6 col-sm-2 border-end border-secondary">
                                <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.65rem;">Affected Devices</span>
                                <span class="text-danger font-monospace fs-5 fw-bold">{{ incident.affected_devices_count || 1 }}</span>
                            </div>
                            <div class="col-4 col-sm-2 border-end border-secondary">
                                <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.65rem;">Affected Sites</span>
                                <span class="text-info font-monospace fs-5 fw-bold">{{ incident.affected_sites_count || 1 }}</span>
                            </div>
                            <div class="col-4 col-sm-2 border-end border-secondary">
                                <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.65rem;">Affected Monitors</span>
                                <span class="text-light font-monospace fs-5 fw-bold">{{ incident.affected_monitors_count || 0 }}</span>
                            </div>
                            <div class="col-4 col-sm-3">
                                <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.65rem;">Estimated Impact</span>
                                <span class="badge" :class="incident.estimated_impact === 'Critical' ? 'bg-danger' : 'bg-warning text-dark'">
                                    {{ incident.estimated_impact || 'Medium' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="row g-3 pt-3 border-top border-secondary small">
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.7rem;">Site Location</span>
                            <span class="text-info font-monospace">{{ incident.site_name || 'Global' }}</span>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.7rem;">Created At</span>
                            <span class="text-light font-monospace">{{ formatDate(incident.created_at) }}</span>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.7rem;">Acknowledged At</span>
                            <span class="text-warning font-monospace">{{ formatDate(incident.acknowledged_at) }}</span>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block text-uppercase fw-bold" style="font-size: 0.7rem;">Resolved At</span>
                            <span class="text-success font-monospace">{{ formatDate(incident.resolved_at) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Root Cause & Resolution Notes (if present) -->
                <div v-if="incident.root_cause || incident.resolution" class="noc-section-box p-4 mb-4 shadow-sm border-left-success">
                    <h5 class="fw-bold text-success mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="clipboard-check" />
                        <span>Root Cause & Resolution Summary</span>
                    </h5>
                    <div v-if="incident.root_cause" class="mb-3">
                        <span class="text-muted small text-uppercase font-monospace d-block fw-bold mb-1">Root Cause</span>
                        <div class="text-light p-2 rounded bg-dark border border-secondary font-monospace small">{{ incident.root_cause }}</div>
                    </div>
                    <div v-if="incident.resolution">
                        <span class="text-muted small text-uppercase font-monospace d-block fw-bold mb-1">Resolution Actions</span>
                        <div class="text-light p-2 rounded bg-dark border border-secondary font-monospace small">{{ incident.resolution }}</div>
                    </div>
                </div>

                <!-- Interactive Investigation Timeline -->
                <div class="noc-section-box p-4 shadow-sm">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="stream" />
                        <span>Incident Audit & Investigation Timeline</span>
                    </h5>

                    <!-- Timeline Item List -->
                    <div class="noc-timeline position-relative ps-4 mb-4" style="border-left: 2px solid #334155;">
                        <div v-for="item in incident.timeline" :key="item.id" class="noc-timeline-item position-relative mb-3 pb-2">
                            <div class="noc-timeline-badge position-absolute rounded-circle bg-warning" style="left: -1.45rem; top: 0.2rem; width: 12px; height: 12px;"></div>
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="badge font-monospace text-uppercase" :class="getEventBadgeClass(item.event_type)">
                                    {{ item.event_type }}
                                </span>
                                <span class="text-muted small font-monospace">{{ formatDate(item.created_at) }}</span>
                            </div>
                            <p class="text-light small mb-0 font-monospace">{{ item.message }}</p>
                        </div>
                    </div>

                    <!-- Add Note Input -->
                    <div class="pt-3 border-top border-secondary">
                        <label class="form-label text-light small fw-bold text-uppercase">Add Investigation Note</label>
                        <div class="input-group">
                            <input v-model="newNote" type="text" class="form-control noc-input" placeholder="Type investigation update, diagnostic log, or action taken..." @keyup.enter="addNote" />
                            <button class="btn noc-create-btn fw-bold px-3" :disabled="!newNote.trim()" @click="addNote">
                                Post Note
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right 4 Columns: Assigned Engineer & Linked Infrastructure -->
            <div class="col-12 col-lg-4">
                <!-- Assigned Engineer Box -->
                <div class="noc-section-box p-3 mb-4 shadow-sm">
                    <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="user-shield" />
                        <span>Assigned Lead Engineer</span>
                    </h6>
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <div class="fw-bold text-light">{{ incident.assigned_username || 'Unassigned' }}</div>
                            <div class="small text-muted">Primary Incident Responder</div>
                        </div>
                        <button class="btn btn-sm btn-outline-warning" @click="showAssignModal = true">
                            Change
                        </button>
                    </div>
                </div>

                <!-- Linked Infrastructure Assets -->
                <div class="noc-section-box p-3 shadow-sm">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold text-warning mb-0 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="link" />
                            <span>Linked Infrastructure Assets</span>
                        </h6>
                        <button class="btn btn-sm btn-outline-secondary" @click="showLinkModal = true">
                            + Link
                        </button>
                    </div>

                    <div v-if="incident.links && incident.links.length > 0" class="d-flex flex-column gap-2">
                        <div v-for="l in incident.links" :key="l.id" class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-secondary font-monospace me-2 text-uppercase">{{ l.entity_type }}</span>
                                <span class="text-light font-monospace small">#{{ l.entity_id }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-center py-4 text-muted small">
                        No linked alerts, devices, or monitors linked yet.
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 1: Assign Engineer -->
        <div v-if="showAssignModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Assign Lead Engineer</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAssignModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <label class="form-label text-light small fw-bold text-uppercase">Select User</label>
                        <select v-model="selectedAssignUserId" class="form-select noc-input">
                            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
                        </select>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAssignModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!selectedAssignUserId" @click="saveAssignEngineer">Save Assignment</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 2: Resolve Incident -->
        <div v-if="showResolveModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-success">Resolve Incident #INC-{{ incident.id }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showResolveModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-light small fw-bold text-uppercase">Root Cause</label>
                            <textarea v-model="resolveData.root_cause" class="form-control noc-input" rows="2" placeholder="e.g. Upstream fiber cut near Kakinada junction"></textarea>
                        </div>
                        <div>
                            <label class="form-label text-light small fw-bold text-uppercase">Resolution Action Taken</label>
                            <textarea v-model="resolveData.resolution" class="form-control noc-input" rows="3" placeholder="e.g. Spliced primary fiber core and restored BGP routes"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showResolveModal = false">Cancel</button>
                        <button type="button" class="btn btn-success px-4 fw-bold" @click="confirmResolve">Confirm Resolution</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal 3: Link Infrastructure Entity -->
        <div v-if="showLinkModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning">Link Infrastructure Asset</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showLinkModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-light small fw-bold text-uppercase">Asset Type</label>
                            <select v-model="newLink.entity_type" class="form-select noc-input">
                                <option value="device">Hardware Device</option>
                                <option value="monitor">Service Monitor</option>
                                <option value="alert">Active Alert</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label text-light small fw-bold text-uppercase">Asset ID</label>
                            <input v-model.number="newLink.entity_id" type="number" class="form-control noc-input" placeholder="e.g. 10" />
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showLinkModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newLink.entity_id" @click="confirmLink">Link Asset</button>
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
            incident: null,
            users: [],
            newNote: "",
            showAssignModal: false,
            selectedAssignUserId: null,
            showResolveModal: false,
            resolveData: { root_cause: "", resolution: "" },
            showLinkModal: false,
            newLink: { entity_type: "device", entity_id: null },
        };
    },
    mounted() {
        this.loadDetails();
        this.loadUsers();
    },
    methods: {
        loadDetails() {
            const incidentId = this.$route.params.id;
            this.$root.getSocket().emit("getIncidentDetails", incidentId, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                } else {
                    this.$root.toastError(res ? res.msg : "Error loading incident details");
                }
            });
        },
        loadUsers() {
            // Mock or fetch users
            this.users = [
                { id: 1, username: "noc_engineer_1" },
                { id: 2, username: "lead_operator" },
            ];
        },
        addNote() {
            if (!this.newNote.trim()) {
                return;
            }
            this.$root.getSocket().emit("addIncidentNote", { incidentId: this.incident.id, note: this.newNote }, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                    this.newNote = "";
                    this.$root.toastSuccess("Investigation note posted");
                } else {
                    this.$root.toastError(res ? res.msg : "Error posting note");
                }
            });
        },
        updateStatus(status) {
            this.$root.getSocket().emit("updateIncidentStatus", { incidentId: this.incident.id, status }, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                    this.$root.toastSuccess(`Incident status updated to ${status}`);
                } else {
                    this.$root.toastError(res ? res.msg : "Error updating status");
                }
            });
        },
        confirmResolve() {
            this.$root.getSocket().emit("updateIncidentStatus", {
                incidentId: this.incident.id,
                status: "RESOLVED",
                extraData: this.resolveData,
            }, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                    this.showResolveModal = false;
                    this.$root.toastSuccess("Incident resolved");
                } else {
                    this.$root.toastError(res ? res.msg : "Error resolving incident");
                }
            });
        },
        reopenIncident() {
            if (confirm("Reopen this incident?")) {
                this.$root.getSocket().emit("reopenIncident", this.incident.id, (res) => {
                    if (res && res.ok) {
                        this.incident = res.incident;
                        this.$root.toastSuccess("Incident reopened");
                    } else {
                        this.$root.toastError(res ? res.msg : "Error reopening incident");
                    }
                });
            }
        },
        saveAssignEngineer() {
            this.$root.getSocket().emit("assignIncidentEngineer", { incidentId: this.incident.id, assignedUserId: this.selectedAssignUserId }, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                    this.showAssignModal = false;
                    this.$root.toastSuccess("Lead engineer assigned");
                } else {
                    this.$root.toastError(res ? res.msg : "Error assigning engineer");
                }
            });
        },
        confirmLink() {
            if (!this.newLink.entity_id) {
                return;
            }
            this.$root.getSocket().emit("linkIncidentEntities", { incidentId: this.incident.id, links: [this.newLink] }, (res) => {
                if (res && res.ok) {
                    this.incident = res.incident;
                    this.showLinkModal = false;
                    this.newLink = { entity_type: "device", entity_id: null };
                    this.$root.toastSuccess("Infrastructure asset linked");
                } else {
                    this.$root.toastError(res ? res.msg : "Error linking asset");
                }
            });
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
        getEventBadgeClass(evt) {
            switch (evt) {
                case "created": return "bg-danger";
                case "assigned": return "bg-warning text-dark";
                case "acknowledged": return "bg-primary";
                case "status_change": return "bg-info text-dark";
                case "investigation_note": return "bg-dark border border-secondary text-light";
                case "reopened": return "bg-danger";
                case "closed": return "bg-secondary";
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
.noc-incident-details-page {
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

.border-left-success {
    border-left: 4px solid #22c55e;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
