<template>
    <div>
        <div v-if="$root.isMobile" class="shadow-box mb-3">
            <router-link to="/manage-status-page" class="nav-link">
                <font-awesome-icon icon="stream" />
                {{ $t("Status Pages") }}
            </router-link>
            <router-link to="/maintenance" class="nav-link">
                <font-awesome-icon icon="wrench" />
                {{ $t("Maintenance") }}
            </router-link>
        </div>

        <h1 v-show="show" class="mb-3">
            {{ $t("Settings") }}
        </h1>

        <div class="shadow-box shadow-box-settings">
            <div class="row">
                <div v-if="showSubMenu" class="settings-menu col-lg-3 col-md-5">
                    <div v-for="(group, groupName) in menuGroups" :key="groupName" class="menu-group-section mb-3">
                        <div class="menu-group-title px-2 mb-1 text-uppercase font-monospace text-muted small fw-bold">
                            {{ groupName }}
                        </div>
                        <router-link v-for="(item, key) in group" :key="key" :to="`/settings/${key}`">
                            <div class="menu-item d-flex align-items-center gap-2">
                                <font-awesome-icon :icon="item.icon" class="menu-icon" />
                                <span>{{ item.title }}</span>
                            </div>
                        </router-link>
                    </div>

                    <!-- Logout Button for Mobile -->
                    <a
                        v-if="$root.isMobile && $root.loggedIn && $root.socket.token !== 'autoLogin'"
                        class="logout"
                        @click.prevent="$root.logout"
                    >
                        <div class="menu-item d-flex align-items-center gap-2">
                            <font-awesome-icon icon="sign-out-alt" />
                            <span>{{ $t("Logout") }}</span>
                        </div>
                    </a>
                </div>
                <div class="settings-content col-lg-9 col-md-7">
                    <div v-if="currentPage && subMenus[currentPage]" class="settings-content-header">
                        {{ subMenus[currentPage].title }}
                    </div>
                    <div class="mx-3 my-2">
                        <router-view v-slot="{ Component }">
                            <transition name="slide-fade" appear>
                                <component :is="Component" />
                            </transition>
                        </router-view>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { useRoute } from "vue-router";

export default {
    data() {
        return {
            show: true,
            settings: {},
            settingsLoaded: false,
        };
    },

    computed: {
        currentPage() {
            let pathSplit = useRoute().path.split("/");
            let pathEnd = pathSplit[pathSplit.length - 1];
            if (!pathEnd || pathEnd === "settings") {
                return null;
            }
            return pathEnd;
        },

        showSubMenu() {
            if (this.$root.isMobile) {
                return !this.currentPage;
            } else {
                return true;
            }
        },

        menuGroups() {
            return {
                GENERAL: {
                    general: { title: this.$t("General"), icon: "cog" },
                    appearance: { title: this.$t("Appearance"), icon: "palette" },
                    notifications: { title: this.$t("Notifications"), icon: "bell" },
                },
                MONITORING: {
                    "reverse-proxy": { title: this.$t("Reverse Proxy"), icon: "network-wired" },
                    tags: { title: this.$t("Tags"), icon: "tags" },
                    "monitor-history": { title: this.$t("Monitor History"), icon: "history" },
                    "docker-hosts": { title: this.$t("Docker Hosts"), icon: "boxes" },
                    "remote-browsers": { title: this.$t("Remote Browsers"), icon: "globe" },
                },
                SECURITY: {
                    security: { title: this.$t("Security"), icon: "shield-alt" },
                    "api-keys": { title: this.$t("API Keys"), icon: "key" },
                    proxies: { title: this.$t("Proxies"), icon: "exchange-alt" },
                },
                PLATFORM: {
                    "backup-restore": { title: "Backup & Restore", icon: "database" },
                    updates: { title: "Updates", icon: "sync-alt" },
                    about: { title: this.$t("About"), icon: "info-circle" },
                },
            };
        },

        subMenus() {
            const flattened = {};
            for (const group of Object.values(this.menuGroups)) {
                for (const [key, item] of Object.entries(group)) {
                    flattened[key] = item;
                }
            }
            return flattened;
        },
    },

    watch: {
        "$root.isMobile"() {
            this.loadGeneralPage();
        },
    },

    mounted() {
        this.loadSettings();
        this.loadGeneralPage();
    },

    methods: {
        /**
         * Load the general settings page
         * For desktop only, on mobile do nothing
         * @returns {void}
         */
        loadGeneralPage() {
            if (!this.currentPage && !this.$root.isMobile) {
                this.$router.push("/settings/general");
            }
        },

        /**
         * Load settings from server
         * @returns {void}
         */
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;

                if (this.settings.checkUpdate === undefined) {
                    this.settings.checkUpdate = true;
                }

                if (this.settings.searchEngineIndex === undefined) {
                    this.settings.searchEngineIndex = false;
                }

                if (this.settings.entryPage === undefined) {
                    this.settings.entryPage = "dashboard";
                }

                if (this.settings.nscd === undefined) {
                    this.settings.nscd = true;
                }

                if (this.settings.keepDataPeriodDays === undefined) {
                    this.settings.keepDataPeriodDays = 180;
                }

                if (this.settings.tlsExpiryNotifyDays === undefined) {
                    this.settings.tlsExpiryNotifyDays = [7, 14, 21];
                }

                if (this.settings.domainExpiryNotifyDays === undefined) {
                    this.settings.domainExpiryNotifyDays = [7, 14, 21];
                }

                if (this.settings.trustProxy === undefined) {
                    this.settings.trustProxy = false;
                }

                this.settingsLoaded = true;
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box-settings {
    padding: 20px;
    min-height: calc(100vh - 155px);
}

footer {
    color: $secondary-text;
    font-size: 13px;
    margin-top: 20px;
    padding-bottom: 30px;
    text-align: center;
}

.settings-menu {
    a {
        text-decoration: none !important;
        color: var(--muted-foreground) !important;
        display: block;
    }

    .menu-group-title {
        font-size: 0.725rem;
        letter-spacing: 0.05em;
    }

    .menu-item {
        border-radius: 8px;
        margin: 0.25em 0;
        padding: 0.6em 0.85em;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: all ease-in-out 0.15s;
        color: var(--foreground) !important;
        font-weight: 500;
        font-size: 0.925rem;
        background: transparent;

        .menu-icon {
            width: 16px;
            color: var(--muted-foreground);
        }
    }

    .menu-item:hover {
        background-color: var(--secondary) !important;
        color: var(--foreground) !important;

        .menu-icon {
            color: var(--foreground);
        }
    }

    .router-link-active .menu-item,
    .router-link-exact-active .menu-item {
        background-color: var(--secondary) !important;
        color: #ff9933 !important;
        font-weight: 600;
        border-left: 3px solid #ff9933 !important;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;

        .menu-icon {
            color: #ff9933;
        }
    }
}

.settings-content {
    .settings-content-header {
        width: calc(100% + 20px);
        border-bottom: 1px solid var(--border);
        border-radius: 0 10px 0 0;
        margin-top: -20px;
        margin-right: -20px;
        padding: 12.5px 1em;
        font-size: 22px;
        font-weight: 700;
        color: var(--foreground);
        background-color: transparent;

        .mobile & {
            padding: 15px 0 0 0;
        }
    }
}

.logout {
    color: var(--danger) !important;
}
</style>
