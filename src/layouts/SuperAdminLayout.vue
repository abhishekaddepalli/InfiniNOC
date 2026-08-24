<template>
    <div class="super-admin-wrapper min-vh-100 d-flex flex-column bg-body text-foreground">
        <!-- Impersonation Sticky Banner (If Active) -->
        <div v-if="isImpersonating" class="bg-warning text-dark py-2 px-4 fw-bold shadow-sm d-flex align-items-center justify-content-between font-monospace" style="z-index: 1090;">
            <div class="d-flex align-items-center gap-2 text-truncate">
                <font-awesome-icon icon="user-secret" class="fs-5" />
                <span class="text-truncate">SUPER ADMIN IMPERSONATION: Viewing {{ impersonatedOrgName }}</span>
            </div>
            <button class="btn btn-xs btn-dark fw-bold flex-shrink-0" @click="exitImpersonation">
                Exit Impersonation
            </button>
        </div>

        <!-- Top SaaS Administration Header -->
        <header class="navbar navbar-expand-lg bg-card border-bottom border-secondary px-3 py-2 sticky-top shadow-sm">
            <div class="container-fluid p-0 d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <!-- Mobile Sidebar Toggle Hamburger Button -->
                    <button class="btn btn-outline-secondary btn-sm d-md-none me-1 px-2 py-1" aria-label="Toggle Navigation" @click="mobileSidebarOpen = !mobileSidebarOpen">
                        <font-awesome-icon icon="bars" />
                    </button>

                    <router-link to="/super-admin" class="d-flex align-items-center gap-2 text-decoration-none">
                        <object width="32" height="32" data="/icon.svg" />
                        <span class="fw-bold text-primary fs-5 d-none d-sm-inline">InfiniNOC</span>
                        <span class="badge bg-danger text-uppercase font-monospace" style="font-size: 0.65rem;">SUPER ADMIN</span>
                    </router-link>
                </div>

                <div class="d-flex align-items-center gap-2 gap-md-3">
                    <span class="badge bg-success-subtle text-success border border-success font-monospace px-3 py-1 d-none d-lg-inline-block">
                        <font-awesome-icon icon="server" class="me-1" />
                        SYSTEM HEALTH: OPTIMAL
                    </span>

                    <!-- Light / Dark Theme Switcher Button -->
                    <button class="btn btn-outline-secondary btn-sm rounded-circle px-2 py-1" :title="themeTitle" @click="toggleTheme">
                        <font-awesome-icon :icon="themeIcon" />
                    </button>

                    <router-link to="/dashboard" class="btn btn-outline-secondary btn-sm fw-bold d-none d-sm-flex align-items-center gap-2">
                        <font-awesome-icon icon="exchange-alt" />
                        <span>Switch to Org Dashboard</span>
                    </router-link>

                    <div class="dropdown">
                        <button class="btn btn-sm btn-dark dropdown-toggle fw-bold d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                            <font-awesome-icon icon="user-shield" class="text-danger" />
                            <span class="d-none d-sm-inline">Super Admin</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow border-secondary">
                            <li><router-link class="dropdown-item small" to="/super-admin">Overview Dashboard</router-link></li>
                            <li><router-link class="dropdown-item small" to="/super-admin/organizations">Manage Organizations</router-link></li>
                            <li><router-link class="dropdown-item small" to="/super-admin/plans">SaaS Plans & Pricing</router-link></li>
                            <li><router-link class="dropdown-item small" to="/super-admin/system-health">System Health & Telemetry</router-link></li>
                            <li><hr class="dropdown-divider border-secondary" /></li>
                            <li><router-link class="dropdown-item small text-danger" to="/dashboard">Exit Super Admin</router-link></li>
                        </ul>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Workspace (Sidebar + Content) -->
        <div class="d-flex flex-grow-1 position-relative">
            <!-- Mobile Sidebar Backdrop Drawer Overlay -->
            <div v-if="mobileSidebarOpen" class="saas-mobile-backdrop d-md-none position-fixed top-0 start-0 w-100 h-100" style="background: rgba(0,0,0,0.6); z-index: 1040;" @click="mobileSidebarOpen = false"></div>

            <!-- Super Admin Sidebar (Desktop Sticky + Mobile Offcanvas Drawer) -->
            <aside
                class="saas-sidebar bg-card border-end border-secondary p-3"
                :class="{ 'saas-sidebar-mobile-open': mobileSidebarOpen, 'd-none d-md-block': !mobileSidebarOpen }"
                style="width: 260px; z-index: 1045;"
            >
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="text-muted small text-uppercase fw-bold font-monospace" style="letter-spacing: 0.05em;">SUPER ADMIN</span>
                    <button class="btn-close btn-close-white d-md-none" @click="mobileSidebarOpen = false"></button>
                </div>

                <ul class="nav flex-column gap-1 mb-3">
                    <li class="nav-item">
                        <router-link to="/super-admin" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="tachometer-alt" class="text-primary" />
                            <span>Dashboard</span>
                        </router-link>
                    </li>
                </ul>

                <div class="text-muted small text-uppercase fw-bold mb-2 font-monospace" style="letter-spacing: 0.05em;">CUSTOMERS</div>
                <ul class="nav flex-column gap-1 mb-3">
                    <li class="nav-item">
                        <router-link to="/super-admin/organizations" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path.startsWith('/super-admin/organizations') }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="building" class="text-warning" />
                            <span>Organizations</span>
                        </router-link>
                    </li>
                </ul>

                <div class="text-muted small text-uppercase fw-bold mb-2 font-monospace" style="letter-spacing: 0.05em;">COMMERCE</div>
                <ul class="nav flex-column gap-1 mb-3">
                    <li class="nav-item">
                        <router-link to="/super-admin/plans" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/plans' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="tags" class="text-success" />
                            <span>SaaS Plans & Pricing</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/invoices" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/invoices' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="file-invoice-dollar" class="text-warning" />
                            <span>Invoices & GST</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/coupons" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/coupons' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="ticket-alt" class="text-info" />
                            <span>Coupons & Discounts</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/gateways" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/gateways' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="credit-card" class="text-primary" />
                            <span>Payment Gateways</span>
                        </router-link>
                    </li>
                </ul>

                <div class="text-muted small text-uppercase fw-bold mb-2 font-monospace" style="letter-spacing: 0.05em;">PLATFORM</div>
                <ul class="nav flex-column gap-1 mb-3">
                    <li class="nav-item">
                        <router-link to="/super-admin/branding" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/branding' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="paint-brush" class="text-info" />
                            <span>Branding & White Label</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/system-health" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/system-health' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="heartbeat" class="text-danger" />
                            <span>System Health</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/email" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/email' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="envelope" class="text-warning" />
                            <span>Email & SMTP Settings</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/audit-logs" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/audit-logs' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="history" class="text-secondary" />
                            <span>Platform Audit Logs</span>
                        </router-link>
                    </li>
                    <li class="nav-item">
                        <router-link to="/super-admin/settings" class="nav-link text-foreground py-2 px-3 rounded d-flex align-items-center gap-2" :class="{ active: $route.path === '/super-admin/settings' }" @click="mobileSidebarOpen = false">
                            <font-awesome-icon icon="cog" class="text-light" />
                            <span>Platform Settings</span>
                        </router-link>
                    </li>
                </ul>
            </aside>

            <!-- Main Content Area -->
            <main class="flex-grow-1 p-3 p-md-4 overflow-auto">
                <router-view />
            </main>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            isImpersonating: false,
            impersonatedOrgName: "",
            mobileSidebarOpen: false,
        };
    },
    computed: {
        themeIcon() {
            return this.$root.userTheme === "light" ? "sun" : "moon";
        },
        themeTitle() {
            return `Current Theme: ${this.$root.userTheme || "dark"}`;
        },
    },
    mounted() {
        const imp = localStorage.getItem("infininoc_impersonating");
        if (imp) {
            try {
                const parsed = JSON.parse(imp);
                this.isImpersonating = true;
                this.impersonatedOrgName = parsed.orgName || "Organization";
            } catch (e) {}
        }
    },
    methods: {
        exitImpersonation() {
            localStorage.removeItem("infininoc_impersonating");
            this.isImpersonating = false;
            window.location.href = "/super-admin/organizations";
        },
        toggleTheme() {
            const nextTheme = this.$root.userTheme === "light" ? "dark" : "light";
            this.$root.userTheme = nextTheme;
            document.body.setAttribute("data-theme", nextTheme);
            localStorage.setItem("theme", nextTheme);
        },
    },
};
</script>

<style scoped>
.saas-sidebar {
    transition: transform 0.25s ease;
}
@media (max-width: 767.98px) {
    .saas-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        height: 100vh;
        transform: translateX(-100%);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .saas-sidebar-mobile-open {
        transform: translateX(0) !important;
    }
}
.saas-sidebar .nav-link.active {
    background-color: var(--bs-primary-bg-subtle, rgba(13, 110, 253, 0.15));
    font-weight: 700;
    color: var(--bs-primary) !important;
}
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
