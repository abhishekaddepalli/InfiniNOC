<template>
    <div id="app-root">
        <!-- PWA Offline Banner -->
        <div v-if="isOffline" class="noc-offline-banner bg-warning text-dark py-2 px-3 text-center fw-bold d-flex align-items-center justify-content-center gap-2">
            <font-awesome-icon icon="wifi" class="fs-5" />
            <span>You are currently offline. Live telemetry monitoring data may be unavailable. Last synchronized: {{ lastSyncTime }}</span>
        </div>

        <!-- PWA Install Prompt Banner -->
        <div v-if="showInstallPrompt" class="noc-install-banner bg-card text-foreground border-bottom border-secondary py-2 px-4 d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
                <object width="24" height="24" data="/icon.svg" />
                <span class="fw-semibold small">Install InfiniNOC for quick standalone access to your NOC dashboard.</span>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-xs btn-outline-secondary" @click="dismissInstallPrompt">Not now</button>
                <button class="btn btn-xs btn-warning fw-bold" @click="triggerPwaInstall">Install</button>
            </div>
        </div>

        <router-view />
    </div>
</template>

<script>
import { setPageLocale } from "./util-frontend";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

export default {
    data() {
        return {
            isOffline: !navigator.onLine,
            lastSyncTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            deferredPrompt: null,
            showInstallPrompt: false,
        };
    },
    created() {
        setPageLocale();
        polyfillCountryFlagEmojis();
    },
    mounted() {
        window.addEventListener("online", this.handleOnlineStatus);
        window.addEventListener("offline", this.handleOfflineStatus);

        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const dismissed = localStorage.getItem("infininoc_pwa_dismissed");
            if (!dismissed) {
                this.showInstallPrompt = true;
            }
        });
    },
    beforeUnmount() {
        window.removeEventListener("online", this.handleOnlineStatus);
        window.removeEventListener("offline", this.handleOfflineStatus);
    },
    methods: {
        handleOnlineStatus() {
            this.isOffline = false;
        },
        handleOfflineStatus() {
            this.isOffline = true;
            this.lastSyncTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
        triggerPwaInstall() {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                this.deferredPrompt.userChoice.then(() => {
                    this.deferredPrompt = null;
                    this.showInstallPrompt = false;
                });
            }
        },
        dismissInstallPrompt() {
            this.showInstallPrompt = false;
            localStorage.setItem("infininoc_pwa_dismissed", "true");
        },
    },
};
</script>

<style scoped>
.noc-offline-banner {
    position: sticky;
    top: 0;
    z-index: 1090;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.noc-install-banner {
    position: sticky;
    top: 0;
    z-index: 1085;
}
</style>
