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

        <!-- Floating Exit Bar when in Wallboard Mode -->
        <div v-if="isWallboardMode" class="noc-wallboard-exit-bar">
            <button class="btn btn-sm btn-dark border border-warning shadow-lg text-warning fw-bold d-flex align-items-center gap-2 px-3 py-2 rounded-pill cursor-pointer" @click="toggleWallboardMode">
                <font-awesome-icon icon="compress" />
                <span>Exit Wallboard (ESC)</span>
            </button>
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

                <!-- Live Update Notification Pill -->
                <router-link
                    v-if="hasNewVersion"
                    to="/settings/updates"
                    class="btn btn-warning btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill fw-bold shadow-sm animate-pulse text-dark text-decoration-none"
                    title="A new InfiniNOC version is available"
                >
                    <font-awesome-icon icon="rocket" />
                    <span class="d-none d-sm-inline">Update v{{ $root.info.latestVersion }}</span>
                </router-link>

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

                <!-- Fullscreen NOC Wallboard Toggle -->
                <button
                    class="btn header-icon-btn rounded-3 cursor-pointer d-flex align-items-center gap-2 px-3 py-2"
                    :class="{ 'btn-primary text-white': isWallboardMode }"
                    :title="isWallboardMode ? 'Exit Wallboard' : 'Fullscreen NOC Wallboard'"
                    @click="toggleWallboardMode"
                >
                    <font-awesome-icon :icon="isWallboardMode ? 'compress' : 'tv'" />
                    <span class="d-none d-xxl-inline small fw-semibold">Wallboard</span>
                </button>

                <!-- Audio Alert Chime Control Group -->
                <div class="btn-group">
                    <button
                        class="btn header-icon-btn rounded-start-3 cursor-pointer"
                        :title="soundEnabled ? 'Alert Chime: Enabled (Click to mute)' : 'Alert Chime: Muted (Click to enable)'"
                        @click="toggleSoundAlert"
                    >
                        <font-awesome-icon :icon="soundEnabled ? 'volume-up' : 'volume-mute'" :class="soundEnabled ? 'text-warning' : 'text-muted'" />
                    </button>
                    <button
                        class="btn header-icon-btn rounded-end-3 cursor-pointer px-2 border-start border-secondary"
                        title="NOC Audio Alert Settings & Test"
                        @click="showAudioModal = true"
                    >
                        <font-awesome-icon icon="sliders-h" class="text-muted" style="font-size: 0.72rem;" />
                    </button>
                </div>

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
                        <li v-if="hasNewVersion">
                            <router-link to="/settings/updates" class="dropdown-item py-2 rounded text-warning fw-bold d-flex align-items-center justify-content-between">
                                <span class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="rocket" />
                                    <span>Update Available</span>
                                </span>
                                <span class="badge bg-warning text-dark font-monospace">v{{ $root.info.latestVersion }}</span>
                            </router-link>
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
        <div v-if="$root.isMobile" style="width: 100%; height: calc(64px + env(safe-area-inset-bottom, 0px))" />
        <nav v-if="$root.isMobile && $root.loggedIn" class="bottom-nav-modern">
            <router-link to="/dashboard" class="nav-tab-item">
                <font-awesome-icon icon="tachometer-alt" class="nav-tab-icon" />
                <span>Dashboard</span>
            </router-link>

            <router-link to="/list" class="nav-tab-item">
                <font-awesome-icon icon="list" class="nav-tab-icon" />
                <span>Monitors</span>
            </router-link>

            <router-link to="/add" class="nav-tab-item nav-tab-add" aria-label="Add Target" title="Add Target">
                <font-awesome-icon icon="plus" class="nav-tab-icon" />
            </router-link>

            <router-link to="/incidents" class="nav-tab-item">
                <div class="position-relative">
                    <font-awesome-icon icon="exclamation-triangle" class="nav-tab-icon" />
                    <span v-if="activeIncidentCount > 0" class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style="width: 8px; height: 8px;"></span>
                </div>
                <span>Incidents</span>
            </router-link>

            <button type="button" class="btn p-0 nav-tab-item border-0 bg-transparent" aria-label="Open menu drawer" @click="mobileDrawerOpen = !mobileDrawerOpen">
                <font-awesome-icon icon="th-large" class="nav-tab-icon" />
                <span>Menu</span>
            </button>
        </nav>

        <button
            v-if="numActiveToasts != 0"
            type="button"
            class="btn btn-normal clear-all-toast-btn"
            @click="clearToasts"
        >
            <font-awesome-icon icon="times" />
        </button>

        <!-- NOC Audio Alert Control Modal -->
        <div v-if="showAudioModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-secondary bg-card text-foreground shadow-lg">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="volume-up" />
                            <span>NOC Audio Alert Control Center</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAudioModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <!-- Master Switch -->
                        <div class="form-check form-switch d-flex align-items-center justify-content-between p-0 mb-3">
                            <label class="form-check-label fw-bold" for="nocAudioMasterSwitch">
                                Enable Incident Audio Chimes
                            </label>
                            <input
                                id="nocAudioMasterSwitch"
                                v-model="soundEnabled"
                                class="form-check-input ms-0"
                                type="checkbox"
                                role="switch"
                                @change="saveSoundPrefs"
                            />
                        </div>

                        <!-- Volume Slider -->
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <label class="small text-muted fw-bold text-uppercase">Alert Volume</label>
                                <span class="badge bg-secondary font-monospace">{{ soundVolume }}%</span>
                            </div>
                            <input
                                v-model.number="soundVolume"
                                type="range"
                                class="form-range"
                                min="5"
                                max="100"
                                step="5"
                                :disabled="!soundEnabled"
                                @change="saveSoundPrefs"
                            />
                        </div>

                        <!-- Tone Selection -->
                        <div class="mb-3">
                            <label class="small text-muted fw-bold text-uppercase mb-2 d-block">Alert Tone Profile</label>
                            <div class="btn-group w-100" role="group">
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    :class="{ active: soundTone === 'siren' }"
                                    @click="soundTone = 'siren'; saveSoundPrefs();"
                                >
                                    Siren
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    :class="{ active: soundTone === 'sonar' }"
                                    @click="soundTone = 'sonar'; saveSoundPrefs();"
                                >
                                    Sonar Ping
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-secondary"
                                    :class="{ active: soundTone === 'chime' }"
                                    @click="soundTone = 'chime'; saveSoundPrefs();"
                                >
                                    Chime
                                </button>
                            </div>
                        </div>

                        <!-- Sound Audition / Test Buttons -->
                        <div class="p-3 rounded bg-dark border border-secondary mb-3">
                            <div class="small text-muted fw-bold mb-2 text-uppercase">Audition Sound Engine</div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-danger btn-sm flex-fill d-flex align-items-center justify-content-center gap-2" @click="testChime('down')">
                                    <font-awesome-icon icon="exclamation-triangle" />
                                    <span>Test Outage Siren</span>
                                </button>
                                <button class="btn btn-outline-success btn-sm flex-fill d-flex align-items-center justify-content-center gap-2" @click="testChime('up')">
                                    <font-awesome-icon icon="check-circle" />
                                    <span>Test Recovery</span>
                                </button>
                            </div>
                        </div>

                        <div class="small text-muted">
                            <font-awesome-icon icon="info-circle" class="me-1 text-info" />
                            Audio alerts synthesize locally using browser Web Audio API. Zero external MP3 downloads required.
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-2">
                        <button type="button" class="btn btn-secondary btn-sm px-4" @click="showAudioModal = false">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
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
            isWallboardMode: false,
            soundEnabled: localStorage.getItem("infininoc_sound_enabled") === "true",
            showAudioModal: false,
            soundVolume: parseInt(localStorage.getItem("infininoc_sound_volume")) || 50,
            soundTone: localStorage.getItem("infininoc_sound_tone") || "siren",
        };
    },

    computed: {
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            classes["wallboard"] = this.isWallboardMode;
            return classes;
        },

        activeIncidentCount() {
            let count = 0;
            if (this.$root.lastHeartbeatList) {
                for (let id in this.$root.lastHeartbeatList) {
                    const beat = this.$root.lastHeartbeatList[id];
                    if (beat && beat.status === 0) {
                        count++;
                    }
                }
            }
            return count;
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

        window.addEventListener("keydown", this.handleKeyDown);
    },

    beforeUnmount() {
        if (this.toastContainerObserver) {
            this.toastContainerObserver.disconnect();
        }
        window.removeEventListener("keydown", this.handleKeyDown);
        document.body.classList.remove("noc-wallboard-mode");
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
        toggleWallboardMode() {
            this.isWallboardMode = !this.isWallboardMode;
            document.body.classList.toggle("noc-wallboard-mode", this.isWallboardMode);
            if (this.isWallboardMode && document.documentElement.requestFullscreen && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else if (!this.isWallboardMode && document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        },
        toggleSoundAlert() {
            this.soundEnabled = !this.soundEnabled;
            localStorage.setItem("infininoc_sound_enabled", String(this.soundEnabled));
            if (this.soundEnabled) {
                this.playChime("up");
                toast.info("Audio Alert Chimes: Enabled");
            } else {
                toast.info("Audio Alert Chimes: Muted");
            }
        },
        playChime(type = "up") {
            if (!this.soundEnabled) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                const volumeFactor = Math.max(0.02, ((this.soundVolume || 50) / 100) * 0.25);
                const now = ctx.currentTime;

                if (type === "down") {
                    if (this.soundTone === "sonar") {
                        osc.type = "sine";
                        osc.frequency.setValueAtTime(800, now);
                        osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
                    } else if (this.soundTone === "siren") {
                        osc.type = "sawtooth";
                        osc.frequency.setValueAtTime(480, now);
                        osc.frequency.linearRampToValueAtTime(320, now + 0.2);
                        osc.frequency.linearRampToValueAtTime(480, now + 0.4);
                    } else {
                        osc.type = "sine";
                        osc.frequency.setValueAtTime(440, now);
                        osc.frequency.exponentialRampToValueAtTime(330, now + 0.35);
                    }
                    gain.gain.setValueAtTime(volumeFactor, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    osc.start(now);
                    osc.stop(now + 0.46);
                } else {
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.12);
                    osc.frequency.setValueAtTime(783.99, now + 0.24);
                    gain.gain.setValueAtTime(volumeFactor, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
                    osc.start(now);
                    osc.stop(now + 0.43);
                }
            } catch (_) {}
        },
        testChime(type) {
            const prev = this.soundEnabled;
            this.soundEnabled = true;
            this.playChime(type);
            this.soundEnabled = prev;
        },
        saveSoundPrefs() {
            localStorage.setItem("infininoc_sound_enabled", String(this.soundEnabled));
            localStorage.setItem("infininoc_sound_volume", String(this.soundVolume));
            localStorage.setItem("infininoc_sound_tone", this.soundTone);
        },
        handleKeyDown(e) {
            if (e.key === "Escape" && this.isWallboardMode) {
                this.toggleWallboardMode();
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
