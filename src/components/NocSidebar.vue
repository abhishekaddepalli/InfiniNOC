<template>
    <div class="noc-sidebar-wrapper">
        <div class="noc-sidebar p-3 shadow-lg d-flex flex-column justify-content-between">
            <div>
                <!-- Top Branding Header -->
                <div class="px-2 py-2 mb-3 border-bottom border-secondary d-flex align-items-center gap-2">
                    <object width="32" height="32" data="/icon.svg" class="flex-shrink-0" />
                    <div class="d-flex flex-column overflow-hidden">
                        <span class="fw-bold text-foreground fs-6 lh-1" style="letter-spacing: -0.02em;">InfiniNOC</span>
                        <span class="text-muted small text-uppercase text-truncate mt-1" style="font-size: 0.62rem; letter-spacing: 0.08em;">Infiniforge Technologies</span>
                    </div>
                </div>

                <nav class="noc-nav flex-column gap-3">
                    <!-- Group 1: OVERVIEW -->
                    <div class="noc-nav-group">
                        <div class="noc-nav-label">Overview</div>
                        <ul class="nav flex-column gap-1">
                            <li class="nav-item">
                                <router-link to="/dashboard" class="nav-link nav-link-pill d-flex align-items-center justify-content-between" :class="{ 'active-emerald': isCurrentRoute('/dashboard') }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="tachometer-alt" class="nav-icon" />
                                        <span>Dashboard</span>
                                    </div>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <a href="javascript:void(0)" class="nav-link d-flex align-items-center justify-content-between cursor-pointer" @click="handleNocViewClick">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="tv" class="nav-icon text-muted" />
                                        <span>NOC View</span>
                                    </div>
                                </a>
                            </li>
                            <li class="nav-item">
                                <router-link to="/topology" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: isCurrentRoute('/topology') }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="project-diagram" class="nav-icon text-muted" />
                                        <span>Map & Topology</span>
                                    </div>
                                </router-link>
                            </li>
                        </ul>
                    </div>

                    <!-- Group 2: MONITORING -->
                    <div class="noc-nav-group">
                        <div class="noc-nav-label">Monitoring</div>
                        <ul class="nav flex-column gap-1">
                            <li class="nav-item">
                                <router-link to="/list" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path === '/list' && !$route.query.type }" @click="$emit('close')">
                                    <font-awesome-icon icon="list" class="nav-icon text-muted" />
                                    <span>All Monitors</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=http" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'http' }" @click="$emit('close')">
                                    <font-awesome-icon icon="globe" class="nav-icon text-muted" />
                                    <span>HTTP / HTTPS</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=ping" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'ping' }" @click="$emit('close')">
                                    <font-awesome-icon icon="network-wired" class="nav-icon text-muted" />
                                    <span>Ping</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=port" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'port' }" @click="$emit('close')">
                                    <font-awesome-icon icon="plug" class="nav-icon text-muted" />
                                    <span>TCP</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=dns" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'dns' }" @click="$emit('close')">
                                    <font-awesome-icon icon="search" class="nav-icon text-muted" />
                                    <span>DNS</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=realtime" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'realtime' }" @click="$emit('close')">
                                    <font-awesome-icon icon="lock" class="nav-icon text-muted" />
                                    <span>SSL</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/list?type=snmp" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.query.type === 'snmp' }" @click="$emit('close')">
                                    <font-awesome-icon icon="server" class="nav-icon text-muted" />
                                    <span>SNMP</span>
                                </router-link>
                            </li>
                        </ul>
                    </div>

                    <!-- Group 3: NETWORK -->
                    <div class="noc-nav-group">
                        <div class="noc-nav-label">Network</div>
                        <ul class="nav flex-column gap-1">
                            <li class="nav-item">
                                <router-link to="/devices" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path.startsWith('/devices') }" @click="$emit('close')">
                                    <font-awesome-icon icon="server" class="nav-icon text-muted" />
                                    <span>Devices</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/sites" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path.startsWith('/sites') }" @click="$emit('close')">
                                    <font-awesome-icon icon="map-marker-alt" class="nav-icon text-muted" />
                                    <span>Sites</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/probes" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path === '/probes' }" @click="$emit('close')">
                                    <font-awesome-icon icon="satellite-dish" class="nav-icon text-muted" />
                                    <span>Probes</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/topology" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path === '/topology' }" @click="$emit('close')">
                                    <font-awesome-icon icon="project-diagram" class="nav-icon text-muted" />
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
                                <router-link to="/alerts" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: $route.path === '/alerts' }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="bell" class="nav-icon text-muted" />
                                        <span>Alerts</span>
                                    </div>
                                    <span v-if="alertCount > 0" class="badge rounded-pill bg-danger text-white fw-bold" style="font-size: 0.65rem;">
                                        {{ alertCount }}
                                    </span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/incidents" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: $route.path === '/incidents' }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="exclamation-triangle" class="nav-icon text-muted" />
                                        <span>Incidents</span>
                                    </div>
                                    <span v-if="incidentCount > 0" class="badge rounded-pill bg-danger text-white animate-pulse" style="font-size: 0.65rem;">
                                        {{ incidentCount }}
                                    </span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/maintenance" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: $route.path === '/maintenance' }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="wrench" class="nav-icon text-muted" />
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
                                <router-link to="/reports/sla" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path === '/reports/sla' }" @click="$emit('close')">
                                    <font-awesome-icon icon="chart-line" class="nav-icon text-muted" />
                                    <span>Availability</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/reports" class="nav-link d-flex align-items-center gap-2" :class="{ active: $route.path === '/reports' }" @click="$emit('close')">
                                    <font-awesome-icon icon="chart-bar" class="nav-icon text-muted" />
                                    <span>Performance</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/dashboard#events" class="nav-link d-flex align-items-center gap-2" @click="$emit('close')">
                                    <font-awesome-icon icon="history" class="nav-icon text-muted" />
                                    <span>Events</span>
                                </router-link>
                            </li>
                            <li class="nav-item">
                                <router-link to="/reports/sla" class="nav-link d-flex align-items-center gap-2" @click="$emit('close')">
                                    <font-awesome-icon icon="file-alt" class="nav-icon text-muted" />
                                    <span>SLA Reports</span>
                                </router-link>
                            </li>
                        </ul>
                    </div>

                    <!-- Group 6: SETTINGS -->
                    <div class="noc-nav-group">
                        <ul class="nav flex-column gap-1">
                            <li class="nav-item">
                                <router-link to="/settings/general" class="nav-link d-flex align-items-center justify-content-between" :class="{ active: $route.path.startsWith('/settings') }" @click="$emit('close')">
                                    <div class="d-flex align-items-center gap-2">
                                        <font-awesome-icon icon="cog" class="nav-icon text-muted" />
                                        <span>Settings</span>
                                    </div>
                                    <span v-if="hasNewVersion" class="badge bg-warning text-dark fw-bold animate-pulse" style="font-size: 0.65rem;" title="New version available">
                                        UPDATE
                                    </span>
                                </router-link>
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>

            <!-- Bottom Promo Card (from Design Mockup) -->
            <div class="noc-promo-card mt-3 p-3 rounded-3 position-relative overflow-hidden">
                <div class="d-flex align-items-center justify-content-center mb-2">
                    <div class="promo-icon-box d-flex align-items-center justify-content-center rounded-3">
                        <font-awesome-icon icon="server" class="fs-4 text-info" />
                    </div>
                </div>
                <div class="text-center mb-2">
                    <div class="fw-bold text-white small" style="font-size: 0.85rem; line-height: 1.25;">Network Monitoring<br/><span style="color: #10B981;">Simplified</span></div>
                </div>
                <div class="d-flex flex-column gap-1 px-1" style="font-size: 0.68rem;">
                    <div class="d-flex align-items-center gap-2 text-muted">
                        <font-awesome-icon icon="check-circle" class="text-success flex-shrink-0" />
                        <span class="text-secondary-foreground">Real-time Alerts</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 text-muted">
                        <font-awesome-icon icon="check-circle" class="text-success flex-shrink-0" />
                        <span class="text-secondary-foreground">High Availability</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 text-muted">
                        <font-awesome-icon icon="check-circle" class="text-success flex-shrink-0" />
                        <span class="text-secondary-foreground">Infrastructure Insights</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import compareVersions from "compare-versions";

export default {
    emits: ["close"],
    data() {
        return {
            activeIncidentCount: 0,
        };
    },
    computed: {
        hasNewVersion() {
            if (this.$root.info && this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            }
            return false;
        },
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
        handleNocViewClick() {
            if (this.$root.toggleWallboardMode) {
                this.$root.toggleWallboardMode();
            } else if (this.$route.path !== "/dashboard") {
                this.$router.push("/dashboard");
            }
            this.$emit("close");
        },
        loadIncidentCount() {
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getIncidentDashboardStats", (res) => {
                    if (res && res.ok && res.stats) {
                        this.activeIncidentCount = res.stats.activeCount || 0;
                    }
                });
            }
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
    border-radius: 14px;
    color: var(--sidebar-foreground);
    min-height: calc(100vh - 100px);
}

.noc-nav-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    padding: 0.4rem 0.6rem 0.2rem 0.6rem;
}

.nav-link {
    color: var(--sidebar-foreground);
    font-weight: 500;
    font-size: 0.85rem;
    padding: 0.45rem 0.75rem;
    border-radius: 8px;
    transition: all 0.15s ease-in-out;
}

.nav-link:hover {
    background-color: var(--sidebar-hover);
    color: var(--foreground);
}

.nav-link.active-emerald {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
    font-weight: 600 !important;
    border-radius: 8px;
}

.nav-link.active-emerald .nav-icon {
    color: #ffffff !important;
}

.nav-link.active:not(.active-emerald) {
    background-color: var(--secondary) !important;
    color: var(--foreground) !important;
    font-weight: 600 !important;
    border-left: 3px solid var(--accent);
}

.nav-link.active .nav-icon {
    color: var(--accent) !important;
}

.noc-promo-card {
    background: linear-gradient(180deg, rgba(17, 29, 48, 0.7) 0%, rgba(11, 20, 36, 0.95) 100%);
    border: 1px solid rgba(36, 54, 77, 0.9);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.promo-icon-box {
    width: 48px;
    height: 48px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(16, 185, 129, 0.1) 100%);
    border: 1px solid rgba(59, 130, 246, 0.3);
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
