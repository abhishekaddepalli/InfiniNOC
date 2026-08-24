<template>
    <div class="noc-sidebar-wrapper">
        <div class="noc-sidebar p-3 shadow-sm">
            <!-- Top Branding Header -->
            <div class="px-2 py-2 mb-3 border-bottom border-secondary d-flex align-items-center gap-2">
                <object width="32" height="32" data="/icon.svg" class="flex-shrink-0" />
                <div class="d-flex flex-column overflow-hidden">
                    <span class="fw-bold text-primary fs-6 lh-1">InfiniNOC</span>
                    <span class="text-secondary small text-uppercase text-truncate mt-1" style="font-size: 0.62rem; letter-spacing: 0.06em;">Infiniforge Technologies</span>
                </div>
            </div>

            <nav class="noc-nav flex-column gap-3">
                <!-- Group 1: OVERVIEW -->
                <div class="noc-nav-group">
                    <div class="noc-nav-label">Overview</div>
                    <ul class="nav flex-column gap-1">
                        <li class="nav-item">
                            <router-link to="/dashboard" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: isCurrentRoute('/dashboard') }" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="tachometer-alt" class="nav-icon" />
                                    <span>Dashboard</span>
                                </div>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 2: MONITORING -->
                <div class="noc-nav-group">
                    <button
                        class="noc-nav-label-btn w-100 d-flex align-items-center justify-content-between"
                        @click="toggleSubmenu('monitoring')"
                    >
                        <span>Monitoring</span>
                        <font-awesome-icon icon="chevron-down" class="small transition-transform" :class="{ 'rotate-180': submenus.monitoring }" />
                    </button>
                    <ul v-show="submenus.monitoring" class="nav flex-column gap-1 mt-1 ms-2 ps-2 border-start border-secondary">
                        <li class="nav-item">
                            <router-link to="/list" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/list' }" @click="$emit('close')">
                                <font-awesome-icon icon="list" class="me-2 text-muted" />
                                <span>All Monitors</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=http" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="globe" class="me-2 text-muted" />
                                <span>HTTP / HTTPS</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=ping" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="network-wired" class="me-2 text-muted" />
                                <span>Ping</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=port" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="plug" class="me-2 text-muted" />
                                <span>TCP</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=dns" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="search" class="me-2 text-muted" />
                                <span>DNS</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=realtime" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="lock" class="me-2 text-muted" />
                                <span>SSL</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/list?type=snmp" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="server" class="me-2 text-muted" />
                                <span>SNMP</span>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 3: NETWORK -->
                <div class="noc-nav-group">
                    <button
                        class="noc-nav-label-btn w-100 d-flex align-items-center justify-content-between"
                        @click="toggleSubmenu('network')"
                    >
                        <span>Network</span>
                        <font-awesome-icon icon="chevron-down" class="small transition-transform" :class="{ 'rotate-180': submenus.network }" />
                    </button>
                    <ul v-show="submenus.network" class="nav flex-column gap-1 mt-1 ms-2 ps-2 border-start border-secondary">
                        <li class="nav-item">
                            <router-link to="/devices/routers" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="server" class="me-2 text-muted" />
                                <span>Devices</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/sites" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="globe" class="me-2 text-muted" />
                                <span>Sites</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/probes" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="satellite-dish" class="me-2 text-muted" />
                                <span>Probes</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/topology" class="nav-link py-1 px-2 small" @click="$emit('close')">
                                <font-awesome-icon icon="project-diagram" class="me-2 text-muted" />
                                <span>Topology</span>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 4: OPERATIONS -->
                <div class="noc-nav-group">
                    <div class="noc-nav-label">Operations</div>
                    <ul class="nav flex-column gap-1">
                        <li class="nav-item">
                            <router-link to="/settings/notifications" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="bell" class="nav-icon" />
                                    <span>Alerts</span>
                                </div>
                                <span v-if="alertCount > 0" class="badge bg-warning text-dark fw-bold">
                                    {{ alertCount }}
                                </span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/incidents" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="exclamation-triangle" class="nav-icon" />
                                    <span>Incidents</span>
                                </div>
                                <span v-if="incidentCount > 0" class="badge bg-danger animate-pulse">
                                    {{ incidentCount }}
                                </span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/maintenance" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="wrench" class="nav-icon" />
                                    <span>Maintenance</span>
                                </div>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 5: REPORTS -->
                <div class="noc-nav-group">
                    <div class="noc-nav-label">Reports</div>
                    <ul class="nav flex-column gap-1">
                        <li class="nav-item">
                            <router-link to="/reports/sla" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="file-alt" class="nav-icon" />
                                    <span>SLA Reports</span>
                                </div>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group: TOOLS -->
                <div class="noc-nav-group">
                    <button
                        class="noc-nav-label-btn w-100 d-flex align-items-center justify-content-between"
                        @click="toggleSubmenu('tools')"
                    >
                        <span>Tools</span>
                        <font-awesome-icon icon="chevron-down" class="small transition-transform" :class="{ 'rotate-180': submenus.tools }" />
                    </button>
                    <ul v-show="submenus.tools" class="nav flex-column gap-1 mt-1 ms-2 ps-2 border-start border-secondary">
                        <li class="nav-item">
                            <router-link to="/tools" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools' }" @click="$emit('close')">
                                <font-awesome-icon icon="th-large" class="me-2 text-muted" />
                                <span>Tools Dashboard</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/tools/ip-checker" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools/ip-checker' }" @click="$emit('close')">
                                <font-awesome-icon icon="globe" class="me-2 text-muted" />
                                <span>IP Checker</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/tools/port-checker" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools/port-checker' }" @click="$emit('close')">
                                <font-awesome-icon icon="plug" class="me-2 text-muted" />
                                <span>Port Checker</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/tools/subnet-calculator" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools/subnet-calculator' }" @click="$emit('close')">
                                <font-awesome-icon icon="calculator" class="me-2 text-muted" />
                                <span>Subnet Calculator</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/tools/dns-lookup" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools/dns-lookup' }" @click="$emit('close')">
                                <font-awesome-icon icon="search" class="me-2 text-muted" />
                                <span>DNS Lookup</span>
                            </router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/tools/ping" class="nav-link py-1 px-2 small" :class="{ active: $route.path === '/tools/ping' }" @click="$emit('close')">
                                <font-awesome-icon icon="network-wired" class="me-2 text-muted" />
                                <span>Ping</span>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 6: COMMUNICATION -->
                <div class="noc-nav-group">
                    <div class="noc-nav-label">Communication</div>
                    <ul class="nav flex-column gap-1">
                        <li class="nav-item">
                            <router-link to="/manage-status-page" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="stream" class="nav-icon" />
                                    <span>Status Pages</span>
                                </div>
                            </router-link>
                        </li>
                        <li v-if="canManageSettings" class="nav-item">
                            <router-link to="/settings/api-keys" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="key" class="nav-icon" />
                                    <span>Integrations</span>
                                </div>
                            </router-link>
                        </li>
                    </ul>
                </div>

                <!-- Group 7: ORGANIZATION -->
                <div class="noc-nav-group">
                    <div class="noc-nav-label">Organization</div>
                    <ul class="nav flex-column gap-1">
                        <li v-if="canManageSettings" class="nav-item">
                            <router-link to="/team" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="users" class="nav-icon" />
                                    <span>Team</span>
                                </div>
                            </router-link>
                        </li>
                        <li v-if="canManageSettings" class="nav-item">
                            <router-link to="/billing" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="credit-card" class="nav-icon" />
                                    <span>Billing</span>
                                </div>
                            </router-link>
                        </li>
                        <li v-if="canManageSettings" class="nav-item">
                            <router-link to="/settings/general" class="nav-link d-flex align-items-center justify-content-between" @click="$emit('close')">
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="cog" class="nav-icon" />
                                    <span>Settings</span>
                                </div>
                            </router-link>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>
    </div>
</template>

<script>
export default {
    emits: ["close"],
    data() {
        return {
            submenus: {
                monitoring: true,
                network: true,
                tools: true,
            },
            activeIncidentCount: 0,
        };
    },
    computed: {
        isSuperAdmin() {
            return Boolean(this.$root.user && this.$root.user.is_super_admin);
        },
        activeOrgRole() {
            const list = this.$root.organizationList || [];
            const org = list.find((o) => o.id === this.$root.activeOrganizationId);
            return org ? org.role : "owner";
        },
        canManageSettings() {
            return this.activeOrgRole === "owner" || this.activeOrgRole === "admin";
        },
        alertCount() {
            return this.$root.notificationList ? this.$root.notificationList.length : 0;
        },
        incidentCount() {
            return this.activeIncidentCount;
        },
    },
    watch: {
        "$root.activeOrganizationId"() {
            this.loadIncidentCount();
        },
    },
    mounted() {
        this.loadIncidentCount();
        if (this.$root.getSocket()) {
            this.$root.getSocket().on("updateIncidentStats", this.loadIncidentCount);
        }
    },
    beforeUnmount() {
        if (this.$root.getSocket()) {
            this.$root.getSocket().off("updateIncidentStats", this.loadIncidentCount);
        }
    },
    methods: {
        loadIncidentCount() {
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getIncidentDashboardStats", (res) => {
                    if (res && res.ok && res.stats) {
                        this.activeIncidentCount = res.stats.activeCount || 0;
                    }
                });
            }
        },
        toggleSubmenu(name) {
            this.submenus[name] = !this.submenus[name];
        },
        isCurrentRoute(path) {
            return this.$route.path === path;
        },
    },
};
</script>

<style scoped>
.noc-sidebar {
    background-color: var(--sidebar);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    color: var(--sidebar-foreground);
}

.noc-nav-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    padding: 0.35rem 0.5rem 0.2rem 0.5rem;
}

.noc-nav-label-btn {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    padding: 0.35rem 0.5rem 0.2rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
}

.noc-nav-label-btn:hover {
    color: var(--foreground);
}

.nav-link {
    color: var(--sidebar-foreground);
    font-weight: 500;
    font-size: 0.85rem;
    padding: 0.45rem 0.65rem;
    border-radius: 8px;
    transition: all 0.15s ease-in-out;
}

.nav-link:hover {
    background-color: var(--sidebar-hover);
    color: var(--foreground);
}

.nav-link.active {
    background-color: var(--secondary) !important;
    color: var(--foreground) !important;
    font-weight: 700 !important;
    border-left: 3px solid var(--accent);
}

.nav-link.active .nav-icon {
    color: var(--primary) !important;
}

.rotate-180 {
    transform: rotate(180deg);
}

.transition-transform {
    transition: transform 0.2s ease-in-out;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

.animate-pulse {
    animation: pulse 1.5s infinite ease-in-out;
}
</style>
