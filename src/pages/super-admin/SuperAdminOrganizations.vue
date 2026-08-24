<template>
    <div class="super-admin-organizations">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="building" class="text-warning" />
                    <span>Organization Management</span>
                </h3>
                <div class="text-muted small">
                    View all multi-tenant customer organizations, manage plans, suspend accounts, or securely impersonate.
                </div>
            </div>
            <button class="btn btn-warning fw-bold d-flex align-items-center gap-2" @click="showCreateModal = true">
                <font-awesome-icon icon="plus-circle" />
                <span>+ Create Organization</span>
            </button>
        </div>

        <!-- Organizations Table -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0 text-foreground text-uppercase">Registered Organizations ({{ organizations.length }})</h6>
                <span class="badge bg-secondary font-monospace">Real Database Telemetry</span>
            </div>
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary me-2" role="status"></div>
                    <span>Loading organization dataset...</span>
                </div>

                <div v-else-if="organizations.length > 0" class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>ORGANIZATION</th>
                                <th>SLUG</th>
                                <th>OWNER EMAIL</th>
                                <th>SAAS PLAN</th>
                                <th>STATUS</th>
                                <th>USERS</th>
                                <th>MONITORS</th>
                                <th>DEVICES</th>
                                <th>CREATED</th>
                                <th class="text-end">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="o in organizations" :key="o.id">
                                <td>
                                    <div class="fw-bold text-foreground">{{ o.name }}</div>
                                    <div class="small text-muted opacity-75">ID: #{{ o.id }}</div>
                                </td>
                                <td class="text-warning fw-semibold">{{ o.slug }}</td>
                                <td class="text-muted small">{{ o.owner_email || 'admin@company.com' }}</td>
                                <td>
                                    <span class="badge text-uppercase" :class="getPlanBadgeClass(o.plan)">
                                        {{ o.plan || 'starter' }}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge" :class="o.status === 'suspended' ? 'bg-danger text-white' : 'bg-success text-white'">
                                        {{ (o.status || 'active').toUpperCase() }}
                                    </span>
                                </td>
                                <td>{{ o.member_count || 1 }} / {{ o.max_members || 5 }}</td>
                                <td>{{ o.monitor_count || 0 }} / {{ o.max_monitors || 10 }}</td>
                                <td>{{ o.device_count || 0 }} / {{ o.max_devices || 10 }}</td>
                                <td class="text-muted small">{{ o.created_at || 'N/A' }}</td>
                                <td class="text-end">
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-warning fw-bold" title="Impersonate Organization" @click="impersonateOrg(o)">
                                            Impersonate
                                        </button>
                                        <button
                                            v-if="o.status !== 'suspended'"
                                            class="btn btn-outline-danger"
                                            @click="toggleStatus(o.id, 'suspended')"
                                        >
                                            Suspend
                                        </button>
                                        <button
                                            v-else
                                            class="btn btn-outline-success"
                                            @click="toggleStatus(o.id, 'active')"
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
        </div>

        <!-- Create Organization Modal -->
        <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="building" />
                            <span>Create New Tenant Organization</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Organization Name</label>
                            <input v-model="createForm.name" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="e.g. Apex Telecom ISP" @input="generateSlug" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Slug</label>
                            <input v-model="createForm.slug" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="apex-telecom" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Owner Username</label>
                            <input v-model="createForm.adminUsername" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="apex_admin" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Owner Email</label>
                            <input v-model="createForm.adminEmail" type="email" class="form-control bg-card border-secondary text-foreground" placeholder="admin@apextelecom.com" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Owner Password</label>
                            <input v-model="createForm.adminPassword" type="password" class="form-control bg-card border-secondary text-foreground" placeholder="••••••••••••" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Target SaaS Plan</label>
                            <select v-model="createForm.plan" class="form-select bg-card border-secondary text-foreground">
                                <option value="starter">Starter Tier (10 Monitors, 10 Devices)</option>
                                <option value="pro">Professional NOC (50 Monitors, 50 Devices)</option>
                                <option value="enterprise">Enterprise Multi-Tenant (500 Monitors, 500 Devices)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
                        <button class="btn btn-warning fw-bold" @click="submitCreateOrg">Create Organization</button>
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
            organizations: [],
            loading: true,
            showCreateModal: false,
            createForm: {
                name: "",
                slug: "",
                adminUsername: "",
                adminEmail: "",
                adminPassword: "",
                plan: "starter",
            },
        };
    },
    mounted() {
        this.fetchOrganizations();
    },
    methods: {
        fetchOrganizations() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminOrganizations", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.organizations = res.organizations || [];
                }
            });
        },
        generateSlug() {
            this.createForm.slug = this.createForm.name
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-");
        },
        submitCreateOrg() {
            if (!this.createForm.name || !this.createForm.slug || !this.createForm.adminUsername || !this.createForm.adminPassword) {
                this.$root.toastError("Please fill in all required organization and owner fields.");
                return;
            }

            this.$root.getSocket().emit("createOrganizationWithAdmin", this.createForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Organization '${this.createForm.name}' created successfully.`);
                    this.showCreateModal = false;
                    this.createForm = { name: "", slug: "", adminUsername: "", adminEmail: "", adminPassword: "", plan: "starter" };
                    this.fetchOrganizations();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to create organization.");
                }
            });
        },
        impersonateOrg(org) {
            if (!confirm(`Are you sure you want to impersonate organization '${org.name}'? All admin actions will be audited.`)) {
                return;
            }

            this.$root.getSocket().emit("impersonateOrganization", { orgId: org.id, reason: "Super Admin Support Session" }, (res) => {
                if (res && res.ok) {
                    localStorage.setItem("infininoc_impersonating", JSON.stringify({ orgId: org.id, orgName: org.name }));
                    this.$root.toastSuccess(`Impersonating '${org.name}'.`);
                    window.location.href = "/dashboard";
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to impersonate organization.");
                }
            });
        },
        toggleStatus(orgId, status) {
            this.$root.getSocket().emit("toggleSuperAdminOrgStatus", { orgId, status }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Organization status updated to ${status}.`);
                    this.fetchOrganizations();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to update organization status.");
                }
            });
        },
        getPlanBadgeClass(plan) {
            switch (String(plan).toLowerCase()) {
                case "enterprise": return "bg-danger text-white";
                case "pro": return "bg-primary text-white";
                default: return "bg-secondary text-white";
            }
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
