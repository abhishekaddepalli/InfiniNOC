<template>
    <div class="super-admin-settings">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="cog" class="text-light" />
                    <span>Global SaaS Platform Settings</span>
                </h3>
                <div class="text-muted small">
                    Configure platform maintenance mode, self-serve tenant signups, default trial duration, and operational toggles.
                </div>
            </div>
            <button class="btn btn-primary fw-bold" @click="saveSettings">
                Save Platform Settings
            </button>
        </div>

        <div class="row g-4">
            <!-- Left: Governance -->
            <div class="col-12 col-md-6">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <h5 class="fw-bold text-primary mb-3">Platform Operations & Access</h5>

                    <div class="form-check form-switch mb-3">
                        <input id="maintMode" v-model="form.maintenanceMode" class="form-check-input" type="checkbox" />
                        <label class="form-check-label fw-bold text-danger" for="maintMode">Enable Platform Maintenance Mode</label>
                        <div class="form-text small text-muted">When enabled, non-Super Admin users will see a maintenance notice upon logging in.</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Maintenance Message Notice</label>
                        <textarea v-model="form.maintenanceMessage" class="form-control bg-card border-secondary text-foreground" rows="2" placeholder="Scheduled maintenance in progress..."></textarea>
                    </div>

                    <div class="form-check form-switch mb-3">
                        <input id="allowSignup" v-model="form.allowSelfSignup" class="form-check-input" type="checkbox" />
                        <label class="form-check-label fw-bold text-success" for="allowSignup">Allow Public Self-Serve Tenant Signup (/signup)</label>
                        <div class="form-text small text-muted">Disable if you want organization creation restricted to Super Admins only.</div>
                    </div>
                </div>
            </div>

            <!-- Right: Subscription Defaults -->
            <div class="col-12 col-md-6">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <h5 class="fw-bold text-warning mb-3">Subscription & Trial Defaults</h5>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Default Trial Period (Days)</label>
                        <input v-model.number="form.defaultTrialDays" type="number" class="form-control bg-card border-secondary text-foreground" />
                        <div class="form-text small text-muted">Trial duration granted to new self-serve signups.</div>
                    </div>

                    <h5 class="fw-bold text-info mt-4 mb-3">Progressive Web App (PWA) & Mobile</h5>

                    <div class="form-check form-switch mb-3">
                        <input id="enablePwa" v-model="form.enablePwaPrompt" class="form-check-input" type="checkbox" />
                        <label class="form-check-label fw-bold text-info" for="enablePwa">Enable PWA Standalone Mobile Install Banner</label>
                        <div class="form-text small text-muted">Prompts mobile and desktop users to install InfiniNOC as a native-feeling app.</div>
                    </div>

                    <div class="form-check form-switch mb-3">
                        <input id="enableOffline" v-model="form.offlineCacheEnabled" class="form-check-input" type="checkbox" />
                        <label class="form-check-label fw-bold text-success" for="enableOffline">Enable Service Worker Offline Cache</label>
                        <div class="form-text small text-muted">Allows NOC engineers to view last-cached telemetry during network outages.</div>
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
            form: {
                maintenanceMode: false,
                allowSelfSignup: true,
                defaultTrialDays: 14,
                maintenanceMessage: "Scheduled InfiniNOC platform maintenance in progress.",
            },
            loading: true,
        };
    },
    mounted() {
        this.fetchSettings();
    },
    methods: {
        fetchSettings() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminPlatformSettings", (res) => {
                this.loading = false;
                if (res && res.ok && res.settings) {
                    this.form = { ...res.settings };
                }
            });
        },
        saveSettings() {
            this.$root.getSocket().emit("saveSuperAdminPlatformSettings", this.form, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Global platform settings saved.");
                    this.fetchSettings();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to save settings.");
                }
            });
        },
    },
};
</script>
