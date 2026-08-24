<template>
    <div class="noc-coming-soon p-4 p-md-5 text-center">
        <div class="noc-box p-4 p-md-5 mx-auto shadow-lg" style="max-width: 600px;">
            <div class="mb-4">
                <div class="noc-icon-wrapper mx-auto mb-3">
                    <font-awesome-icon :icon="icon" class="display-4 text-warning" />
                </div>
                <h1 class="h3 fw-bold text-light mb-2">{{ title }}</h1>
                <span class="badge bg-warning text-dark fw-bold px-3 py-2 text-uppercase mb-3" style="letter-spacing: 0.05em;">
                    Feature Coming Soon
                </span>
                <p class="text-secondary mb-4">
                    {{ description }}
                </p>
            </div>

            <div class="p-3 rounded bg-dark border border-secondary mb-4 text-start small">
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary">Module Target:</span>
                    <span class="text-light fw-bold">{{ moduleName }}</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary">InfiniNOC Roadmap:</span>
                    <span class="text-info fw-bold">v2.1 Enterprise Release</span>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-secondary">Active Organization:</span>
                    <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </div>
            </div>

            <router-link to="/dashboard" class="btn noc-btn px-4 py-2 fw-bold">
                <font-awesome-icon icon="tachometer-alt" class="me-2" />
                Return to NOC Dashboard
            </router-link>
        </div>
    </div>
</template>

<script>
export default {
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        moduleName() {
            const path = this.$route.path;
            if (path.includes("topology")) {
                return "Network Topology Map";
            }
            if (path.includes("devices")) {
                return "Device Inventory & SNMP Telemetry";
            }
            if (path.includes("probes")) {
                return "Multi-Region Distributed Probes";
            }
            if (path.includes("reports")) {
                return "SLA & Performance Reporting";
            }
            if (path.includes("team")) {
                return "Team & Role Access Control";
            }
            if (path.includes("billing")) {
                return "Organization Billing & Subscription";
            }
            return "InfiniNOC Module";
        },
        title() {
            return this.moduleName;
        },
        description() {
            const path = this.$route.path;
            if (path.includes("topology")) {
                return "Visual network node topology, link status, and edge interconnectivity maps are currently scheduled for the next InfiniNOC core release.";
            }
            if (path.includes("devices")) {
                return "Hardware device inventory monitoring (Routers, MikroTik, Switches, OLTs, Servers) is undergoing validation.";
            }
            if (path.includes("probes")) {
                return "Distributed multi-region probe deployment management will be available in InfiniNOC Enterprise.";
            }
            if (path.includes("reports")) {
                return "Automated PDF/CSV uptime reports, SLA compliance export, and executive summaries.";
            }
            if (path.includes("team")) {
                return "Granular organization team invite links and role-based policy configuration.";
            }
            if (path.includes("billing")) {
                return "Organization billing management and plan tier subscriptions.";
            }
            return "This module is part of the upcoming InfiniNOC platform release.";
        },
        icon() {
            const path = this.$route.path;
            if (path.includes("topology")) {
                return "project-diagram";
            }
            if (path.includes("devices")) {
                return "server";
            }
            if (path.includes("probes")) {
                return "network-wired";
            }
            if (path.includes("reports")) {
                return "file-alt";
            }
            if (path.includes("team")) {
                return "users";
            }
            if (path.includes("billing")) {
                return "credit-card";
            }
            return "tools";
        },
    },
};
</script>

<style scoped>
.noc-coming-soon {
    background-color: #0f172a;
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.noc-box {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 16px;
}

.noc-icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: rgba(255, 153, 51, 0.1);
    border: 2px solid #ff9933;
    display: flex;
    align-items: center;
    justify-content: center;
}

.noc-btn {
    background-color: #ff9933;
    border-color: #e68a2e;
    color: #0f172a;
    transition: all 0.2s ease-in-out;
}

.noc-btn:hover {
    background-color: #e68a2e;
    color: #0f172a;
    box-shadow: 0 0 15px rgba(255, 153, 51, 0.35);
}
</style>
