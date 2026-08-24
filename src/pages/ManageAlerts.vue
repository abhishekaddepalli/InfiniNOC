<template>
    <div class="noc-alerts-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="bell" />
                    <span>Enterprise Alert Management</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Rule evaluation, deduplication, cooldown, and recovery engine for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <button class="btn noc-create-btn fw-bold px-3 py-2 d-flex align-items-center gap-2" @click="showCreateRuleModal = true">
                <font-awesome-icon icon="plus-circle" />
                <span>Create Alert Rule</span>
            </button>
        </div>

        <!-- 4 Telemetry Summary Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-amber">
                    <div class="noc-card-title mb-1">Active Alerts</div>
                    <div class="noc-card-value text-foreground">{{ activeAlerts.length }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-danger">
                    <div class="noc-card-title mb-1">Critical</div>
                    <div class="noc-card-value text-danger">{{ criticalCount }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-warning">
                    <div class="noc-card-title mb-1">Warning</div>
                    <div class="noc-card-value text-warning">{{ warningCount }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="noc-card p-3 shadow-sm border-left-secondary">
                    <div class="noc-card-title mb-1">Silenced / Acked</div>
                    <div class="noc-card-value text-secondary">{{ ackedCount }}</div>
                </div>
            </div>
        </div>

        <!-- Tabs Navigation -->
        <ul class="nav nav-tabs border-secondary mb-3">
            <li class="nav-item">
                <button class="nav-link text-foreground fw-bold" :class="{ active: currentTab === 'active' }" @click="currentTab = 'active'">
                    Active Alerts ({{ activeAlerts.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link text-foreground fw-bold" :class="{ active: currentTab === 'rules' }" @click="currentTab = 'rules'">
                    Alert Rules ({{ alertRules.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link text-foreground fw-bold" :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">
                    Alert History Audit Log
                </button>
            </li>
        </ul>

        <!-- TAB 1: Active Alerts Table -->
        <div v-if="currentTab === 'active'" class="noc-section-box p-3">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Severity</th>
                            <th>Rule Name</th>
                            <th>Metric</th>
                            <th>Value</th>
                            <th>First Triggered</th>
                            <th>Status</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="a in activeAlerts" :key="a.id">
                            <td>
                                <span class="badge" :class="a.state === 'CRITICAL' ? 'bg-danger' : 'bg-warning text-dark'">
                                    {{ a.state }}
                                </span>
                            </td>
                            <td class="fw-bold text-foreground">{{ a.rule_name || 'Alert #' + a.rule_id }}</td>
                            <td><span class="badge bg-secondary font-monospace">{{ a.metric }}</span></td>
                            <td class="font-monospace text-info">{{ a.trigger_value }}</td>
                            <td class="small text-muted">{{ formatDate(a.first_triggered_at) }}</td>
                            <td>
                                <span v-if="a.acknowledged" class="badge bg-success">ACKNOWLEDGED</span>
                                <span v-else-if="isSilenced(a)" class="badge bg-secondary">SILENCED</span>
                                <span v-else class="badge bg-danger">FIRING</span>
                            </td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <button v-if="!a.acknowledged" class="btn btn-outline-success" title="Acknowledge Alert" @click="acknowledgeAlert(a.id)">
                                        <font-awesome-icon icon="check" class="me-1" /> Ack
                                    </button>
                                    <button class="btn btn-outline-secondary" title="Silence 1 Hour" @click="silenceAlert(a.id, 60)">
                                        <font-awesome-icon icon="bell-slash" class="me-1" /> Silence 1h
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="activeAlerts.length === 0">
                            <td colspan="7" class="text-center py-5 text-muted">
                                <font-awesome-icon icon="check-circle" class="display-3 mb-3 text-success" />
                                <h5>All Systems Operational</h5>
                                <p class="small text-secondary">No active alerts currently firing across your organization.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 2: Alert Rules Configurator -->
        <div v-if="currentTab === 'rules'" class="noc-section-box p-3">
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Rule Name</th>
                            <th>Target</th>
                            <th>Metric</th>
                            <th>Condition</th>
                            <th>Duration</th>
                            <th>Severity</th>
                            <th>Cooldown</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in alertRules" :key="r.id">
                            <td class="fw-bold text-light">{{ r.name }}</td>
                            <td><span class="badge bg-dark border border-secondary text-info">{{ r.target_type }}</span></td>
                            <td><span class="badge bg-secondary font-monospace">{{ r.metric }}</span></td>
                            <td class="font-monospace text-warning">{{ r.operator }} {{ r.threshold }}</td>
                            <td class="small text-muted">{{ Math.floor(r.duration_seconds / 60) }} mins</td>
                            <td>
                                <span class="badge" :class="r.severity === 'CRITICAL' ? 'bg-danger' : 'bg-warning text-dark'">
                                    {{ r.severity }}
                                </span>
                            </td>
                            <td class="small text-muted">{{ Math.floor(r.cooldown_seconds / 60) }} mins</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger" title="Delete Rule" @click="deleteRule(r.id)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="alertRules.length === 0">
                            <td colspan="8" class="text-center py-5 text-muted">
                                <h5>No Alert Rules Configured</h5>
                                <p class="small text-secondary">Click "Create Alert Rule" to define automated threshold monitoring.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 3: Alert Audit History -->
        <div v-if="currentTab === 'history'" class="noc-section-box p-3">
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Timestamp</th>
                            <th>State Transition</th>
                            <th>Log Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="h in alertHistory" :key="h.id">
                            <td class="small text-muted font-monospace">{{ formatDate(h.created_at) }}</td>
                            <td>
                                <span class="badge" :class="getHistoryBadgeClass(h.state)">
                                    {{ h.state }}
                                </span>
                            </td>
                            <td class="text-light small font-monospace">{{ h.message }}</td>
                        </tr>
                        <tr v-if="alertHistory.length === 0">
                            <td colspan="3" class="text-center py-5 text-muted">
                                No historical alert log records recorded yet.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal 1: Create Alert Rule -->
        <div v-if="showCreateRuleModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="bell" />
                            <span>Create Enterprise Alert Rule</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateRuleModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3">
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Rule Name</label>
                                <input v-model="newRule.name" type="text" class="form-control noc-input" placeholder="e.g. Core Router CPU Critical" />
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Target Type</label>
                                <select v-model="newRule.target_type" class="form-select noc-input">
                                    <option value="device">Hardware Device</option>
                                    <option value="probe">Remote Distributed Probe</option>
                                    <option value="monitor">Service Monitor</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label fw-semibold text-light small text-uppercase">Metric Rule</label>
                                <select v-model="newRule.metric" class="form-select noc-input">
                                    <option value="device_unavailable">Device Unavailable (Ping / SNMP Down)</option>
                                    <option value="cpu">High CPU Utilization (%)</option>
                                    <option value="memory">High Memory Utilization (%)</option>
                                    <option value="temperature">High Temperature (°C)</option>
                                    <option value="interface_down">Interface Down</option>
                                    <option value="bandwidth">High Bandwidth Traffic (bps)</option>
                                    <option value="packet_loss">High Packet Loss (%)</option>
                                    <option value="latency">High Latency (ms)</option>
                                    <option value="probe_offline">Probe Offline</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Operator</label>
                                <select v-model="newRule.operator" class="form-select noc-input font-monospace">
                                    <option value=">">&gt; (Greater Than)</option>
                                    <option value=">=">&gt;= (Greater Than or Equal)</option>
                                    <option value="<">&lt; (Less Than)</option>
                                    <option value="<=">&lt;= (Less Than or Equal)</option>
                                    <option value="==">== (Equal To)</option>
                                    <option value="!=">!= (Not Equal)</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-3">
                                <label class="form-label fw-semibold text-light small text-uppercase">Threshold</label>
                                <input v-model.number="newRule.threshold" type="number" class="form-control noc-input" placeholder="90" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Duration (Sec)</label>
                                <input v-model.number="newRule.duration_seconds" type="number" class="form-control noc-input" placeholder="300" />
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Severity Level</label>
                                <select v-model="newRule.severity" class="form-select noc-input">
                                    <option value="WARNING">WARNING</option>
                                    <option value="CRITICAL">CRITICAL</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label fw-semibold text-light small text-uppercase">Cooldown (Sec)</label>
                                <input v-model.number="newRule.cooldown_seconds" type="number" class="form-control noc-input" placeholder="1800" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateRuleModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newRule.name || newRule.threshold === null" @click="saveAlertRule">
                            Create Rule
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
            currentTab: "active",
            activeAlerts: [],
            alertRules: [],
            alertHistory: [],
            showCreateRuleModal: false,
            newRule: {
                name: "",
                target_type: "device",
                target_id: null,
                metric: "cpu",
                operator: ">",
                threshold: 90,
                duration_seconds: 300,
                severity: "WARNING",
                cooldown_seconds: 1800,
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
        criticalCount() {
            return this.activeAlerts.filter((a) => a.state === "CRITICAL").length;
        },
        warningCount() {
            return this.activeAlerts.filter((a) => a.state === "WARNING").length;
        },
        ackedCount() {
            return this.activeAlerts.filter((a) => a.acknowledged || this.isSilenced(a)).length;
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
            this.$root.getSocket().emit("getActiveAlerts", (res) => {
                if (res && res.ok) {
                    this.activeAlerts = res.alerts || [];
                }
            });
            this.$root.getSocket().emit("getAlertRules", (res) => {
                if (res && res.ok) {
                    this.alertRules = res.rules || [];
                }
            });
            this.$root.getSocket().emit("getAlertHistory", (res) => {
                if (res && res.ok) {
                    this.alertHistory = res.history || [];
                }
            });
        },
        saveAlertRule() {
            if (!this.newRule.name || this.newRule.threshold === null) {
                return;
            }
            this.$root.getSocket().emit("saveAlertRule", this.newRule, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Alert rule created");
                    this.showCreateRuleModal = false;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error creating rule");
                }
            });
        },
        deleteRule(ruleId) {
            if (confirm("Delete this alert rule? Active alerts linked to it will also be closed.")) {
                this.$root.getSocket().emit("deleteAlertRule", ruleId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Alert rule deleted");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error deleting rule");
                    }
                });
            }
        },
        acknowledgeAlert(alertId) {
            this.$root.getSocket().emit("acknowledgeAlert", alertId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Alert acknowledged");
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error acknowledging alert");
                }
            });
        },
        silenceAlert(alertId, minutes) {
            this.$root.getSocket().emit("silenceAlert", { alertId, silenceMinutes: minutes }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Alert silenced for ${minutes} minutes`);
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error silencing alert");
                }
            });
        },
        isSilenced(alert) {
            if (!alert.silenced_until) {
                return false;
            }
            return new Date(alert.silenced_until) > new Date();
        },
        getHistoryBadgeClass(state) {
            if (state === "CRITICAL") {
                return "bg-danger";
            }
            if (state === "WARNING") {
                return "bg-warning text-dark";
            }
            if (state === "RECOVERED" || state === "OK") {
                return "bg-success";
            }
            return "bg-secondary";
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
.noc-alerts-page {
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

.nav-tabs .nav-link {
    border: 1px solid transparent;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

.nav-tabs .nav-link.active {
    background-color: var(--card);
    border-color: var(--border) var(--border) var(--card);
    color: var(--accent) !important;
}
</style>
