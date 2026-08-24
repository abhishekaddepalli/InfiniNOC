<template>
    <div class="super-admin-gateways">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="credit-card" class="text-primary" />
                    <span>Indian Payment Gateways Configurator</span>
                </h3>
                <div class="text-muted small">
                    Configure first-class Razorpay, Cashfree, and Stripe payment gateways for instant Indian Rupee (₹) checkout.
                </div>
            </div>
        </div>

        <!-- Gateway Cards -->
        <div class="row g-4">
            <div v-for="g in gateways" :key="g.id" class="col-12 col-md-4">
                <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h4 class="fw-bold text-foreground mb-0 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="wallet" class="text-primary" />
                            <span>{{ g.gateway_name }}</span>
                        </h4>
                        <span class="badge" :class="g.is_enabled ? 'bg-success' : 'bg-secondary'">
                            {{ g.is_enabled ? 'ENABLED' : 'DISABLED' }}
                        </span>
                    </div>

                    <div class="border-top border-secondary pt-3 font-monospace small mb-4">
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Mode:</span>
                            <span class="fw-bold" :class="g.is_test_mode ? 'text-warning' : 'text-success'">
                                {{ g.is_test_mode ? 'TEST / SANDBOX' : 'LIVE PRODUCTION' }}
                            </span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Currency:</span>
                            <span class="fw-bold text-foreground">{{ g.currency || 'INR (₹)' }}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Key ID:</span>
                            <span class="text-truncate" style="max-width: 150px;">{{ g.key_id || 'Not Configured' }}</span>
                        </div>
                    </div>

                    <div class="mt-auto">
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold" @click="configureGateway(g)">
                            Configure {{ g.gateway_name }} Credentials
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Gateway Modal -->
        <div v-if="showConfigModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-primary">Configure {{ editForm.gatewayName }} Settings</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showConfigModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-check form-switch mb-3">
                            <input id="enableGateway" v-model="editForm.isEnabled" class="form-check-input" type="checkbox" />
                            <label class="form-check-input-label fw-bold" for="enableGateway">Enable {{ editForm.gatewayName }} Gateway</label>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input id="testMode" v-model="editForm.isTestMode" class="form-check-input" type="checkbox" />
                            <label class="form-check-input-label fw-bold text-warning" for="testMode">Sandbox / Test Mode Enabled</label>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Key ID / App ID</label>
                            <input v-model="editForm.keyId" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="rzp_test_..." />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Secret Key (Encrypted at Rest)</label>
                            <input v-model="editForm.secretKey" type="password" class="form-control bg-card border-secondary text-foreground" placeholder="••••••••••••" />
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showConfigModal = false">Cancel</button>
                        <button class="btn btn-primary fw-bold" @click="saveGateway">Save Gateway Credentials</button>
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
            gateways: [],
            loading: true,
            showConfigModal: false,
            editForm: {
                gatewayName: "",
                isEnabled: false,
                isTestMode: true,
                keyId: "",
                secretKey: "",
            },
        };
    },
    mounted() {
        this.fetchGateways();
    },
    methods: {
        fetchGateways() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminPaymentGateways", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.gateways = res.gateways || [];
                }
            });
        },
        configureGateway(g) {
            this.editForm = {
                gatewayName: g.gateway_name,
                isEnabled: Boolean(g.is_enabled),
                isTestMode: Boolean(g.is_test_mode),
                keyId: g.key_id || "",
                secretKey: g.secret_key_encrypted || "",
            };
            this.showConfigModal = true;
        },
        saveGateway() {
            this.$root.getSocket().emit("saveSuperAdminPaymentGateway", this.editForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`${this.editForm.gatewayName} gateway settings saved.`);
                    this.showConfigModal = false;
                    this.fetchGateways();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to save gateway.");
                }
            });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
