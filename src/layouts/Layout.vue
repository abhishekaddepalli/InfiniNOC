<template>
    <div :class="classes">
        <div v-if="!$root.socket.connected && !$root.socket.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.connectionErrorMsg }}
                <div v-if="$root.showReverseProxyGuide">
                    {{ $t("Using a Reverse Proxy?") }}
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">
                        {{ $t("Check how to config it for WebSocket") }}
                    </a>
                </div>
            </div>
        </div>

        <!-- Premium SaaS Desktop Header (64px) -->
        <header v-if="!$root.isMobile" class="noc-saas-header d-flex align-items-center justify-content-between px-4 border-bottom">
            <!-- Left: Brand Identity -->
            <div class="header-left-zone d-flex align-items-center gap-3">
                <router-link to="/dashboard" class="d-flex align-items-center gap-2 text-decoration-none brand-link">
                    <object class="brand-logo-img" width="30" height="30" data="/icon.svg" />
                    <div class="d-flex flex-column" style="line-height: 1.1;">
                        <span class="brand-title fw-bold" style="color: var(--accent, #ff9933); font-size: 1.15rem;">{{ productConfig.productName }}</span>
                        <span class="brand-sublabel text-muted text-uppercase" style="font-size: 0.6rem; letter-spacing: 0.08em;">INFINIFORGE TECHNOLOGIES</span>
                    </div>
                </router-link>
            </div>

            <!-- Center: Global Telemetry Search -->
            <div v-if="$root.loggedIn" class="header-center-zone">
                <GlobalSearchModal />
            </div>

            <!-- Right: Controls Zone -->
            <div v-if="$root.loggedIn" class="header-right-zone d-flex align-items-center gap-2">

                <!-- Status Pages Quick Nav -->
                <router-link
                    to="/manage-status-page"
                    class="header-nav-btn d-flex align-items-center gap-2 px-3 py-2 rounded-3 text-decoration-none"
                    :class="{ active: $route.path.includes('status-page') }"
                >
                    <font-awesome-icon icon="desktop" />
                    <span class="d-none d-xl-inline font-weight-semibold">Status Pages</span>
                </router-link>

                <!-- Dashboard Quick Nav -->
                <router-link
                    to="/dashboard"
                    class="header-nav-btn d-flex align-items-center gap-2 px-3 py-2 rounded-3 text-decoration-none"
                    :class="{ active: $route.path === '/dashboard' || $route.path === '/' }"
                >
                    <font-awesome-icon icon="tachometer-alt" />
                    <span class="d-none d-xl-inline font-weight-semibold">Dashboard</span>
                </router-link>

                <!-- Theme Selection Dropdown -->
                <div class="dropdown">
                    <button
                        class="btn header-icon-btn rounded-3 cursor-pointer"
                        data-bs-toggle="dropdown"
                        :title="themeTitle"
                        :aria-label="themeTitle"
                    >
                        <font-awesome-icon :icon="themeIcon" class="fs-6" />
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-lg border-secondary py-2 px-1" style="min-width: 170px;">
                        <li class="dropdown-header px-3 py-1 text-uppercase font-monospace text-muted small fw-bold">Theme</li>
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" :class="{ active: $root.userTheme === 'light' }" @click="setTheme('light')">
                                <span class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="sun" class="text-warning" />
                                    <span>Light</span>
                                </span>
                                <font-awesome-icon v-if="$root.userTheme === 'light'" icon="check" class="small text-primary" />
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" :class="{ active: $root.userTheme === 'dark' }" @click="setTheme('dark')">
                                <span class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="moon" class="text-info" />
                                    <span>Dark</span>
                                </span>
                                <font-awesome-icon v-if="$root.userTheme === 'dark'" icon="check" class="small text-primary" />
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" :class="{ active: $root.userTheme === 'auto' || !$root.userTheme }" @click="setTheme('auto')">
                                <span class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="desktop" class="text-muted" />
                                    <span>System</span>
                                </span>
                                <font-awesome-icon v-if="$root.userTheme === 'auto' || !$root.userTheme" icon="check" class="small text-primary" />
                            </button>
                        </li>
                    </ul>
                </div>

                <!-- Account Profile Dropdown -->
                <div class="dropdown">
                    <div class="header-avatar-btn cursor-pointer d-flex align-items-center gap-1 p-1 rounded-circle" data-bs-toggle="dropdown" aria-label="Account menu">
                        <div class="avatar-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center" style="width: 34px; height: 34px; border-radius: 50%;">
                            {{ $root.usernameFirstChar }}
                        </div>
                        <font-awesome-icon icon="chevron-down" class="small text-muted me-1" style="font-size: 0.7rem;" />
                    </div>

                    <ul class="dropdown-menu dropdown-menu-end shadow-lg border-secondary py-2 px-1" style="min-width: 240px;">
                        <li class="px-3 py-2 border-bottom border-secondary mb-1">
                            <div class="fw-bold text-foreground">{{ $root.username }}</div>
                            <div class="text-muted small">Organization Administrator</div>
                        </li>
                        <li>
                            <router-link to="/settings/general" class="dropdown-item py-2 rounded">
                                <font-awesome-icon icon="cog" class="me-2 text-muted" />
                                {{ $t("Settings") }}
                            </router-link>
                        </li>
                        <li>
                            <router-link to="/settings/security" class="dropdown-item py-2 rounded">
                                <font-awesome-icon icon="shield-alt" class="me-2 text-muted" />
                                Security & Auth
                            </router-link>
                        </li>
                        <li>
                            <router-link to="/settings/about" class="dropdown-item py-2 rounded">
                                <font-awesome-icon icon="info-circle" class="me-2 text-muted" />
                                About InfiniNOC
                            </router-link>
                        </li>
                        <li><hr class="dropdown-divider my-1" /></li>
                        <li v-if="$root.socket.token !== 'autoLogin'">
                            <button class="dropdown-item text-danger py-2 rounded" @click="$root.logout">
                                <font-awesome-icon icon="sign-out-alt" class="me-2" />
                                {{ $t("Logout") }}
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </header>

        <!-- Responsive Mobile Header (60px) -->
        <header v-else class="noc-saas-header-mobile d-flex align-items-center justify-content-between px-3 border-bottom">
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary border-0" aria-label="Open navigation menu" @click="mobileDrawerOpen = !mobileDrawerOpen">
                    <font-awesome-icon icon="bars" class="fs-5" />
                </button>
                <router-link to="/dashboard" class="d-flex align-items-center text-decoration-none gap-2">
                    <object width="26" height="26" data="/icon.svg" />
                    <span class="fs-6 fw-bold" style="color: var(--accent, #ff9933);">{{ productConfig.productName }}</span>
                </router-link>
            </div>

            <div v-if="$root.loggedIn" class="d-flex align-items-center gap-2">
                <GlobalSearchModal />
                <!-- Mobile Theme Dropdown -->
                <div class="dropdown">
                    <button class="btn btn-sm header-icon-btn rounded-circle" data-bs-toggle="dropdown" :title="themeTitle" :aria-label="themeTitle">
                        <font-awesome-icon :icon="themeIcon" />
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-lg border-secondary py-2 px-1" style="min-width: 160px;">
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" @click="setTheme('light')">
                                <span><font-awesome-icon icon="sun" class="me-2 text-warning" /> Light</span>
                                <font-awesome-icon v-if="$root.userTheme === 'light'" icon="check" class="small text-primary" />
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" @click="setTheme('dark')">
                                <span><font-awesome-icon icon="moon" class="me-2 text-info" /> Dark</span>
                                <font-awesome-icon v-if="$root.userTheme === 'dark'" icon="check" class="small text-primary" />
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 px-3 rounded d-flex align-items-center justify-content-between" @click="setTheme('auto')">
                                <span><font-awesome-icon icon="desktop" class="me-2 text-muted" /> System</span>
                                <font-awesome-icon v-if="$root.userTheme === 'auto' || !$root.userTheme" icon="check" class="small text-primary" />
                            </button>
                        </li>
                    </ul>
                </div>
                <div class="avatar-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center cursor-pointer" style="width: 32px; height: 32px; border-radius: 50%;" @click="mobileDrawerOpen = !mobileDrawerOpen">
                    {{ $root.usernameFirstChar }}
                </div>
            </div>
        </header>

        <!-- Mobile Navigation Drawer -->
        <div v-if="$root.isMobile && mobileDrawerOpen" class="noc-drawer-backdrop" @click="mobileDrawerOpen = false" />
        <div v-if="$root.isMobile" class="noc-mobile-drawer" :class="{ open: mobileDrawerOpen }">
            <div class="noc-drawer-header d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <div class="d-flex align-items-center gap-2">
                    <object class="bi" width="28" height="28" data="/icon.svg" />
                    <span class="fw-bold text-primary">{{ productConfig.productName }}</span>
                </div>
                <button type="button" class="btn-close text-reset" aria-label="Close menu" @click="mobileDrawerOpen = false" />
            </div>
            <div class="p-3 overflow-y-auto" style="max-height: calc(100vh - 70px);">
                <div v-if="$root.loggedIn" class="mb-3">
                    <OrganizationSwitcher class="w-100" />
                </div>
                <NocSidebar v-if="$root.loggedIn" @close="mobileDrawerOpen = false" />
            </div>
        </div>

        <main>
            <router-view v-if="$root.loggedIn" />
            <Login v-if="!$root.loggedIn && $root.allowLoginDialog" />
        </main>

        <!-- Mobile Bottom Nav -->
        <div v-if="$root.isMobile" style="width: 100%; height: calc(60px + env(safe-area-inset-bottom))" />
        <nav v-if="$root.isMobile && $root.loggedIn" class="bottom-nav">
            <router-link to="/dashboard" class="nav-link">
                <div><font-awesome-icon icon="tachometer-alt" /></div>
                {{ $t("Home") }}
            </router-link>

            <router-link to="/list" class="nav-link">
                <div><font-awesome-icon icon="list" /></div>
                {{ $t("List") }}
            </router-link>

            <router-link to="/add" class="nav-link">
                <div><font-awesome-icon icon="plus" /></div>
                {{ $t("Add") }}
            </router-link>

            <router-link to="/settings" class="nav-link">
                <div><font-awesome-icon icon="cog" /></div>
                {{ $t("Settings") }}
            </router-link>
        </nav>

        <button
            v-if="numActiveToasts != 0"
            type="button"
            class="btn btn-normal clear-all-toast-btn"
            @click="clearToasts"
        >
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import OrganizationSwitcher from "../components/OrganizationSwitcher.vue";
import NocSidebar from "../components/NocSidebar.vue";
import GlobalSearchModal from "../components/header/GlobalSearchModal.vue";
import compareVersions from "compare-versions";
import { useToast } from "vue-toastification";
import productConfig from "../../config/product.json";
const toast = useToast();

export default {
    components: {
        Login,
        OrganizationSwitcher,
        NocSidebar,
        GlobalSearchModal,
    },

    data() {
        return {
            productConfig,
            toastContainer: null,
            numActiveToasts: 0,
            toastContainerObserver: null,
            mobileDrawerOpen: false,
            searchQuery: "",
        };
    },

    computed: {
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        themeIcon() {
            if (this.$root.userTheme === "light") {
                return "sun";
            }
            if (this.$root.userTheme === "dark") {
                return "moon";
            }
            return "desktop";
        },

        themeTitle() {
            if (this.$root.userTheme === "light") {
                return "Light mode";
            }
            if (this.$root.userTheme === "dark") {
                return "Dark mode";
            }
            return "System theme";
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },

        currentPageTitle() {
            const path = this.$route.path;
            if (path === "/dashboard" || path === "/") {
                return "Overview";
            }
            if (path.includes("list") || path.includes("dashboard/")) {
                return "Monitors";
            }
            if (path.includes("devices")) {
                return "Devices";
            }
            if (path.includes("sites")) {
                return "Sites";
            }
            if (path.includes("probes")) {
                return "Probes";
            }
            if (path.includes("topology")) {
                return "Topology";
            }
            if (path.includes("incidents")) {
                return "Incidents";
            }
            if (path.includes("reports")) {
                return "SLA Reports";
            }
            if (path.includes("status-page")) {
                return "Status Pages";
            }
            if (path.includes("team")) {
                return "Team";
            }
            if (path.includes("billing")) {
                return "Billing";
            }
            if (path.includes("settings")) {
                return "Settings";
            }
            if (path.includes("admin")) {
                return "Super Admin";
            }
            return "Dashboard";
        },
    },

    watch: {
        mobileDrawerOpen(isOpen) {
            if (isOpen) {
                document.body.style.overflow = "hidden";
            } else {
                document.body.style.overflow = "";
            }
        },
        $route() {
            this.mobileDrawerOpen = false;
        },
    },

    mounted() {
        this.toastContainer = document.querySelector(".bottom-right.toast-container");

        this.toastContainerObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this.numActiveToasts = mutation.target.children.length;
                }
            }
        });

        if (this.toastContainer != null) {
            this.toastContainerObserver.observe(this.toastContainer, { childList: true });
        }
    },

    beforeUnmount() {
        if (this.toastContainerObserver) {
            this.toastContainerObserver.disconnect();
        }
        document.body.style.overflow = "";
    },

    methods: {
        clearToasts() {
            toast.clear();
        },
        setTheme(mode) {
            this.$root.userTheme = mode;
        },
        handleGlobalSearch() {
            if (this.searchQuery.trim()) {
                this.$router.push(`/list?search=${encodeURIComponent(this.searchQuery.trim())}`);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.nav-link {
    color: var(--foreground);
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: var(--secondary);
        color: var(--foreground);

        &.active {
            background-color: var(--accent);
            color: var(--accent-foreground);
        }
    }
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: calc(60px + env(safe-area-inset-bottom));
    width: 100%;
    left: 0;
    background-color: var(--card);
    border-top: 1px solid var(--border);
    box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.05);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px env(safe-area-inset-bottom);

    a {
        text-align: center;
        width: 25%;
        display: inline-block;
        height: 100%;
        padding: 8px 10px 0;
        font-size: 13px;
        color: var(--muted-foreground);
        overflow: hidden;
        text-decoration: none;

        &.active {
            color: var(--accent);
            font-weight: 700;
        }

        div {
            font-size: 20px;
        }
    }
}

header.noc-saas-header {
    height: 64px;
    background-color: var(--card);
    border-bottom: 1px solid var(--border) !important;
    position: sticky;
    top: 0;
    z-index: 1020;
}

header.noc-saas-header-mobile {
    height: 60px;
    background-color: var(--card);
    border-bottom: 1px solid var(--border) !important;
    position: sticky;
    top: 0;
    z-index: 1020;
}

.brand-link {
    transition: opacity 0.2s ease;

    &:hover {
        opacity: 0.9;
    }
}

.header-nav-btn {
    color: var(--foreground);
    background-color: transparent;
    border: 1px solid transparent;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: var(--secondary);
        color: var(--foreground);
    }

    &.active {
        background-color: var(--secondary);
        border-color: var(--border);
        color: var(--accent);
        font-weight: 600;
    }
}

.header-icon-btn {
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--secondary);
    border: 1px solid var(--border);
    color: var(--foreground);
    transition: all 0.2s ease-in-out;

    &:hover {
        border-color: var(--accent);
        color: var(--accent);
    }
}

.header-avatar-btn {
    border: 1px solid var(--border);
    background-color: var(--secondary);
    transition: all 0.2s ease-in-out;

    &:hover {
        border-color: var(--accent);
    }
}

.avatar-circle {
    font-size: 0.85rem;
}

.noc-brand-title {
    color: var(--accent);
    letter-spacing: -0.01em;
}

.nav-pills .nav-link.active, .nav-pills .show > .nav-link {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
    font-weight: 700;
}

.noc-drawer-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1040;
}

.noc-mobile-drawer {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    background-color: var(--card);
    color: var(--card-foreground);
    border-right: 1px solid var(--border);
    z-index: 1050;
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    box-shadow: 10px 0 30px rgba(0, 0, 0, 0.25);

    &.open {
        transform: translateX(0);
    }
}

.clear-all-toast-btn {
    position: fixed;
    right: 1em;
    bottom: 1em;
    font-size: 1.2em;
    padding: 9px 15px;
    width: 48px;
    box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.2);
    z-index: 100;

    .dark & {
        box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.5);
    }
}

@media (max-width: 770px) {
    .clear-all-toast-btn {
        bottom: 72px;
    }
}
</style>
