<template>
    <div class="noc-superadmin-page p-3 p-md-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 d-flex align-items-center gap-2" style="color: #a855f7;">
                    <font-awesome-icon icon="user-shield" />
                    <span>Super Admin & SaaS Control Plane</span>
                </h1>
                <p class="text-secondary small mb-0">
                    Global multi-tenant governance, plan entitlements, organization overrides, and platform audit trail
                </p>
            </div>

            <div>
                <span class="badge bg-purple-dark text-purple border border-purple px-3 py-2 fw-bold">
                    <font-awesome-icon icon="lock" class="me-1" />
                    SUPER ADMIN ACCESS ONLY
                </span>
            </div>
        </div>

        <!-- Access Denied Alert if not Super Admin -->
        <div v-if="accessDenied" class="alert alert-danger shadow-sm border border-danger p-4 rounded text-center my-4">
            <font-awesome-icon icon="exclamation-triangle" class="fs-1 text-danger mb-2" />
            <h4 class="fw-bold">Access Denied</h4>
            <p class="mb-0">You do not have Super Admin permissions to access the platform control plane.</p>
        </div>

        <div v-else>
            <!-- 5 KPI Telemetry Cards -->
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-2-4">
                    <div class="noc-card p-3 shadow-sm border-left-purple">
                        <div class="noc-card-title mb-1">Tenants (Orgs)</div>
                        <div class="noc-card-value text-purple">{{ overview.totalOrganizations || 0 }}</div>
                    </div>
                </div>
                <div class="col-6 col-md-2-4">
                    <div class="noc-card p-3 shadow-sm border-left-info">
                        <div class="noc-card-title mb-1">Registered Users</div>
                        <div class="noc-card-value text-info">{{ overview.totalUsers || 0 }}</div>
                    </div>
                </div>
                <div class="col-6 col-md-2-4">
                    <div class="noc-card p-3 shadow-sm border-left-success">
                        <div class="noc-card-title mb-1">Active Monitors</div>
                        <div class="noc-card-value text-success">{{ overview.totalMonitors || 0 }}</div>
                    </div>
                </div>
                <div class="col-6 col-md-2-4">
                    <div class="noc-card p-3 shadow-sm border-left-amber">
                        <div class="noc-card-title mb-1">Network Devices</div>
                        <div class="noc-card-value text-amber">{{ overview.totalDevices || 0 }}</div>
                    </div>
                </div>
                <div class="col-6 col-md-2-4">
                    <div class="noc-card p-3 shadow-sm border-left-danger">
                        <div class="noc-card-title mb-1">Global Incidents</div>
                        <div class="noc-card-value text-danger">{{ overview.totalIncidents || 0 }}</div>
                    </div>
                </div>
            </div>

            <!-- Tab Navigation -->
            <ul class="nav nav-tabs border-secondary mb-4">
                <li class="nav-item">
                    <button
                        class="nav-link fw-bold"
                        :class="{ active: activeTab === 'orgs' }"
                        @click="activeTab = 'orgs'"
                    >
                        <font-awesome-icon icon="building" class="me-2" />
                        Organizations & SaaS Plans ({{ organizations.length }})
                    </button>
                </li>
                <li class="nav-item">
                    <button
                        class="nav-link fw-bold"
                        :class="{ active: activeTab === 'users' }"
                        @click="activeTab = 'users'"
                    >
                        <font-awesome-icon icon="users" class="me-2" />
                        System Users ({{ users.length }})
                    </button>
                </li>
                <li class="nav-item">
                    <button
                        class="nav-link fw-bold"
                        :class="{ active: activeTab === 'audit' }"
                        @click="activeTab = 'audit'"
                    >
                        <font-awesome-icon icon="history" class="me-2" />
                        Platform Audit Logs
                    </button>
                </li>
            </ul>

            <!-- Tab 1: Organizations & SaaS Plans -->
            <div v-if="activeTab === 'orgs'" class="noc-section-box p-3 shadow-sm mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-purple d-flex align-items-center gap-2">
                        <font-awesome-icon icon="building" />
                        <span>Tenant Governance & Resource Limits</span>
                    </h2>
                    <button class="btn btn-purple btn-sm fw-bold text-white px-3" @click="showCreateOrgModal = true">
                        <font-awesome-icon icon="plus-circle" class="me-1" />
                        Create Organization
                    </button>
                </div>

                <div v-if="loading" class="text-center py-4 text-secondary">
                    <font-awesome-icon icon="spinner" spin class="fs-4 me-2" />
                    Loading tenants...
                </div>

                <div v-else-if="organizations.length > 0" class="table-responsive">
                    <table class="table table-dark-noc table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Org ID</th>
                                <th>Organization Name</th>
                                <th>Slug</th>
                                <th>Active SaaS Plan</th>
                                <th>Monitors (Used / Limit)</th>
                                <th>Devices (Used / Limit)</th>
                                <th>Members</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="org in organizations" :key="org.id">
                                <td class="fw-bold text-secondary">#{{ org.id }}</td>
                                <td class="fw-bold text-white">{{ org.name }}</td>
                                <td class="text-secondary small">/{{ org.slug }}</td>
                                <td>
                                    <span class="badge" :class="getPlanBadgeClass(org.plan)">
                                        {{ (org.plan || 'starter').toUpperCase() }}
                                    </span>
                                </td>
                                <td>
                                    <span :class="org.monitor_count >= org.max_monitors ? 'text-danger fw-bold' : 'text-secondary'">
                                        {{ org.monitor_count }} / {{ org.max_monitors }}
                                    </span>
                                </td>
                                <td>
                                    <span :class="org.device_count >= org.max_devices ? 'text-danger fw-bold' : 'text-secondary'">
                                        {{ org.device_count }} / {{ org.max_devices }}
                                    </span>
                                </td>
                                <td class="text-secondary">{{ org.member_count }}</td>
                                <td>
                                    <span class="badge" :class="org.status === 'suspended' ? 'bg-danger' : 'bg-success'">
                                        {{ (org.status || 'active').toUpperCase() }}
                                    </span>
                                </td>
                                <td class="text-end">
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-purple btn-xs" @click="openPlanModal(org)">
                                            <font-awesome-icon icon="cog" class="me-1" />
                                            Plan & Limits
                                        </button>
                                        <button
                                            v-if="org.status !== 'suspended'"
                                            class="btn btn-outline-danger btn-xs"
                                            @click="toggleOrgStatus(org, 'suspended')"
                                        >
                                            Suspend
                                        </button>
                                        <button
                                            v-else
                                            class="btn btn-outline-success btn-xs"
                                            @click="toggleOrgStatus(org, 'active')"
                                        >
                                            Activate
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tab 2: System Users -->
            <div v-if="activeTab === 'users'" class="noc-section-box p-3 shadow-sm mb-4">
                <div class="table-responsive">
                    <table class="table table-dark-noc table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Super Admin Privilege</th>
                                <th>Tenant Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="u in users" :key="u.id">
                                <td class="fw-bold text-secondary">#{{ u.id }}</td>
                                <td class="fw-bold text-white">{{ u.username }}</td>
                                <td class="text-secondary small">{{ u.email || 'N/A' }}</td>
                                <td>
                                    <span v-if="u.is_super_admin" class="badge bg-purple text-white">SUPER ADMIN</span>
                                    <span v-else class="badge bg-secondary text-muted">Standard User</span>
                                </td>
                                <td class="text-secondary">{{ u.org_count }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tab 3: System Audit Logs -->
            <div v-if="activeTab === 'audit'" class="noc-section-box p-3 shadow-sm mb-4">
                <div class="table-responsive">
                    <table class="table table-dark-noc table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Log ID</th>
                                <th>Organization</th>
                                <th>User</th>
                                <th>Event</th>
                                <th>Details</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="log in auditLogs" :key="log.id">
                                <td class="fw-bold text-secondary">#{{ log.id }}</td>
                                <td class="text-info font-monospace small">{{ log.org_name || 'Global' }}</td>
                                <td class="text-white fw-bold">{{ log.username || 'System' }}</td>
                                <td><span class="badge bg-secondary text-white">{{ log.event }}</span></td>
                                <td class="text-secondary small font-monospace">{{ log.details }}</td>
                                <td class="text-muted small">
                                    <Datetime :value="log.created_at" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal: Modify Organization Plan & Limits -->
        <div v-if="showPlanModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-white border border-secondary shadow-lg">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-purple d-flex align-items-center gap-2">
                            <font-awesome-icon icon="cog" />
                            <span>Modify SaaS Plan & Resource Limits</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showPlanModal = false"></button>
                    </div>
                    <form @submit.prevent="submitPlanUpdate">
                        <div class="modal-body">
                            <p class="small text-secondary mb-3">
                                Updating plan entitlements for tenant <strong class="text-white">{{ targetOrg?.name }}</strong> (#{{ targetOrg?.id }}).
                            </p>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-secondary text-uppercase">Target SaaS Tier</label>
                                <select v-model="planForm.plan" class="form-select bg-secondary text-white border-dark" @change="onPlanChange">
                                    <option value="starter">STARTER (10 Monitors, 10 Devices, 5 Members)</option>
                                    <option value="pro">PRO (50 Monitors, 50 Devices, 20 Members)</option>
                                    <option value="enterprise">ENTERPRISE (500 Monitors, 500 Devices, 100 Members)</option>
                                </select>
                            </div>

                            <div class="row g-2 mb-3">
                                <div class="col-4">
                                    <label class="form-label small fw-bold text-secondary">Max Monitors</label>
                                    <input v-model.number="planForm.customLimits.maxMonitors" type="number" class="form-control bg-secondary text-white border-dark" min="1" required />
                                </div>
                                <div class="col-4">
                                    <label class="form-label small fw-bold text-secondary">Max Devices</label>
                                    <input v-model.number="planForm.customLimits.maxDevices" type="number" class="form-control bg-secondary text-white border-dark" min="1" required />
                                </div>
                                <div class="col-4">
                                    <label class="form-label small fw-bold text-secondary">Max Members</label>
                                    <input v-model.number="planForm.customLimits.maxMembers" type="number" class="form-control bg-secondary text-white border-dark" min="1" required />
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" @click="showPlanModal = false">Cancel</button>
                            <button type="submit" class="btn btn-purple fw-bold text-white" :disabled="submitting">
                                Update Plan
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal: Create Organization & Dedicated Tenant Admin -->
        <div v-if="showCreateOrgModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-secondary shadow-lg">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-purple d-flex align-items-center gap-2">
                            <font-awesome-icon icon="building" />
                            <span>Create Organization & Dedicated Admin</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateOrgModal = false" />
                    </div>
                    <form @submit.prevent="submitCreateOrg">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Organization Name</label>
                                <input v-model="createOrgForm.name" type="text" class="form-control" placeholder="e.g. Acme Network Services" required @input="autoSlug" />
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Organization Slug</label>
                                <input v-model="createOrgForm.slug" type="text" class="form-control" placeholder="e.g. acme-network" required />
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">SaaS Tier Plan</label>
                                <select v-model="createOrgForm.plan" class="form-select">
                                    <option value="starter">Starter Tier (10 Monitors, 10 Devices, 5 Members)</option>
                                    <option value="pro">Pro NOC Tier (50 Monitors, 50 Devices, 20 Members)</option>
                                    <option value="enterprise">Enterprise Fleet (500 Monitors, 500 Devices, 100 Members)</option>
                                </select>
                            </div>
                            <hr class="border-secondary my-3" />
                            <h6 class="fw-bold text-info small text-uppercase tracking-wider">Dedicated Tenant Admin Credentials</h6>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Admin Username</label>
                                <input v-model="createOrgForm.adminUsername" type="text" class="form-control" placeholder="e.g. acme_admin" required />
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Admin Password</label>
                                <input v-model="createOrgForm.adminPassword" type="password" class="form-control" placeholder="Initial Password for Admin Login" required />
                            </div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" @click="showCreateOrgModal = false">Cancel</button>
                            <button type="submit" class="btn btn-purple fw-bold text-white" :disabled="submitting">
                                <font-awesome-icon icon="check" class="me-1" />
                                Create Tenant & Admin
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Datetime from "../components/Datetime.vue";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Datetime,
    },
    data() {
        return {
            loading: true,
            submitting: false,
            accessDenied: false,
            activeTab: "orgs",
            overview: {},
            organizations: [],
            users: [],
            auditLogs: [],
            showPlanModal: false,
            showCreateOrgModal: false,
            targetOrg: null,
            planForm: {
                plan: "starter",
                customLimits: {
                    maxMonitors: 10,
                    maxDevices: 10,
                    maxMembers: 5,
                },
            },
            createOrgForm: {
                name: "",
                slug: "",
                plan: "starter",
                adminUsername: "",
                adminPassword: "",
            },
        };
    },
    mounted() {
        this.loadSuperAdminData();
    },
    methods: {
        loadSuperAdminData() {
            this.loading = true;
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getSuperAdminOverview", (res) => {
                    this.loading = false;
                    if (res && res.ok) {
                        this.overview = res.overview || {};
                    } else {
                        this.accessDenied = true;
                    }
                });
                this.$root.getSocket().emit("getSuperAdminOrganizations", (res) => {
                    if (res && res.ok) {
                        this.organizations = res.organizations || [];
                    }
                });
                this.$root.getSocket().emit("getSuperAdminUsers", (res) => {
                    if (res && res.ok) {
                        this.users = res.users || [];
                    }
                });
                this.$root.getSocket().emit("getSuperAdminAuditLogs", (res) => {
                    if (res && res.ok) {
                        this.auditLogs = res.logs || [];
                    }
                });
            }
        },
        getPlanBadgeClass(plan) {
            const p = String(plan).toLowerCase();
            switch (p) {
                case "enterprise": return "bg-purple text-white fw-bold";
                case "pro": return "bg-info text-dark fw-bold";
                default: return "bg-secondary text-white";
            }
        },
        openPlanModal(org) {
            this.targetOrg = org;
            this.planForm.plan = org.plan || "starter";
            this.planForm.customLimits.maxMonitors = org.max_monitors || 10;
            this.planForm.customLimits.maxDevices = org.max_devices || 10;
            this.planForm.customLimits.maxMembers = org.max_members || 5;
            this.showPlanModal = true;
        },
        onPlanChange() {
            if (this.planForm.plan === "pro") {
                this.planForm.customLimits.maxMonitors = 50;
                this.planForm.customLimits.maxDevices = 50;
                this.planForm.customLimits.maxMembers = 20;
            } else if (this.planForm.plan === "enterprise") {
                this.planForm.customLimits.maxMonitors = 500;
                this.planForm.customLimits.maxDevices = 500;
                this.planForm.customLimits.maxMembers = 100;
            } else {
                this.planForm.customLimits.maxMonitors = 10;
                this.planForm.customLimits.maxDevices = 10;
                this.planForm.customLimits.maxMembers = 5;
            }
        },
        submitPlanUpdate() {
            if (!this.targetOrg) {
                return;
            }
            this.submitting = true;
            this.$root.getSocket().emit("updateSuperAdminOrgPlan", {
                orgId: this.targetOrg.id,
                plan: this.planForm.plan,
                customLimits: this.planForm.customLimits,
            }, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    this.$root.toastSuccess(`Plan updated for ${this.targetOrg.name}`);
                    this.showPlanModal = false;
                    this.loadSuperAdminData();
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to update plan");
                }
            });
        },
        autoSlug() {
            if (this.createOrgForm.name) {
                this.createOrgForm.slug = String(this.createOrgForm.name)
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-");
            }
        },
        submitCreateOrg() {
            this.submitting = true;
            this.$root.getSocket().emit("createOrganizationWithAdmin", this.createOrgForm, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    toast.success(`Organization '${this.createOrgForm.name}' created with admin username '${this.createOrgForm.adminUsername}'!`);
                    this.showCreateOrgModal = false;
                    this.createOrgForm = {
                        name: "",
                        slug: "",
                        plan: "starter",
                        adminUsername: "",
                        adminPassword: "",
                    };
                    this.loadSuperAdminData();
                } else {
                    toast.error(res ? res.msg : "Failed to create organization");
                }
            });
        },
        toggleOrgStatus(org, newStatus) {
            if (confirm(`Are you sure you want to set ${org.name} status to ${newStatus}?`)) {
                this.$root.getSocket().emit("toggleSuperAdminOrgStatus", { orgId: org.id, status: newStatus }, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Organization ${org.name} set to ${newStatus}`);
                        this.loadSuperAdminData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to change organization status");
                    }
                });
            }
        },
    },
};
</script>

<style scoped>
.noc-superadmin-page {
    background-color: #0f172a;
    color: #cbd5e1;
    border-radius: 12px;
    min-height: 80vh;
}

.noc-card {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    height: 100%;
}

.border-left-purple { border-left: 4px solid #a855f7; }
.border-left-info { border-left: 4px solid #3b82f6; }
.border-left-success { border-left: 4px solid #2ecc71; }
.border-left-amber { border-left: 4px solid #ff9933; }
.border-left-danger { border-left: 4px solid #dc2626; }

.text-purple { color: #a855f7 !important; }
.text-amber { color: #ff9933 !important; }

.bg-purple { background-color: #a855f7 !important; }
.bg-purple-dark { background-color: rgba(168, 85, 247, 0.15) !important; }
.border-purple { border-color: #a855f7 !important; }
.btn-purple { background-color: #a855f7; border-color: #9333ea; }
.btn-purple:hover { background-color: #9333ea; }
.btn-outline-purple { color: #a855f7; border-color: #a855f7; }
.btn-outline-purple:hover { background-color: #a855f7; color: #ffffff; }

.col-md-2-4 {
    flex: 0 0 auto;
    width: 20%;
}

@media (max-width: 768px) {
    .col-md-2-4 {
        width: 50%;
    }
}

.noc-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
}

.noc-card-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
}

.noc-section-box {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
}

.nav-tabs .nav-link {
    color: #94a3b8;
    background: transparent;
    border: 1px solid transparent;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

.nav-tabs .nav-link.active {
    color: #a855f7;
    background-color: #1e293b;
    border-color: #334155 #334155 #1e293b;
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
    color: #a855f7;
    border-bottom: 2px solid #334155;
}

.noc-modal-backdrop {
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
}
</style>
