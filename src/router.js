import { createRouter, createWebHistory } from "vue-router";

import EmptyLayout from "./layouts/EmptyLayout.vue";
import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Details from "./pages/Details.vue";
import EditMonitor from "./pages/EditMonitor.vue";
import EditMaintenance from "./pages/EditMaintenance.vue";
import List from "./pages/List.vue";
const Settings = () => import("./pages/Settings.vue");
import Setup from "./pages/Setup.vue";
import StatusPage from "./pages/StatusPage.vue";
import Entry from "./pages/Entry.vue";
import ManageStatusPage from "./pages/ManageStatusPage.vue";
import AddStatusPage from "./pages/AddStatusPage.vue";
import NotFound from "./pages/NotFound.vue";
import DockerHosts from "./components/settings/Docker.vue";
import ManageMaintenance from "./pages/ManageMaintenance.vue";
import APIKeys from "./components/settings/APIKeys.vue";
import SetupDatabase from "./pages/SetupDatabase.vue";
import ToolsLanding from "./pages/ToolsLanding.vue";
import ToolContainer from "./pages/ToolContainer.vue";

// Settings - Sub Pages
import Appearance from "./components/settings/Appearance.vue";
import General from "./components/settings/General.vue";
const Notifications = () => import("./components/settings/Notifications.vue");
import ReverseProxy from "./components/settings/ReverseProxy.vue";
import Tags from "./components/settings/Tags.vue";
import MonitorHistory from "./components/settings/MonitorHistory.vue";
const Security = () => import("./components/settings/Security.vue");
import Proxies from "./components/settings/Proxies.vue";
import About from "./components/settings/About.vue";
import RemoteBrowsers from "./components/settings/RemoteBrowsers.vue";

const routes = [
    {
        path: "/",
        component: Entry,
    },
    {
        // If it is "/dashboard", the active link is not working
        // If it is "", it overrides the "/" unexpectedly
        // Give a random name to solve the problem.
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "DashboardHome",
                        path: "/dashboard",
                        component: DashboardHome,
                        children: [
                            {
                                path: "/dashboard/:id",
                                component: EmptyLayout,
                                children: [
                                    {
                                        path: "",
                                        component: Details,
                                    },
                                    {
                                        path: "/edit/:id",
                                        component: EditMonitor,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        path: "/add",
                        component: EditMonitor,
                        children: [
                            {
                                path: "/clone/:id",
                                component: EditMonitor,
                            },
                        ],
                    },
                    {
                        path: "/list",
                        component: List,
                    },
                    {
                        path: "/tools",
                        component: ToolsLanding,
                    },
                    {
                        path: "/tools/:toolSlug",
                        component: ToolContainer,
                    },
                    {
                        path: "/settings",
                        component: Settings,
                        children: [
                            {
                                path: "general",
                                component: General,
                            },
                            {
                                path: "appearance",
                                component: Appearance,
                            },
                            {
                                path: "notifications",
                                component: Notifications,
                            },
                            {
                                path: "reverse-proxy",
                                component: ReverseProxy,
                            },
                            {
                                path: "tags",
                                component: Tags,
                            },
                            {
                                path: "monitor-history",
                                component: MonitorHistory,
                            },
                            {
                                path: "docker-hosts",
                                component: DockerHosts,
                            },
                            {
                                path: "remote-browsers",
                                component: RemoteBrowsers,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "api-keys",
                                component: APIKeys,
                            },
                            {
                                path: "proxies",
                                component: Proxies,
                            },
                            {
                                path: "backup-restore",
                                component: () => import("./components/settings/BackupRestore.vue"),
                            },
                            {
                                path: "updates",
                                component: () => import("./components/settings/UpdateCenter.vue"),
                            },
                            {
                                path: "about",
                                component: About,
                            },
                        ],
                    },
                    {
                        path: "/manage-status-page",
                        component: ManageStatusPage,
                    },
                    {
                        path: "/add-status-page",
                        component: AddStatusPage,
                    },
                    {
                        path: "/maintenance",
                        component: ManageMaintenance,
                    },
                    {
                        path: "/notifications",
                        component: () => import("./pages/ManageNotifications.vue"),
                    },
                    {
                        path: "/reports/sla",
                        component: () => import("./pages/SlaReports.vue"),
                    },
                    {
                        path: "/settings/branding",
                        component: () => import("./pages/ManageBranding.vue"),
                    },
                    {
                        path: "/billing",
                        component: () => import("./pages/BillingDashboard.vue"),
                    },
                    {
                        path: "/add-maintenance",
                        component: EditMaintenance,
                    },
                    {
                        path: "/maintenance/edit/:id",
                        component: EditMaintenance,
                    },
                    {
                        path: "/maintenance/clone/:id",
                        component: EditMaintenance,
                    },
                    {
                        path: "/sites",
                        component: () => import("./pages/ManageSites.vue"),
                    },
                    {
                        path: "/sites/:id",
                        component: () => import("./pages/SiteDetails.vue"),
                    },
                    {
                        path: "/incidents",
                        component: () => import("./pages/ManageIncidents.vue"),
                    },
                    {
                        path: "/incidents/:id(\\d+)",
                        component: () => import("./pages/IncidentDetails.vue"),
                    },
                    {
                        path: "/alerts",
                        component: () => import("./pages/ManageAlerts.vue"),
                    },
                    {
                        path: "/devices",
                        component: () => import("./pages/ManageDevices.vue"),
                    },
                    {
                        path: "/devices/:id(\\d+)",
                        component: () => import("./pages/DeviceDetails.vue"),
                    },
                    {
                        path: "/devices/:id(\\d+)/mikrotik",
                        component: () => import("./pages/MikroTikDashboard.vue"),
                    },
                    {
                        path: "/devices/:id(\\d+)/olt",
                        component: () => import("./pages/OltDashboard.vue"),
                    },
                    {
                        path: "/devices/:type",
                        component: () => import("./pages/ManageDevices.vue"),
                    },
                    {
                        path: "/probes",
                        component: () => import("./pages/ManageProbes.vue"),
                    },
                    {
                        path: "/topology",
                        component: () => import("./pages/ManageTopology.vue"),
                    },
                    {
                        path: "/reports",
                        component: () => import("./pages/ComingSoon.vue"),
                    },
                    {
                        path: "/team",
                        component: () => import("./pages/TeamManagement.vue"),
                    },
                    {
                        path: "/billing",
                        component: () => import("./pages/BillingDashboard.vue"),
                    },
                    {
                        path: "/admin",
                        component: () => import("./pages/SuperAdminDashboard.vue"),
                    },
                    {
                        path: "/welcome",
                        component: () => import("./pages/NocOnboardingWizard.vue"),
                    },
                    {
                        path: "/onboarding",
                        component: () => import("./pages/NocOnboardingWizard.vue"),
                    },
                ],
            },
        ],
    },
    {
        path: "/signup",
        component: () => import("./pages/NocSaaSSignup.vue"),
    },
    {
        path: "/setup",
        component: Setup,
    },
    {
        path: "/setup-database",
        component: SetupDatabase,
    },
    {
        path: "/status-page",
        component: StatusPage,
    },
    {
        path: "/status",
        component: StatusPage,
    },
    {
        path: "/status/:slug",
        component: StatusPage,
    },
    {
        path: "/:pathMatch(.*)*",
        component: NotFound,
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
