<template>
    <div class="super-admin-coupons">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="ticket-alt" class="text-info" />
                    <span>Promotional Coupons & Discount Manager</span>
                </h3>
                <div class="text-muted small">
                    Create promotional discount codes for Indian tenant subscriptions with fixed Rupee (₹) or percentage discounts.
                </div>
            </div>
            <button class="btn btn-info fw-bold text-dark d-flex align-items-center gap-2" @click="showCreateModal = true">
                <font-awesome-icon icon="plus-circle" />
                <span>+ Create Coupon</span>
            </button>
        </div>

        <!-- Coupons Table -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0 text-foreground text-uppercase">Active Discount Codes ({{ coupons.length }})</h6>
                <span class="badge bg-secondary font-monospace">Promotional Engine</span>
            </div>
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary me-2" role="status"></div>
                    <span>Loading coupon list...</span>
                </div>

                <div v-else-if="coupons.length > 0" class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>COUPON CODE</th>
                                <th>DISCOUNT TYPE</th>
                                <th>VALUE</th>
                                <th>USAGE COUNT</th>
                                <th>MAX USES</th>
                                <th>STATUS</th>
                                <th>CREATED</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="c in coupons" :key="c.id">
                                <td class="fw-bold text-warning fs-6">{{ c.code }}</td>
                                <td class="text-uppercase small text-muted">{{ c.discount_type }}</td>
                                <td class="fw-bold text-success">
                                    {{ c.discount_type === 'percentage' ? c.value + '%' : '₹' + c.value.toLocaleString('en-IN') }}
                                </td>
                                <td>{{ c.current_uses || 0 }}</td>
                                <td>{{ c.max_uses || 100 }}</td>
                                <td>
                                    <span class="badge" :class="c.is_active ? 'bg-success' : 'bg-secondary'">
                                        {{ c.is_active ? 'ACTIVE' : 'INACTIVE' }}
                                    </span>
                                </td>
                                <td class="text-muted small">{{ c.created_at || 'N/A' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else class="text-center py-5 text-muted small">
                    No promotional discount codes created yet. Click "+ Create Coupon" above to create one.
                </div>
            </div>
        </div>

        <!-- Create Coupon Modal -->
        <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-info">Create Promotional Coupon Code</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Coupon Code</label>
                            <input v-model="createForm.code" type="text" class="form-control bg-card border-secondary text-foreground text-uppercase fw-bold" placeholder="e.g. DIWALI50" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Discount Type</label>
                            <select v-model="createForm.discountType" class="form-select bg-card border-secondary text-foreground">
                                <option value="percentage">Percentage (%) Discount</option>
                                <option value="fixed">Fixed Rupee (₹) Discount</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Discount Value</label>
                            <input v-model.number="createForm.value" type="number" class="form-control bg-card border-secondary text-foreground" placeholder="e.g. 50" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Maximum Redemptions</label>
                            <input v-model.number="createForm.maxUses" type="number" class="form-control bg-card border-secondary text-foreground" placeholder="100" />
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
                        <button class="btn btn-info fw-bold text-dark" @click="submitCreateCoupon">Save Coupon Code</button>
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
            coupons: [],
            loading: true,
            showCreateModal: false,
            createForm: {
                code: "",
                discountType: "percentage",
                value: 20,
                maxUses: 100,
            },
        };
    },
    mounted() {
        this.fetchCoupons();
    },
    methods: {
        fetchCoupons() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminCoupons", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.coupons = res.coupons || [];
                }
            });
        },
        submitCreateCoupon() {
            if (!this.createForm.code) {
                this.$root.toastError("Coupon code is required.");
                return;
            }

            this.$root.getSocket().emit("saveSuperAdminCoupon", this.createForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Coupon code '${this.createForm.code}' saved.`);
                    this.showCreateModal = false;
                    this.createForm = { code: "", discountType: "percentage", value: 20, maxUses: 100 };
                    this.fetchCoupons();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to save coupon.");
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
