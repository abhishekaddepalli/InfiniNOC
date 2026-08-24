<template>
    <div class="super-admin-email">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="envelope" class="text-warning" />
                    <span>Email & Platform SMTP Configuration</span>
                </h3>
                <div class="text-muted small">
                    Configure central platform SMTP server settings for automated invoice delivery, alert notifications, and user invitations.
                </div>
            </div>
            <button class="btn btn-warning fw-bold" @click="saveSmtp">
                Save SMTP Settings
            </button>
        </div>

        <div class="row g-4">
            <div class="col-12 col-md-6">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <h5 class="fw-bold text-primary mb-3">SMTP Server Details</h5>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">SMTP Host</label>
                        <input v-model="form.host" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="smtp.infiniforge.com" />
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label small fw-semibold text-muted text-uppercase">SMTP Port</label>
                            <input v-model.number="form.port" type="number" class="form-control bg-card border-secondary text-foreground" placeholder="587" />
                        </div>
                        <div class="col-6 d-flex align-items-end">
                            <div class="form-check form-switch mb-2">
                                <input id="smtpSecure" v-model="form.secure" class="form-check-input" type="checkbox" />
                                <label class="form-check-label fw-semibold small" for="smtpSecure">SSL / TLS Secure</label>
                            </div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">SMTP Username</label>
                        <input v-model="form.username" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="notifications@infiniforge.com" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">SMTP Password</label>
                        <input v-model="form.password" type="password" class="form-control bg-card border-secondary text-foreground" placeholder="••••••••••••" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Sender Display Name</label>
                        <input v-model="form.senderName" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="InfiniNOC Alerts" />
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
                host: "smtp.infiniforge.com",
                port: 587,
                secure: false,
                username: "notifications@infiniforge.com",
                password: "",
                senderName: "InfiniNOC Alerts",
            },
            loading: true,
        };
    },
    mounted() {
        this.fetchSmtp();
    },
    methods: {
        fetchSmtp() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminSmtpSettings", (res) => {
                this.loading = false;
                if (res && res.ok && res.smtp) {
                    this.form = { ...res.smtp, password: "" };
                }
            });
        },
        saveSmtp() {
            this.$root.getSocket().emit("saveSuperAdminSmtpSettings", this.form, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("SMTP server settings saved.");
                    this.fetchSmtp();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to save SMTP settings.");
                }
            });
        },
    },
};
</script>
