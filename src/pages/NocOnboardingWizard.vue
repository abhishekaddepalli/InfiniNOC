<template>
    <div class="noc-onboarding-container min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-5">
        <div class="noc-onboarding-card shadow-lg p-4 p-md-5 rounded-4 w-100" style="max-width: 800px;">
            <!-- Header Brand -->
            <div class="text-center mb-4">
                <div class="d-inline-flex align-items-center gap-2 mb-2">
                    <span class="fs-2 fw-bold text-warning">InfiniNOC</span>
                    <span class="badge bg-warning text-dark font-monospace">2.0</span>
                </div>
                <h2 class="fw-bold h4 mb-1 text-foreground">Welcome to InfiniNOC Enterprise Monitoring</h2>
                <p class="text-secondary small">Complete this 4-step onboarding wizard to initialize your ISP/NOC monitoring workspace.</p>
            </div>

            <!-- 4-Step Progress Bar -->
            <div class="position-relative mb-5 px-3">
                <div class="progress bg-secondary" style="height: 4px;">
                    <div
                        class="progress-bar bg-warning"
                        role="progressbar"
                        :style="{ width: `${((currentStep - 1) / 3) * 100}%` }"
                    ></div>
                </div>

                <div class="d-flex justify-content-between position-absolute top-50 start-0 end-0 translate-middle-y px-3">
                    <div
                        v-for="s in 4"
                        :key="s"
                        class="rounded-circle d-flex align-items-center justify-content-center fw-bold fs-6 transition-all"
                        :class="s <= currentStep ? 'bg-warning text-dark' : 'bg-secondary text-muted'"
                        style="width: 36px; height: 36px; border: 3px solid var(--card);"
                    >
                        {{ s }}
                    </div>
                </div>
            </div>

            <!-- Step Titles -->
            <div class="text-center mb-4">
                <h3 class="h5 fw-bold text-warning mb-1">
                    <span v-if="currentStep === 1">Step 1: Organization Setup</span>
                    <span v-if="currentStep === 2">Step 2: Add First Monitor / Device</span>
                    <span v-if="currentStep === 3">Step 3: Alert Notifications</span>
                    <span v-if="currentStep === 4">Step 4: Invite Team Members</span>
                </h3>
                <p class="small text-secondary mb-0">
                    <span v-if="currentStep === 1">Define your ISP organization workspace and primary region.</span>
                    <span v-if="currentStep === 2">Configure your initial HTTP endpoint, ping target, or network device.</span>
                    <span v-if="currentStep === 3">Set up instant alerting via Telegram, Slack, Webhook, or Email.</span>
                    <span v-if="currentStep === 4">Grant access to NOC engineers, admins, and operators.</span>
                </p>
            </div>

            <!-- STEP 1: Organization Setup -->
            <div v-if="currentStep === 1" class="step-content">
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Organization Name</label>
                    <input v-model="orgForm.name" type="text" class="form-control noc-input" placeholder="e.g. Acme Telecom ISP" />
                </div>
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Primary Region / Country</label>
                    <input v-model="orgForm.region" type="text" class="form-control noc-input" placeholder="e.g. North America (us-east-1)" />
                </div>
            </div>

            <!-- STEP 2: Add First Monitor / Device -->
            <div v-if="currentStep === 2" class="step-content">
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Target Name</label>
                    <input v-model="monitorForm.name" type="text" class="form-control noc-input" placeholder="e.g. Primary Edge Router Ping" />
                </div>
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label text-secondary small fw-bold text-uppercase">Monitor Type</label>
                        <select v-model="monitorForm.type" class="form-select noc-input">
                            <option value="http">HTTP(s) Website / API</option>
                            <option value="ping">Ping (ICMP)</option>
                            <option value="port">TCP Port</option>
                            <option value="dns">DNS Host Record</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label text-secondary small fw-bold text-uppercase">URL or Hostname / IP</label>
                        <input v-model="monitorForm.url" type="text" class="form-control noc-input" placeholder="https://example.com or 192.168.1.1" />
                    </div>
                </div>
            </div>

            <!-- STEP 3: Alert Notifications -->
            <div v-if="currentStep === 3" class="step-content">
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Channel Name</label>
                    <input v-model="notifyForm.name" type="text" class="form-control noc-input" placeholder="e.g. NOC Urgent Telegram Channel" />
                </div>
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Notification Type</label>
                    <select v-model="notifyForm.type" class="form-select noc-input">
                        <option value="telegram">Telegram Bot</option>
                        <option value="slack">Slack Webhook</option>
                        <option value="discord">Discord Webhook</option>
                        <option value="email">SMTP Email</option>
                        <option value="webhook">Custom Webhook</option>
                    </select>
                </div>
            </div>

            <!-- STEP 4: Invite Team Members -->
            <div v-if="currentStep === 4" class="step-content">
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Member Email Address</label>
                    <input v-model="inviteForm.email" type="email" class="form-control noc-input" placeholder="engineer@example.com" />
                </div>
                <div class="mb-3">
                    <label class="form-label text-secondary small fw-bold text-uppercase">Assigned Role</label>
                    <select v-model="inviteForm.role" class="form-select noc-input">
                        <option value="Admin">Admin (Full Operational Control)</option>
                        <option value="Operator">Operator (Acknowledge & Manage Alerts)</option>
                        <option value="Viewer">Viewer (Read-Only Telemetry)</option>
                    </select>
                </div>
            </div>

            <!-- Step Navigation Buttons -->
            <div class="d-flex justify-content-between align-items-center mt-5 pt-3 border-top border-secondary">
                <button
                    class="btn btn-outline-secondary fw-bold px-4 py-2"
                    :disabled="currentStep === 1"
                    @click="currentStep--"
                >
                    Back
                </button>

                <button
                    v-if="currentStep < 4"
                    class="btn noc-create-btn fw-bold px-4 py-2"
                    @click="currentStep++"
                >
                    Continue
                </button>

                <button
                    v-else
                    class="btn btn-success fw-bold px-4 py-2 d-flex align-items-center gap-2"
                    @click="finishOnboarding"
                >
                    <font-awesome-icon icon="check-circle" />
                    <span>Launch NOC Dashboard</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "NocOnboardingWizard",
    data() {
        return {
            currentStep: 1,
            orgForm: {
                name: "",
                region: "",
            },
            monitorForm: {
                name: "",
                type: "http",
                url: "",
            },
            notifyForm: {
                name: "",
                type: "telegram",
            },
            inviteForm: {
                email: "",
                role: "Operator",
            },
        };
    },
    methods: {
        finishOnboarding() {
            this.$root.toastSuccess("Workspace onboarding completed cleanly!");
            this.$router.push("/dashboard");
        },
    },
};
</script>

<style scoped>
.noc-onboarding-container {
    background-color: var(--background);
}

.noc-onboarding-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    color: var(--card-foreground);
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--input-text);
    border-radius: 8px;
}

.noc-create-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
}
</style>
