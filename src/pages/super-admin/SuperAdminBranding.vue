<template>
    <div class="super-admin-branding">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="paint-brush" class="text-info" />
                    <span>Platform Branding & White Label Control</span>
                </h3>
                <div class="text-muted small">
                    Configure platform-level branding, custom logo, favicon, application tagline, support links, and accent color themes.
                </div>
            </div>
            <button class="btn btn-primary fw-bold" @click="saveBranding">
                Save Branding Settings
            </button>
        </div>

        <div class="row g-4">
            <!-- Left: Identity & Logo -->
            <div class="col-12 col-md-6">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <h5 class="fw-bold text-primary mb-3">Application Identity & Logo</h5>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Custom Header Logo URL / Path</label>
                        <input v-model="form.logoUrl" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="/icon.svg or https://yourdomain.com/logo.png" />
                        <div class="form-text small text-muted">Direct image link to displayed header logo across tenant dashboards.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Custom Favicon URL</label>
                        <input v-model="form.faviconUrl" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="/favicon.ico" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Platform Name</label>
                        <input v-model="form.appName" type="text" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Tagline</label>
                        <input v-model="form.tagline" type="text" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Company Name</label>
                        <input v-model="form.companyName" type="text" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                </div>
            </div>

            <!-- Right: Color Palette & Links -->
            <div class="col-12 col-md-6">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <h5 class="fw-bold text-warning mb-3">Theme & Documentation URLs</h5>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Support Email</label>
                        <input v-model="form.supportEmail" type="email" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Support Portal URL</label>
                        <input v-model="form.supportUrl" type="url" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Documentation URL</label>
                        <input v-model="form.docsUrl" type="url" class="form-control bg-card border-secondary text-foreground" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Primary Accent Color</label>
                        <input v-model="form.primaryColor" type="color" class="form-control form-control-color w-100 bg-card border-secondary" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            form: {
                logoUrl: "/icon.svg",
                faviconUrl: "/favicon.ico",
                appName: "InfiniNOC",
                tagline: "Know Your Network. Before Your Customers Do.",
                companyName: "Infiniforge Technologies",
                supportEmail: "support@infiniforge.com",
                supportUrl: "https://infiniforge.com/support",
                docsUrl: "https://docs.infiniforge.com",
                primaryColor: "#ff9933",
            },
        };
    },
    mounted() {
        this.fetchBranding();
    },
    methods: {
        fetchBranding() {
            this.$root.getSocket().emit("getSuperAdminBranding", (res) => {
                if (res && res.ok && res.branding) {
                    this.form = { ...this.form, ...res.branding };
                }
            });
        },
        saveBranding() {
            this.$root.getSocket().emit("saveSuperAdminBranding", this.form, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("White label branding updated globally.");
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to update branding.");
                }
            });
        },
    },
};
</script>
