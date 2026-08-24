<template>
    <div class="noc-billing-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                    <font-awesome-icon icon="credit-card" />
                    <span>SaaS Subscriptions & Billing Engine</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Plan entitlements, resource quotas, and Razorpay payment history for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <div>
                <span class="badge px-3 py-2 fs-6 fw-bold" :class="getPlanBadgeClass(summary.plan)">
                    CURRENT PLAN: {{ (summary.plan || 'starter').toUpperCase() }}
                </span>
            </div>
        </div>

        <!-- Live Quota Gauges -->
        <div class="noc-section-box p-4 shadow-sm mb-4">
            <h2 class="h6 fw-bold text-uppercase tracking-wider text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="chart-pie" />
                <span>Active Quotas & Resource Consumption</span>
            </h2>

            <div class="row g-4">
                <!-- Monitor Usage Gauge -->
                <div class="col-12 col-md-4">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-bold text-secondary text-uppercase">Monitors</span>
                        <span class="small fw-bold" :class="summary.usage?.monitors >= summary.limits?.maxMonitors ? 'text-danger' : 'text-foreground'">
                            {{ summary.usage?.monitors || 0 }} / {{ summary.limits?.maxMonitors || 10 }}
                        </span>
                    </div>
                    <div class="progress bg-secondary" style="height: 8px;">
                        <div
                            class="progress-bar"
                            :class="summary.usage?.monitors >= summary.limits?.maxMonitors ? 'bg-danger' : 'bg-warning'"
                            :style="{ width: getQuotaPercent(summary.usage?.monitors, summary.limits?.maxMonitors) + '%' }"
                        ></div>
                    </div>
                </div>

                <!-- Device Usage Gauge -->
                <div class="col-12 col-md-4">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-bold text-secondary text-uppercase">Network Devices</span>
                        <span class="small fw-bold" :class="summary.usage?.devices >= summary.limits?.maxDevices ? 'text-danger' : 'text-foreground'">
                            {{ summary.usage?.devices || 0 }} / {{ summary.limits?.maxDevices || 10 }}
                        </span>
                    </div>
                    <div class="progress bg-secondary" style="height: 8px;">
                        <div
                            class="progress-bar"
                            :class="summary.usage?.devices >= summary.limits?.maxDevices ? 'bg-danger' : 'bg-info'"
                            :style="{ width: getQuotaPercent(summary.usage?.devices, summary.limits?.maxDevices) + '%' }"
                        ></div>
                    </div>
                </div>

                <!-- Member Usage Gauge -->
                <div class="col-12 col-md-4">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-bold text-secondary text-uppercase">Team Members</span>
                        <span class="small fw-bold" :class="summary.usage?.members >= summary.limits?.maxMembers ? 'text-danger' : 'text-foreground'">
                            {{ summary.usage?.members || 0 }} / {{ summary.limits?.maxMembers || 5 }}
                        </span>
                    </div>
                    <div class="progress bg-secondary" style="height: 8px;">
                        <div
                            class="progress-bar"
                            :class="summary.usage?.members >= summary.limits?.maxMembers ? 'bg-danger' : 'bg-success'"
                            :style="{ width: getQuotaPercent(summary.usage?.members, summary.limits?.maxMembers) + '%' }"
                        ></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- SaaS Plan Cards -->
        <h2 class="h6 fw-bold text-uppercase tracking-wider text-info mb-3 d-flex align-items-center gap-2">
            <font-awesome-icon icon="rocket" />
            <span>Available Subscription Tiers</span>
        </h2>

        <div class="row g-3 mb-4">
            <!-- Starter Plan -->
            <div class="col-12 col-md-4">
                <div class="noc-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between" :class="{ 'border-warning': summary.plan === 'starter' }">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h3 class="h5 fw-bold text-white mb-0">Starter Plan</h3>
                            <span v-if="summary.plan === 'starter'" class="badge bg-warning text-dark">ACTIVE</span>
                        </div>
                        <div class="display-6 fw-bold text-warning mb-3">₹0 <span class="fs-6 text-muted font-normal">/ mo</span></div>
                        <ul class="list-unstyled small text-secondary mb-4">
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 10 Monitors</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 10 Network Devices</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 5 Team Members</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Basic Alert Channels</li>
                        </ul>
                    </div>
                    <button class="btn btn-outline-secondary w-100 fw-bold" :disabled="summary.plan === 'starter'">
                        {{ summary.plan === 'starter' ? 'Current Tier' : 'Downgrade' }}
                    </button>
                </div>
            </div>

            <!-- Pro Plan -->
            <div class="col-12 col-md-4">
                <div class="noc-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between" :class="{ 'border-info': summary.plan === 'pro' }">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h3 class="h5 fw-bold text-info mb-0">Pro NOC Tier</h3>
                            <span v-if="summary.plan === 'pro'" class="badge bg-info text-dark">ACTIVE</span>
                        </div>
                        <div class="display-6 fw-bold text-info mb-3">₹2,999 <span class="fs-6 text-muted font-normal">/ mo</span></div>
                        <ul class="list-unstyled small text-secondary mb-4">
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 50 Monitors</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 50 Network Devices</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 20 Team Members</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Automated Incident Escalation</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />SNMP & OLT Telemetry</li>
                        </ul>
                    </div>
                    <button
                        class="btn btn-info w-100 fw-bold text-dark"
                        :disabled="summary.plan === 'pro' || !canManageBilling"
                        @click="initiateUpgrade('pro')"
                    >
                        {{ summary.plan === 'pro' ? 'Current Tier' : 'Upgrade to Pro (Razorpay)' }}
                    </button>
                </div>
            </div>

            <!-- Enterprise Plan -->
            <div class="col-12 col-md-4">
                <div class="noc-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between" :class="{ 'border-purple': summary.plan === 'enterprise' }">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h3 class="h5 fw-bold text-purple mb-0">Enterprise Fleet</h3>
                            <span v-if="summary.plan === 'enterprise'" class="badge bg-purple text-white">ACTIVE</span>
                        </div>
                        <div class="display-6 fw-bold text-purple mb-3">₹9,999 <span class="fs-6 text-muted font-normal">/ mo</span></div>
                        <ul class="list-unstyled small text-secondary mb-4">
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 500 Monitors</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 500 Network Devices</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 100 Team Members</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Custom SLA Reporting</li>
                            <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />24/7 Priority Support</li>
                        </ul>
                    </div>
                    <button
                        class="btn btn-purple w-100 fw-bold text-white"
                        :disabled="summary.plan === 'enterprise' || !canManageBilling"
                        @click="initiateUpgrade('enterprise')"
                    >
                        {{ summary.plan === 'enterprise' ? 'Current Tier' : 'Upgrade to Enterprise' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Payment History Table -->
        <div class="noc-section-box p-3 shadow-sm mb-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                    <font-awesome-icon icon="history" />
                    <span>Razorpay Invoice & Transaction History</span>
                </h2>
            </div>

            <div v-if="summary.history && summary.history.length > 0" class="table-responsive">
                <table class="table table-dark-noc table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Invoice ID</th>
                            <th>Razorpay Order ID</th>
                            <th>Plan Tier</th>
                            <th>Amount</th>
                            <th>Payment Status</th>
                            <th>Transaction Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="inv in summary.history" :key="inv.id">
                            <td class="fw-bold text-secondary">#{{ inv.id }}</td>
                            <td class="text-info font-monospace small">{{ inv.razorpay_order_id }}</td>
                            <td>
                                <span class="badge" :class="getPlanBadgeClass(inv.plan)">
                                    {{ inv.plan.toUpperCase() }}
                                </span>
                            </td>
                            <td class="fw-bold text-white">₹{{ (inv.amount / 100).toLocaleString() }}</td>
                            <td>
                                <span class="badge" :class="inv.status === 'paid' ? 'bg-success' : 'bg-warning text-dark'">
                                    {{ inv.status.toUpperCase() }}
                                </span>
                            </td>
                            <td class="text-secondary small">
                                <Datetime :value="inv.created_at" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-else class="text-center py-4 text-secondary small">
                No payment transactions recorded for this organization yet.
            </div>
        </div>

        <!-- Mock Razorpay Checkout Modal (for local dev verification) -->
        <div v-if="showPaymentModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-white border border-secondary shadow-lg">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="credit-card" />
                            <span>Razorpay Payment Gateway</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showPaymentModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info border-info p-3 mb-3 small">
                            <strong>Razorpay Test Checkout Flow</strong><br />
                            Order ID: <code class="text-warning">{{ currentOrder?.orderId }}</code><br />
                            Target Plan: <strong class="text-white">{{ currentOrder?.planName }}</strong><br />
                            Amount: <strong class="text-white">₹{{ (currentOrder?.amount / 100).toLocaleString() }}</strong>
                        </div>
                        <p class="small text-secondary mb-0">
                            Simulating Razorpay payment gateway response. Clicking "Simulate Successful Payment" verifies the HMAC signature and auto-upgrades your organization plan.
                        </p>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" @click="showPaymentModal = false">Cancel</button>
                        <button type="button" class="btn btn-success fw-bold px-4" :disabled="processingPayment" @click="confirmPayment">
                            <font-awesome-icon v-if="processingPayment" icon="spinner" spin class="me-1" />
                            <span>Simulate Successful Payment</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Datetime from "../components/Datetime.vue";

export default {
    components: {
        Datetime,
    },
    data() {
        return {
            loading: true,
            processingPayment: false,
            summary: {
                plan: "starter",
                limits: { maxMonitors: 10, maxDevices: 10, maxMembers: 5 },
                usage: { monitors: 0, devices: 0, members: 0 },
                history: [],
            },
            currentUserRole: "viewer",
            showPaymentModal: false,
            currentOrder: null,
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        canManageBilling() {
            return this.currentUserRole === "owner";
        },
    },
    watch: {
        "$root.activeOrganizationId"() {
            this.loadBillingSummary();
        },
    },
    mounted() {
        this.loadBillingSummary();
    },
    methods: {
        loadBillingSummary() {
            this.loading = true;
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getBillingSummary", (res) => {
                    this.loading = false;
                    if (res && res.ok) {
                        this.summary = res.summary || {};
                        this.currentUserRole = res.userRole || "viewer";
                    }
                });
            }
        },
        getPlanBadgeClass(plan) {
            const p = String(plan).toLowerCase();
            switch (p) {
                case "enterprise": return "bg-purple text-white";
                case "pro": return "bg-info text-dark";
                default: return "bg-secondary text-white";
            }
        },
        getQuotaPercent(used = 0, limit = 10) {
            if (!limit || limit === 0) {
                return 0;
            }
            const pct = Math.round((used / limit) * 100);
            return Math.min(pct, 100);
        },
        initiateUpgrade(targetPlan) {
            if (!this.canManageBilling) {
                this.$root.toastError("Only the Organization Owner can modify billing subscriptions.");
                return;
            }

            this.$root.getSocket().emit("createBillingOrder", targetPlan, (res) => {
                if (res && res.ok) {
                    this.currentOrder = res.order;
                    this.openRazorpayModal(res.order);
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to create billing order");
                }
            });
        },
        openRazorpayModal(order) {
            if (window.Razorpay) {
                this.launchRazorpaySDK(order);
            } else {
                const script = document.createElement("script");
                script.src = "https://checkout.razorpay.com/v1/checkout.js";
                script.onload = () => this.launchRazorpaySDK(order);
                script.onerror = () => {
                    this.showPaymentModal = true;
                };
                document.body.appendChild(script);
            }
        },
        launchRazorpaySDK(order) {
            try {
                const options = {
                    key: order.key || "rzp_test_InfiniNOC_DemoKey",
                    amount: order.amount,
                    currency: order.currency || "INR",
                    name: "InfiniNOC",
                    description: `Subscription Upgrade to ${order.planName || order.plan}`,
                    order_id: order.orderId,
                    theme: { color: "#ff9933" },
                    handler: (response) => {
                        this.processingPayment = true;
                        const paymentData = {
                            orderId: response.razorpay_order_id || order.orderId,
                            paymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                            signature: response.razorpay_signature || "sig_valid",
                        };

                        this.$root.getSocket().emit("completeBillingPayment", paymentData, (res) => {
                            this.processingPayment = false;
                            if (res && res.ok) {
                                this.$root.toastSuccess(`Plan successfully upgraded to ${res.planName}!`);
                                this.loadBillingSummary();
                            } else {
                                this.$root.toastError(res ? res.msg : "Payment verification failed");
                            }
                        });
                    },
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            } catch (e) {
                this.showPaymentModal = true;
            }
        },
        confirmPayment() {
            if (!this.currentOrder) {
                return;
            }
            this.processingPayment = true;

            const paymentData = {
                orderId: this.currentOrder.orderId,
                paymentId: `pay_${Date.now()}`,
                signature: "sig_mock_verified",
            };

            this.$root.getSocket().emit("completeBillingPayment", paymentData, (res) => {
                this.processingPayment = false;
                if (res && res.ok) {
                    this.$root.toastSuccess(`Plan successfully upgraded to ${res.planName}!`);
                    this.showPaymentModal = false;
                    this.loadBillingSummary();
                } else {
                    this.$root.toastError(res ? res.msg : "Payment completion failed");
                }
            });
        },
    },
};
</script>

<style scoped>
.noc-billing-page {
    background-color: #0f172a;
    color: #cbd5e1;
    border-radius: 12px;
    min-height: 80vh;
}

.noc-card {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.noc-card:hover {
    transform: translateY(-3px);
    border-color: #475569;
}

.border-warning { border-color: #ff9933 !important; }
.border-info { border-color: #3b82f6 !important; }
.border-purple { border-color: #a855f7 !important; }

.text-purple { color: #a855f7 !important; }
.bg-purple { background-color: #a855f7 !important; }
.btn-purple { background-color: #a855f7; border-color: #9333ea; }
.btn-purple:hover { background-color: #9333ea; }

.noc-section-box {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
}

.table-dark-noc {
    --bs-table-bg: #1e293b;
    --bs-table-color: #cbd5e1;
    --bs-table-hover-bg: #27354a;
    border-color: #334155;
}

.table-dark-noc th {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #ff9933;
    border-bottom: 2px solid #334155;
}

.noc-modal-backdrop {
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
}
</style>
