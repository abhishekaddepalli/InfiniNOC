<template>
    <div class="super-admin-plans">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="tags" class="text-success" />
                    <span>SaaS Plans & Feature Entitlements</span>
                </h3>
                <div class="text-muted small">
                    Configure tier pricing, resource quota limits, and feature entitlement access matrix across all subscription plans.
                </div>
            </div>
        </div>

        <!-- Plan Grid & Builder -->
        <div class="row g-4">
            <!-- Active SaaS Plans Cards -->
            <div v-for="p in plans" :key="p.id" class="col-12 col-md-4">
                <div class="card bg-card border-secondary shadow-sm h-100 p-4 position-relative">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h4 class="fw-bold text-primary mb-0">{{ p.name }}</h4>
                        <span class="badge bg-success text-uppercase font-monospace">₹{{ (p.price_monthly || 0).toLocaleString('en-IN') }} / mo</span>
                    </div>
                    <p class="text-muted small mb-3">{{ p.description }}</p>

                    <div class="border-top border-secondary pt-3 font-monospace small mb-4">
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Yearly Price:</span>
                            <span class="fw-bold text-foreground">₹{{ (p.price_yearly || 0).toLocaleString('en-IN') }} / yr</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Trial Period:</span>
                            <span class="fw-bold text-warning">{{ p.trial_days }} Days</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Max Monitors:</span>
                            <span class="fw-bold text-foreground">{{ getParsedLimit(p, 'maxMonitors') }}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Max Network Devices:</span>
                            <span class="fw-bold text-foreground">{{ getParsedLimit(p, 'maxDevices') }}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span class="text-muted">Max Team Members:</span>
                            <span class="fw-bold text-foreground">{{ getParsedLimit(p, 'maxMembers') }}</span>
                        </div>
                    </div>

                    <div class="mt-auto">
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold" @click="editPlan(p)">
                            Edit Plan Entitlements
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Plan Editor Modal -->
        <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-primary">SaaS Plan Builder & Entitlements</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showEditModal = false"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="row g-4">
                            <!-- Left: Basic Details -->
                            <div class="col-12 col-md-6 border-end border-secondary">
                                <h6 class="fw-bold text-warning mb-3">Plan Metadata</h6>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Plan Name</label>
                                    <input v-model="editForm.name" type="text" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Description</label>
                                    <textarea v-model="editForm.description" class="form-control bg-card border-secondary text-foreground" rows="2"></textarea>
                                </div>
                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label small fw-semibold text-muted text-uppercase">Monthly (₹)</label>
                                        <input v-model.number="editForm.price_monthly" type="number" class="form-control bg-card border-secondary text-foreground" />
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label small fw-semibold text-muted text-uppercase">Yearly (₹)</label>
                                        <input v-model.number="editForm.price_yearly" type="number" class="form-control bg-card border-secondary text-foreground" />
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Trial Days</label>
                                    <input v-model.number="editForm.trial_days" type="number" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                            </div>

                            <!-- Right: Feature Quotas -->
                            <div class="col-12 col-md-6">
                                <h6 class="fw-bold text-success mb-3">Resource Quotas & Limits (-1 = Unlimited)</h6>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Max Monitors</label>
                                    <input v-model.number="editForm.limits.maxMonitors" type="number" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Max Network Devices</label>
                                    <input v-model.number="editForm.limits.maxDevices" type="number" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Max Team Members</label>
                                    <input v-model.number="editForm.limits.maxMembers" type="number" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-muted text-uppercase">Max Status Pages</label>
                                    <input v-model.number="editForm.limits.maxStatusPages" type="number" class="form-control bg-card border-secondary text-foreground" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
                        <button class="btn btn-primary fw-bold" @click="savePlan">Save Plan Changes</button>
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
            plans: [],
            loading: true,
            showEditModal: false,
            editForm: {
                id: null,
                name: "",
                slug: "",
                description: "",
                price_monthly: 0,
                price_yearly: 0,
                trial_days: 14,
                features: {},
                limits: { maxMonitors: 10, maxDevices: 10, maxMembers: 5, maxStatusPages: 2 },
            },
        };
    },
    mounted() {
        this.fetchPlans();
    },
    methods: {
        fetchPlans() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminPlans", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.plans = res.plans || [];
                }
            });
        },
        getParsedLimit(plan, key) {
            if (!plan || !plan.limits_json) {
                return "10";
            }
            try {
                const parsed = JSON.parse(plan.limits_json);
                const val = parsed[key];
                return val === -1 ? "Unlimited" : val;
            } catch (e) {
                return "10";
            }
        },
        editPlan(plan) {
            let limits = { maxMonitors: 10, maxDevices: 10, maxMembers: 5, maxStatusPages: 2 };
            try {
                if (plan.limits_json) {
                    limits = JSON.parse(plan.limits_json);
                }
            } catch (e) {}

            this.editForm = {
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                description: plan.description,
                price_monthly: plan.price_monthly,
                price_yearly: plan.price_yearly,
                trial_days: plan.trial_days,
                limits,
            };
            this.showEditModal = true;
        },
        savePlan() {
            this.$root.getSocket().emit("saveSuperAdminPlan", {
                ...this.editForm,
                limits_json: this.editForm.limits,
                features_json: { monitoring: true, snmp: true, tools: true },
            }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("SaaS plan updated.");
                    this.showEditModal = false;
                    this.fetchPlans();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to save plan.");
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
