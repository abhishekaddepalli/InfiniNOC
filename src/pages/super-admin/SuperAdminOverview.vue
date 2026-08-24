<template>
    <div class="super-admin-overview">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="user-shield" class="text-danger" />
                    <span>Super Admin Platform Dashboard</span>
                </h3>
                <div class="text-muted small">
                    Manage your InfiniNOC platform, tenant organizations, subscriptions, system health, and global operations.
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-danger font-monospace px-3 py-2 shadow-sm">SERVER-SIDE SUPER ADMIN PROTECTED</span>
            </div>
        </div>

        <!-- 6 Sleek KPI Telemetry Cards -->
        <div class="row g-3 mb-4">
            <!-- Tenants (Orgs) Card -->
            <div class="col-12 col-sm-6 col-lg-4 col-xl-2-4">
                <div class="kpi-card bg-card border border-secondary rounded-3 p-3 shadow-sm h-100 position-relative overflow-hidden hover-lift">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="text-muted small text-uppercase fw-bold font-monospace">Tenants (Orgs)</span>
                        <div class="kpi-icon-badge bg-primary-subtle text-primary rounded-circle p-2 d-flex align-items-center justify-content-center">
                            <font-awesome-icon icon="building" class="fs-5" />
                        </div>
                    </div>
                    <div class="fw-bold fs-2 text-foreground font-monospace mb-1">{{ overview.totalOrganizations || 0 }}</div>
                    <div class="small text-success fw-semibold font-monospace d-flex align-items-center gap-1">
                        <font-awesome-icon icon="check-circle" class="small" />
                        <span>{{ overview.activeOrganizations || 0 }} Active Tenants</span>
                    </div>
                </div>
            </div>

            <!-- Users Card -->
            <div class="col-12 col-sm-6 col-lg-4 col-xl-2-4">
                <div class="kpi-card bg-card border border-secondary rounded-3 p-3 shadow-sm h-100 position-relative overflow-hidden hover-lift">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="text-muted small text-uppercase fw-bold font-monospace">Registered Users</span>
                        <div class="kpi-icon-badge bg-info-subtle text-info rounded-circle p-2 d-flex align-items-center justify-content-center">
                            <font-awesome-icon icon="users" class="fs-5" />
                        </div>
                    </div>
                    <div class="fw-bold fs-2 text-info font-monospace mb-1">{{ overview.totalUsers || 0 }}</div>
                    <div class="small text-muted fw-semibold font-monospace">{{ overview.activeUsers || 0 }} Active Logins</div>
                </div>
            </div>

            <!-- Active Monitors Card -->
            <div class="col-12 col-sm-6 col-lg-4 col-xl-2-4">
                <div class="kpi-card bg-card border border-secondary rounded-3 p-3 shadow-sm h-100 position-relative overflow-hidden hover-lift">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="text-muted small text-uppercase fw-bold font-monospace">Active Monitors</span>
                        <div class="kpi-icon-badge bg-success-subtle text-success rounded-circle p-2 d-flex align-items-center justify-content-center">
                            <font-awesome-icon icon="heartbeat" class="fs-5" />
                        </div>
                    </div>
                    <div class="fw-bold fs-2 text-success font-monospace mb-1">{{ overview.totalMonitors || 0 }}</div>
                    <div class="small text-success fw-semibold font-monospace d-flex align-items-center gap-1">
                        <font-awesome-icon icon="shield-alt" class="small" />
                        <span>{{ overview.healthyMonitors || 0 }} Healthy Probes</span>
                    </div>
                </div>
            </div>

            <!-- Devices Card -->
            <div class="col-12 col-sm-6 col-lg-4 col-xl-2-4">
                <div class="kpi-card bg-card border border-secondary rounded-3 p-3 shadow-sm h-100 position-relative overflow-hidden hover-lift">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="text-muted small text-uppercase fw-bold font-monospace">Network Devices</span>
                        <div class="kpi-icon-badge bg-warning-subtle text-warning rounded-circle p-2 d-flex align-items-center justify-content-center">
                            <font-awesome-icon icon="network-wired" class="fs-5" />
                        </div>
                    </div>
                    <div class="fw-bold fs-2 text-warning font-monospace mb-1">{{ overview.totalDevices || 0 }}</div>
                    <div class="small text-muted fw-semibold font-monospace">Routers, OLTs & Switches</div>
                </div>
            </div>

            <!-- MRR & ARR Financial Card -->
            <div class="col-12 col-sm-6 col-lg-4 col-xl-2-4">
                <div class="kpi-card bg-card border border-secondary rounded-3 p-3 shadow-sm h-100 position-relative overflow-hidden hover-lift">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="text-muted small text-uppercase fw-bold font-monospace">Monthly Revenue</span>
                        <div class="kpi-icon-badge bg-danger-subtle text-danger rounded-circle p-2 d-flex align-items-center justify-content-center">
                            <font-awesome-icon icon="rupee-sign" class="fs-5" />
                        </div>
                    </div>
                    <div class="fw-bold fs-2 text-danger font-monospace mb-1">₹{{ (overview.mrr || 0).toLocaleString('en-IN') }}</div>
                    <div class="small text-muted fw-semibold font-monospace">ARR: ₹{{ (overview.arr || 0).toLocaleString('en-IN') }}</div>
                </div>
            </div>
        </div>

        <!-- Quick Access Action Banners -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-md-4">
                <router-link to="/super-admin/organizations" class="card bg-card border-secondary shadow-sm p-4 text-decoration-none h-100 hover-lift">
                    <div class="d-flex align-items-center gap-3">
                        <div class="p-3 bg-warning-subtle text-warning rounded-3">
                            <font-awesome-icon icon="building" class="fs-2" />
                        </div>
                        <div>
                            <h5 class="fw-bold text-foreground mb-1">Manage Organizations</h5>
                            <div class="text-muted small">View, create, change plans, suspend, or impersonate tenant organizations.</div>
                        </div>
                    </div>
                </router-link>
            </div>

            <div class="col-12 col-md-4">
                <router-link to="/super-admin/plans" class="card bg-card border-secondary shadow-sm p-4 text-decoration-none h-100 hover-lift">
                    <div class="d-flex align-items-center gap-3">
                        <div class="p-3 bg-success-subtle text-success rounded-3">
                            <font-awesome-icon icon="tags" class="fs-2" />
                        </div>
                        <div>
                            <h5 class="fw-bold text-foreground mb-1">SaaS Plans & Entitlements</h5>
                            <div class="text-muted small">Configure tier pricing, resource quotas, and feature access matrices.</div>
                        </div>
                    </div>
                </router-link>
            </div>

            <div class="col-12 col-md-4">
                <router-link to="/super-admin/system-health" class="card bg-card border-secondary shadow-sm p-4 text-decoration-none h-100 hover-lift">
                    <div class="d-flex align-items-center gap-3">
                        <div class="p-3 bg-danger-subtle text-danger rounded-3">
                            <font-awesome-icon icon="heartbeat" class="fs-2" />
                        </div>
                        <div>
                            <h5 class="fw-bold text-foreground mb-1">System Health & Telemetry</h5>
                            <div class="text-muted small">Monitor SQLite database connections, RAM/CPU load, and process uptime.</div>
                        </div>
                    </div>
                </router-link>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            overview: {},
            loading: true,
        };
    },
    mounted() {
        this.fetchOverview();
    },
    methods: {
        fetchOverview() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminOverview", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.overview = res.overview || {};
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
.kpi-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.hover-lift:hover {
    transform: translateY(-4px);
    border-color: var(--bs-primary) !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
}
.kpi-icon-badge {
    width: 40px;
    height: 40px;
}
</style>
