<template>
    <div class="manage-branding p-3 p-md-4">
        <!-- Top Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h3 fw-bold mb-1 text-light d-flex align-items-center gap-2">
                    <font-awesome-icon icon="paint-brush" class="text-warning" />
                    <span>Organization White Labeling & Theme Tokens</span>
                </h1>
                <p class="text-secondary small mb-0">Configure company identity, CSS theme color tokens, custom login copy, email headers, status page branding, and custom domain bindings.</p>
            </div>
            <div>
                <button class="btn btn-warning fw-bold px-4" @click="saveBranding()">
                    <font-awesome-icon icon="save" class="me-1" /> Save Branding Settings
                </button>
            </div>
        </div>

        <div class="row g-4">
            <!-- Left Column: Settings Controls -->
            <div class="col-12 col-lg-7">
                <!-- Company Identity Box -->
                <div class="noc-section-box p-3 mb-4 shadow-sm">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="building" />
                        <span>Company Identity & Assets</span>
                    </h5>
                    <div class="mb-3">
                        <label class="form-label text-secondary small">Company / Organization Display Name</label>
                        <input v-model="form.companyName" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Infiniforge Networks Ltd" />
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label text-secondary small">Custom Logo Image URL</label>
                            <input v-model="form.logoUrl" type="text" class="form-control bg-dark text-light border-secondary" placeholder="https://cdn.example.com/logo.png" />
                        </div>
                        <div class="col-6">
                            <label class="form-label text-secondary small">Custom Favicon URL</label>
                            <input v-model="form.faviconUrl" type="text" class="form-control bg-dark text-light border-secondary" placeholder="https://cdn.example.com/favicon.ico" />
                        </div>
                    </div>
                </div>

                <!-- Theme Color Tokens (Safe CSS Tokens) -->
                <div class="noc-section-box p-3 mb-4 shadow-sm">
                    <h5 class="fw-bold text-info mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="palette" />
                        <span>CSS Theme Color Tokens (Safe Theme Tokens)</span>
                    </h5>
                    <p class="small text-secondary mb-3">Styles are safely applied via CSS Custom Properties (<code>--noc-brand-primary</code>, <code>--noc-brand-secondary</code>). Arbitrary unvalidated CSS injection is strictly blocked.</p>
                    <div class="row g-3">
                        <div class="col-6">
                            <label class="form-label text-secondary small">Primary Brand Color Token</label>
                            <div class="d-flex align-items-center gap-2">
                                <input v-model="form.primaryColor" type="color" class="form-control form-control-color bg-dark border-secondary" />
                                <input v-model="form.primaryColor" type="text" class="form-control bg-dark text-light border-secondary font-monospace" placeholder="#f59e0b" />
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="form-label text-secondary small">Secondary Brand Color Token</label>
                            <div class="d-flex align-items-center gap-2">
                                <input v-model="form.secondaryColor" type="color" class="form-control form-control-color bg-dark border-secondary" />
                                <input v-model="form.secondaryColor" type="text" class="form-control bg-dark text-light border-secondary font-monospace" placeholder="#0284c7" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Login Page Branding -->
                <div class="noc-section-box p-3 mb-4 shadow-sm">
                    <h5 class="fw-bold text-light mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="sign-in-alt" />
                        <span>Login Page Branding</span>
                    </h5>
                    <div class="mb-3">
                        <label class="form-label text-secondary small">Login Header Title</label>
                        <input v-model="form.loginTitle" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Infiniforge NOC Operations Center" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary small">Login Subtitle / Notice</label>
                        <input v-model="form.loginSubtitle" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Authorized Technical Staff Only" />
                    </div>
                </div>

                <!-- Email & Status Page Branding -->
                <div class="noc-section-box p-3 mb-4 shadow-sm">
                    <h5 class="fw-bold text-success mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="envelope-open-text" />
                        <span>Email & Status Page Custom Copy</span>
                    </h5>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label text-secondary small">Email Notification Header</label>
                            <input v-model="form.emailHeaderText" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Infiniforge NOC Alert" />
                        </div>
                        <div class="col-6">
                            <label class="form-label text-secondary small">Email Notification Footer</label>
                            <input v-model="form.emailFooterText" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Confidential Operations Notice" />
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label text-secondary small">Status Page Title</label>
                        <input v-model="form.statusPageTitle" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Infiniforge Live Infrastructure Status" />
                    </div>
                </div>

                <!-- Domain Binding Stubs -->
                <div class="noc-section-box p-3 shadow-sm">
                    <h5 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="globe" />
                        <span>Custom Domain Binding Architecture (Stubs Prepared)</span>
                    </h5>
                    <p class="small text-secondary mb-3">Configure domain resolution routing for tenant status pages and operations dashboard.</p>
                    <div class="row g-2">
                        <div class="col-6">
                            <label class="form-label text-secondary small">Operations Dashboard Domain</label>
                            <input v-model="form.customDomain" type="text" class="form-control bg-dark text-light border-secondary font-monospace" placeholder="noc.mycompany.com" />
                        </div>
                        <div class="col-6">
                            <label class="form-label text-secondary small">Public Status Page Domain</label>
                            <input v-model="form.customStatusDomain" type="text" class="form-control bg-dark text-light border-secondary font-monospace" placeholder="status.mycompany.com" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Live Branding Preview & Attribution Notice -->
            <div class="col-12 col-lg-5">
                <!-- Live Theme Tokens Preview Card -->
                <div class="noc-section-box p-4 mb-4 shadow-sm">
                    <h6 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="eye" />
                        <span>Live Brand & Theme Preview</span>
                    </h6>

                    <div class="p-3 rounded mb-3 text-center border" :style="{ backgroundColor: '#0f172a', borderColor: form.primaryColor }">
                        <div class="fs-4 fw-bold mb-1" :style="{ color: form.primaryColor }">
                            {{ form.companyName || 'InfiniNOC Platform' }}
                        </div>
                        <span class="badge px-3 py-2 text-white font-monospace" :style="{ backgroundColor: form.secondaryColor }">
                            Primary Action Button Preview
                        </span>
                    </div>

                    <div class="p-3 rounded bg-dark border border-secondary mb-3">
                        <div class="small fw-bold text-uppercase mb-1" :style="{ color: form.primaryColor }">
                            {{ form.loginTitle || 'InfiniNOC Operations Center' }}
                        </div>
                        <div class="small text-secondary">{{ form.loginSubtitle || 'Secure Telemetry Portal' }}</div>
                    </div>

                    <div class="p-3 rounded bg-dark border border-secondary">
                        <div class="small fw-bold text-info mb-1">{{ form.emailHeaderText || 'NOC Alert Header' }}</div>
                        <div class="small text-secondary">Operational alert message preview...</div>
                        <div class="small text-muted border-top border-secondary pt-2 mt-2 font-monospace">{{ form.emailFooterText || 'Email Footer Notice' }}</div>
                    </div>
                </div>

                <!-- Mandatory License & Attribution Footer Box -->
                <div class="noc-section-box p-4 shadow-sm border-start border-4 border-warning">
                    <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="shield-alt" />
                        <span>Mandatory License & Attribution Retention</span>
                    </h6>
                    <p class="small text-secondary mb-3">InfiniNOC remains the core underlying product architecture. Open-source licenses and mandatory attribution notices are preserved across all custom branded views.</p>

                    <div class="p-3 rounded bg-dark font-monospace text-center small text-secondary">
                        <span>Powered by <strong class="text-light">InfiniNOC Monitoring Architecture</strong></span><br/>
                        <span style="font-size: 0.75rem;">Underlying Engine © Infiniforge Technologies</span>
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
                companyName: "InfiniNOC Platform",
                logoUrl: "",
                faviconUrl: "",
                primaryColor: "#f59e0b",
                secondaryColor: "#0284c7",
                loginTitle: "InfiniNOC Operations Center",
                loginSubtitle: "Secure High-Availability Telemetry & Incident Portal",
                emailHeaderText: "InfiniNOC Operations Telemetry",
                emailFooterText: "Confidential — Infiniforge Technologies NOC",
                statusPageTitle: "System Operational Status",
                statusPageFooter: "Powered by InfiniNOC Monitoring Engine",
                customDomain: "",
                customStatusDomain: "",
            },
        };
    },
    mounted() {
        this.loadBranding();
    },
    methods: {
        loadBranding() {
            this.$root.getSocket().emit("getOrganizationBranding", (res) => {
                if (res && res.ok && res.branding) {
                    const b = res.branding;
                    this.form = {
                        companyName: b.company_name,
                        logoUrl: b.logo_url || "",
                        faviconUrl: b.favicon_url || "",
                        primaryColor: b.primary_color || "#f59e0b",
                        secondaryColor: b.secondary_color || "#0284c7",
                        loginTitle: b.login_title || "InfiniNOC Operations Center",
                        loginSubtitle: b.login_subtitle || "Secure Portal",
                        emailHeaderText: b.email_header_text || "InfiniNOC Telemetry",
                        emailFooterText: b.email_footer_text || "Confidential NOC",
                        statusPageTitle: b.status_page_title || "System Status",
                        statusPageFooter: b.status_page_footer || "Powered by InfiniNOC Monitoring Engine",
                        customDomain: b.custom_domain || "",
                        customStatusDomain: b.custom_status_domain || "",
                    };
                    this.applyThemeTokens(res.themeTokens);
                }
            });
        },
        saveBranding() {
            this.$root.getSocket().emit("saveOrganizationBranding", this.form, (res) => {
                if (res && res.ok) {
                    alert("Organization branding settings saved successfully!");
                    this.applyThemeTokens(res.themeTokens);
                } else if (res && res.msg) {
                    alert(`Error: ${res.msg}`);
                }
            });
        },
        applyThemeTokens(tokens) {
            if (tokens) {
                for (const [key, val] of Object.entries(tokens)) {
                    document.documentElement.style.setProperty(key, val);
                }
            }
        },
    },
};
</script>

<style scoped>
.manage-branding {
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
}

.noc-section-box {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
