<template>
    <div class="manage-notifications p-3 p-md-4">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 text-light d-flex align-items-center gap-2">
                    <font-awesome-icon icon="bell" class="text-warning" />
                    <span>Notification Channels & Routing Engine</span>
                </h1>
                <p class="text-secondary small mb-0">Configure multi-channel alerts (Email, Telegram, WhatsApp Business Cloud API, Webhook), P1–P4 severity escalation matrix, and cooldown duplicate suppression.</p>
            </div>
            <div class="d-flex gap-2">
                <button v-if="activeTab === 'channels'" class="btn btn-warning fw-bold px-3" @click="openChannelModal()">
                    <font-awesome-icon icon="plus" class="me-1" /> Add Channel
                </button>
                <button v-if="activeTab === 'rules'" class="btn btn-warning fw-bold px-3" @click="openRuleModal()">
                    <font-awesome-icon icon="plus" class="me-1" /> Add Routing Rule
                </button>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <ul class="nav nav-tabs border-secondary mb-4">
            <li class="nav-item">
                <button class="nav-link fw-bold" :class="{ active: activeTab === 'channels' }" @click="activeTab = 'channels'">
                    <font-awesome-icon icon="satellite-dish" class="me-1" /> Notification Channels ({{ channels.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link fw-bold" :class="{ active: activeTab === 'rules' }" @click="activeTab = 'rules'">
                    <font-awesome-icon icon="project-diagram" class="me-1" /> Routing & Escalation Rules ({{ rules.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link fw-bold" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">
                    <font-awesome-icon icon="history" class="me-1" /> Audit Delivery Logs
                </button>
            </li>
        </ul>

        <!-- TAB 1: Channels List -->
        <div v-if="activeTab === 'channels'">
            <div class="row g-3">
                <div v-for="c in channels" :key="c.id" class="col-12 col-md-6 col-xl-3">
                    <div class="noc-channel-card p-3 shadow-sm border-start border-4" :class="getChannelBorderClass(c.channel_type)">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge" :class="getChannelBadgeClass(c.channel_type)">
                                <font-awesome-icon :icon="getChannelIcon(c.channel_type)" class="me-1" /> {{ c.channel_type }}
                            </span>
                            <span class="badge" :class="c.is_enabled ? 'bg-success' : 'bg-secondary'">
                                {{ c.is_enabled ? 'Active' : 'Disabled' }}
                            </span>
                        </div>
                        <h5 class="fw-bold text-light mb-1">{{ c.name }}</h5>
                        <p class="small text-secondary font-monospace mb-3">{{ c.masked_config }}</p>

                        <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                            <button class="btn btn-sm btn-outline-info fw-bold" @click="testChannel(c.id)">
                                <font-awesome-icon icon="paper-plane" class="me-1" /> Test
                            </button>
                            <button class="btn btn-sm btn-outline-danger" @click="deleteChannel(c.id)">
                                <font-awesome-icon icon="trash-alt" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 2: Routing Rules & Severity Matrix -->
        <div v-if="activeTab === 'rules'">
            <div class="noc-section-box p-3 mb-4">
                <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="shield-alt" />
                    <span>Default Severity Routing Matrix</span>
                </h6>
                <div class="row g-2 text-center small font-monospace">
                    <div class="col-12 col-md-3">
                        <div class="p-2 rounded bg-dark border border-danger">
                            <div class="fw-bold text-danger">P1 CRITICAL</div>
                            <span class="text-light">WhatsApp + Telegram + Email</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-3">
                        <div class="p-2 rounded bg-dark border border-warning">
                            <div class="fw-bold text-warning">P2 WARNING</div>
                            <span class="text-light">Telegram + Email</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-3">
                        <div class="p-2 rounded bg-dark border border-info">
                            <div class="fw-bold text-info">P3 INFORMATIONAL</div>
                            <span class="text-light">Email</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-3">
                        <div class="p-2 rounded bg-dark border border-secondary">
                            <div class="fw-bold text-secondary">P4 TRIVIAL</div>
                            <span class="text-light">Dashboard Only</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Rule Name</th>
                            <th>Event Type</th>
                            <th>Min Severity</th>
                            <th>Target Channel</th>
                            <th>Cooldown Window</th>
                            <th>Escalation</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in rules" :key="r.id">
                            <td class="fw-bold text-light">{{ r.name }}</td>
                            <td><span class="badge bg-primary font-monospace">{{ r.event_type }}</span></td>
                            <td><span class="badge" :class="getSeverityBadgeClass(r.min_severity)">{{ r.min_severity }}</span></td>
                            <td><span class="fw-bold text-warning">{{ r.channel_name || ('Channel #' + r.channel_id) }}</span></td>
                            <td class="font-monospace text-info">{{ r.cooldown_minutes }}m cooldown</td>
                            <td class="small text-secondary">
                                {{ r.escalation_timeout_minutes ? (r.escalation_timeout_minutes + 'm escalation') : 'None' }}
                            </td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger" @click="deleteRule(r.id)">
                                    <font-awesome-icon icon="trash-alt" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 3: Delivery Logs -->
        <div v-if="activeTab === 'logs'">
            <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Delivered At</th>
                            <th>Event</th>
                            <th>Severity</th>
                            <th>Channel</th>
                            <th>Recipient Target</th>
                            <th>Status</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="log in logs" :key="log.id">
                            <td class="font-monospace text-secondary small">{{ formatDate(log.delivered_at) }}</td>
                            <td><span class="badge bg-dark border border-secondary font-monospace">{{ log.event_type }}</span></td>
                            <td><span class="badge" :class="getSeverityBadgeClass(log.severity)">{{ log.severity }}</span></td>
                            <td class="fw-bold text-light">{{ log.channel_name || 'System' }}</td>
                            <td class="font-monospace text-info small">{{ log.recipient }}</td>
                            <td>
                                <span class="badge" :class="getLogStatusClass(log.status)">
                                    {{ log.status }}
                                </span>
                            </td>
                            <td class="small text-secondary">{{ log.error_message || 'OK' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add Channel Modal -->
        <div v-if="showChannelModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.7);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-light border border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-warning">Add Notification Channel</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showChannelModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label text-secondary small">Channel Name</label>
                            <input v-model="newChannel.name" type="text" class="form-control bg-secondary text-light border-0" placeholder="e.g. NOC WhatsApp Urgent" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary small">Channel Type</label>
                            <select v-model="newChannel.channelType" class="form-select bg-secondary text-light border-0">
                                <option value="EMAIL">Email (SMTP)</option>
                                <option value="TELEGRAM">Telegram Bot API</option>
                                <option value="WHATSAPP">WhatsApp Business Cloud API (Official)</option>
                                <option value="WEBHOOK">HTTP Webhook</option>
                            </select>
                        </div>

                        <!-- Email Config -->
                        <div v-if="newChannel.channelType === 'EMAIL'" class="border border-secondary p-3 rounded mb-3">
                            <label class="form-label text-info small fw-bold">SMTP Server Config (Encrypted AES-256-GCM)</label>
                            <input v-model="newChannel.config.host" type="text" class="form-control bg-secondary text-light border-0 mb-2" placeholder="smtp.mailgun.org" />
                            <input v-model="newChannel.config.to" type="text" class="form-control bg-secondary text-light border-0 mb-2" placeholder="noc-team@company.com" />
                        </div>

                        <!-- Telegram Config -->
                        <div v-if="newChannel.channelType === 'TELEGRAM'" class="border border-secondary p-3 rounded mb-3">
                            <label class="form-label text-info small fw-bold">Telegram Bot Settings (Encrypted AES-256-GCM)</label>
                            <input v-model="newChannel.config.botToken" type="password" class="form-control bg-secondary text-light border-0 mb-2" placeholder="Bot Token (e.g. 123456789:ABC...)" />
                            <input v-model="newChannel.config.chatId" type="text" class="form-control bg-secondary text-light border-0" placeholder="Chat ID (e.g. -1001928374)" />
                        </div>

                        <!-- WhatsApp Cloud API Config -->
                        <div v-if="newChannel.channelType === 'WHATSAPP'" class="border border-secondary p-3 rounded mb-3">
                            <label class="form-label text-success small fw-bold">WhatsApp Business Cloud API (Meta Official)</label>
                            <input v-model="newChannel.config.accessToken" type="password" class="form-control bg-secondary text-light border-0 mb-2" placeholder="Graph API Access Token" />
                            <input v-model="newChannel.config.phoneNumberId" type="text" class="form-control bg-secondary text-light border-0 mb-2" placeholder="Phone Number ID (e.g. 1092837465)" />
                            <input v-model="newChannel.config.recipientPhoneNumber" type="text" class="form-control bg-secondary text-light border-0" placeholder="Recipient Phone (+15550192834)" />
                        </div>

                        <!-- Webhook Config -->
                        <div v-if="newChannel.channelType === 'WEBHOOK'" class="border border-secondary p-3 rounded mb-3">
                            <label class="form-label text-info small fw-bold">Webhook Endpoint (Encrypted AES-256-GCM)</label>
                            <input v-model="newChannel.config.url" type="text" class="form-control bg-secondary text-light border-0 mb-2" placeholder="https://hooks.slack.com/services/..." />
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-outline-secondary" @click="showChannelModal = false">Cancel</button>
                        <button class="btn btn-warning fw-bold" @click="saveChannel">Save Channel</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Rule Modal -->
        <div v-if="showRuleModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.7);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-light border border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-warning">Add Routing Rule</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showRuleModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label text-secondary small">Rule Name</label>
                            <input v-model="newRule.name" type="text" class="form-control bg-secondary text-light border-0" placeholder="e.g. Urgent P1 Escalation Rule" />
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-secondary small">Event Type</label>
                                <select v-model="newRule.eventType" class="form-select bg-secondary text-light border-0">
                                    <option value="ALERT">ALERT</option>
                                    <option value="INCIDENT">INCIDENT</option>
                                    <option value="RECOVERY">RECOVERY</option>
                                    <option value="PROBE_OFFLINE">PROBE_OFFLINE</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-secondary small">Min Severity</label>
                                <select v-model="newRule.minSeverity" class="form-select bg-secondary text-light border-0">
                                    <option value="P1">P1 (Critical)</option>
                                    <option value="P2">P2 (Warning)</option>
                                    <option value="P3">P3 (Informational)</option>
                                    <option value="P4">P4 (Dashboard Only)</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary small">Notification Channel</label>
                            <select v-model="newRule.channelId" class="form-select bg-secondary text-light border-0">
                                <option v-for="c in channels" :key="c.id" :value="c.id">
                                    {{ c.name }} ({{ c.channel_type }})
                                </option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary small">Cooldown Minutes (Duplicate Suppression)</label>
                            <input v-model.number="newRule.cooldownMinutes" type="number" class="form-control bg-secondary text-light border-0" placeholder="15" />
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-outline-secondary" @click="showRuleModal = false">Cancel</button>
                        <button class="btn btn-warning fw-bold" @click="saveRule">Save Rule</button>
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
            activeTab: "channels",
            channels: [],
            rules: [],
            logs: [],
            showChannelModal: false,
            showRuleModal: false,
            newChannel: {
                name: "",
                channelType: "WHATSAPP",
                config: {},
            },
            newRule: {
                name: "",
                eventType: "ALERT",
                minSeverity: "P1",
                channelId: null,
                cooldownMinutes: 15,
            },
        };
    },
    mounted() {
        this.loadChannels();
        this.loadRules();
        this.loadLogs();
    },
    methods: {
        loadChannels() {
            this.$root.getSocket().emit("getNotificationChannels", (res) => {
                if (res && res.ok) {
                    this.channels = res.channels || [];
                }
            });
        },
        loadRules() {
            this.$root.getSocket().emit("getNotificationRoutingRules", (res) => {
                if (res && res.ok) {
                    this.rules = res.rules || [];
                }
            });
        },
        loadLogs() {
            this.$root.getSocket().emit("getNotificationDeliveryLogs", (res) => {
                if (res && res.ok) {
                    this.logs = res.logs || [];
                }
            });
        },
        openChannelModal() {
            this.newChannel = { name: "", channelType: "WHATSAPP", config: {} };
            this.showChannelModal = true;
        },
        saveChannel() {
            this.$root.getSocket().emit("saveNotificationChannel", this.newChannel, (res) => {
                if (res && res.ok) {
                    this.showChannelModal = false;
                    this.loadChannels();
                }
            });
        },
        deleteChannel(id) {
            this.$root.getSocket().emit("deleteNotificationChannel", id, (res) => {
                if (res && res.ok) {
                    this.loadChannels();
                }
            });
        },
        testChannel(id) {
            this.$root.getSocket().emit("testNotificationChannel", id, (res) => {
                if (res && res.ok) {
                    alert("Test notification sent successfully!");
                    this.loadLogs();
                }
            });
        },
        openRuleModal() {
            this.newRule = {
                name: "",
                eventType: "ALERT",
                minSeverity: "P1",
                channelId: this.channels.length > 0 ? this.channels[0].id : null,
                cooldownMinutes: 15,
            };
            this.showRuleModal = true;
        },
        saveRule() {
            this.$root.getSocket().emit("saveNotificationRoutingRule", this.newRule, (res) => {
                if (res && res.ok) {
                    this.showRuleModal = false;
                    this.loadRules();
                }
            });
        },
        deleteRule(id) {
            this.$root.getSocket().emit("deleteNotificationRoutingRule", id, (res) => {
                if (res && res.ok) {
                    this.loadRules();
                }
            });
        },
        getChannelBorderClass(type) {
            if (type === "WHATSAPP") {
                return "border-success";
            }
            if (type === "TELEGRAM") {
                return "border-info";
            }
            if (type === "EMAIL") {
                return "border-warning";
            }
            return "border-secondary";
        },
        getChannelBadgeClass(type) {
            if (type === "WHATSAPP") {
                return "bg-success";
            }
            if (type === "TELEGRAM") {
                return "bg-info text-dark";
            }
            if (type === "EMAIL") {
                return "bg-warning text-dark";
            }
            return "bg-secondary";
        },
        getChannelIcon(type) {
            if (type === "WHATSAPP") {
                return "comment-alt";
            }
            if (type === "TELEGRAM") {
                return "paper-plane";
            }
            if (type === "EMAIL") {
                return "envelope";
            }
            return "network-wired";
        },
        getSeverityBadgeClass(sev) {
            if (sev === "P1") {
                return "bg-danger";
            }
            if (sev === "P2") {
                return "bg-warning text-dark";
            }
            if (sev === "P3") {
                return "bg-info text-dark";
            }
            return "bg-secondary";
        },
        getLogStatusClass(status) {
            if (status === "SUCCESS") {
                return "bg-success";
            }
            if (status === "SUPPRESSED_COOLDOWN") {
                return "bg-warning text-dark";
            }
            if (status === "SUPPRESSED_DASHBOARD_ONLY") {
                return "bg-info text-dark";
            }
            return "bg-danger";
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "-";
            }
            return new Date(isoStr).toLocaleString();
        },
    },
};
</script>

<style scoped>
.manage-notifications {
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
}

.noc-channel-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border-radius: 10px;
    border: 1px solid var(--border);
}

.noc-section-box {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
