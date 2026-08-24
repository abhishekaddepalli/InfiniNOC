<template>
    <div class="py-2">
        <!-- Subtitle Header -->
        <div class="mb-4">
            <h4 class="fw-bold text-foreground mb-1">About InfiniNOC</h4>
            <div class="text-muted small">Information about your InfiniNOC installation and system.</div>
        </div>

        <!-- Product Identity Hero Card -->
        <div class="card border-secondary bg-card mb-4 shadow-sm p-4">
            <div class="d-flex align-items-center flex-wrap flex-md-nowrap gap-4">
                <div class="hero-icon-container p-3 rounded-3 border border-secondary bg-card d-flex align-items-center justify-content-center flex-shrink-0">
                    <object width="80" height="80" data="/icon.svg" class="hero-logo" />
                </div>
                <div class="flex-grow-1">
                    <h3 class="fw-bold mb-1 text-foreground">{{ productConfig.productName || 'InfiniNOC' }}</h3>
                    <div class="text-muted fw-medium mb-3">{{ productConfig.tagline || 'Know Your Network. Before Your Customers Do.' }}</div>
                    <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
                        <span class="badge bg-secondary font-monospace px-3 py-1 text-foreground">v{{ productConfig.version || '1.0.0' }}</span>
                        <span class="badge bg-primary px-3 py-1">Stable</span>
                        <span class="badge bg-success text-white px-3 py-1">● Production</span>
                    </div>
                    <div class="small text-muted">Maintained by <strong>{{ productConfig.companyName || 'Infiniforge Technologies' }}</strong></div>
                </div>
            </div>
        </div>

        <!-- Update Status Card -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="sync-alt" class="text-warning" />
                    <span>Update Status</span>
                </div>
                <button class="btn btn-primary btn-sm fw-semibold d-flex align-items-center gap-2" :disabled="checking" @click="checkUpdates">
                    <font-awesome-icon icon="sync-alt" :class="{ 'fa-spin': checking }" />
                    <span>Check for Updates</span>
                </button>
            </div>
            <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" :class="updateInfo.updateAvailable ? 'bg-warning text-dark' : 'bg-success text-white'" style="width: 42px; height: 42px;">
                        <font-awesome-icon :icon="updateInfo.updateAvailable ? 'arrow-alt-circle-up' : 'check'" class="fs-5" />
                    </div>
                    <div>
                        <div class="fw-bold text-foreground">
                            {{ updateInfo.updateAvailable ? `● Update Available: InfiniNOC v${updateInfo.latestVersion}` : "✓ You're running the latest version." }}
                        </div>
                        <div class="small text-muted mt-1">
                            Last checked: {{ updateInfo.lastChecked ? formatDate(updateInfo.lastChecked) : 'Recently' }}
                        </div>
                    </div>
                </div>
                <router-link v-if="updateInfo.updateAvailable" to="/settings/updates" class="btn btn-warning btn-sm fw-bold">
                    View Update
                </router-link>
            </div>
        </div>

        <!-- System Information Grid -->
        <div id="system-info" class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center gap-2">
                <font-awesome-icon icon="server" class="text-info" />
                <span>System Information</span>
            </div>
            <div class="card-body p-4">
                <div class="row g-3">
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Application</div>
                            <div class="fs-6 fw-bold text-foreground mt-1">{{ productConfig.productName || 'InfiniNOC' }}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Version</div>
                            <div class="fs-6 fw-bold text-foreground font-monospace mt-1">v{{ productConfig.version || '1.0.0' }}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Environment</div>
                            <div class="fs-6 fw-bold text-success mt-1">Production</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Database</div>
                            <div class="fs-6 fw-bold text-foreground font-monospace mt-1">SQLite</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Schema</div>
                            <div class="fs-6 fw-bold text-foreground font-monospace mt-1">Knex v10</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Runtime</div>
                            <div class="fs-6 fw-bold text-foreground font-monospace mt-1">Node v24.16.0</div>
                        </div>
                    </div>
                    <div class="col-12 col-md-8 col-lg-6">
                        <div class="p-3 bg-card rounded border border-secondary shadow-sm">
                            <div class="text-muted small fw-semibold text-uppercase">Deployment</div>
                            <div class="fs-6 fw-bold text-primary mt-1">Docker Container / Coolify</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Clean Footer & Actions -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 p-3 bg-card border border-secondary rounded shadow-sm">
            <div class="small text-muted">© Infiniforge Technologies. Powered by Abhishek A.</div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="scrollToSystemInfo">
                    <font-awesome-icon icon="server" class="me-1" />
                    View System Information
                </button>
                <button class="btn btn-primary btn-sm fw-semibold" :disabled="checking" @click="checkUpdates">
                    <font-awesome-icon icon="sync-alt" class="me-1" :class="{ 'fa-spin': checking }" />
                    Check for Updates
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import productConfig from "../../../config/product.json";

export default {
    data() {
        return {
            productConfig,
            checking: false,
            updateInfo: {
                currentVersion: "1.0.0",
                latestVersion: "1.0.0",
                updateAvailable: false,
                lastChecked: null,
            },
        };
    },
    mounted() {
        this.fetchUpdateStatus();
    },
    methods: {
        fetchUpdateStatus() {
            this.$root.getSocket().emit("checkPlatformUpdates", { channel: "stable" }, (res) => {
                if (res && res.ok) {
                    this.updateInfo = res.updateInfo;
                }
            });
        },
        checkUpdates() {
            this.checking = true;
            this.$root.getSocket().emit("checkPlatformUpdates", { channel: "stable" }, (res) => {
                this.checking = false;
                if (res && res.ok) {
                    this.updateInfo = res.updateInfo;
                    this.$root.toastSuccess("Checked InfiniNOC release repository");
                }
            });
        },
        scrollToSystemInfo() {
            const el = document.getElementById("system-info");
            if (el) {
                el.scrollIntoView({ behavior: "smooth" });
            }
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
    },
};
</script>

<style scoped>
.hero-icon-container {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

@media (max-width: 767.98px) {
    .hero-logo {
        width: 60px;
        height: 60px;
    }
}

.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
