<template>
    <div class="noc-landing-page text-foreground">
        <!-- Navigation Header -->
        <nav class="navbar navbar-expand-lg border-bottom border-secondary px-3 px-md-5 py-3 sticky-top" style="background-color: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);">
            <div class="container-fluid">
                <router-link to="/" class="navbar-brand d-flex align-items-center gap-2 text-decoration-none">
                    <span class="fs-3 fw-bold text-warning">InfiniNOC</span>
                    <span class="badge bg-warning text-dark font-monospace">2.0</span>
                </router-link>

                <div class="d-flex align-items-center gap-3">
                    <router-link to="/dashboard" class="btn btn-outline-light fw-bold btn-sm px-3 py-2">
                        Dashboard
                    </router-link>
                    <router-link to="/onboarding" class="btn noc-cta-btn fw-bold btn-sm px-3 py-2">
                        Get Started Free
                    </router-link>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="py-5 text-center position-relative overflow-hidden">
            <div class="container py-5">
                <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill border border-warning text-warning small fw-bold mb-4" style="background-color: rgba(255, 153, 51, 0.1);">
                    <font-awesome-icon icon="rocket" />
                    <span>InfiniNOC 2.0 Commercial SaaS Platform Engine</span>
                </div>

                <h1 class="display-4 fw-extrabold text-foreground mb-3 mx-auto" style="max-width: 900px; font-weight: 800; line-height: 1.15;">
                    Next-Generation ISP & NOC <br />
                    <span class="text-warning">Telemetry Monitoring SaaS</span>
                </h1>

                <p class="fs-5 text-secondary mb-5 mx-auto" style="max-width: 700px;">
                    Sub-second ping telemetry, SNMP hardware stats, automated network topology dependency correlation, and multi-tenant governance built for modern ISPs.
                </p>

                <div class="d-flex justify-content-center gap-3 flex-wrap">
                    <router-link to="/onboarding" class="btn noc-cta-btn btn-lg fw-bold px-4 py-3 shadow-lg">
                        Start 14-Day Free Trial
                    </router-link>
                    <router-link to="/dashboard" class="btn btn-outline-secondary btn-lg fw-bold px-4 py-3">
                        Explore Live NOC Dashboard
                    </router-link>
                </div>
            </div>
        </section>

        <!-- 4 Feature Pillars Grid -->
        <section class="py-5 border-top border-secondary">
            <div class="container py-4">
                <div class="text-center mb-5">
                    <h2 class="h3 fw-bold text-warning mb-2">Built for ISP & Data Center Operations</h2>
                    <p class="text-secondary small">Engineered to prevent downtime, eliminate alert storms, and enforce enterprise SLAs.</p>
                </div>

                <div class="row g-4">
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="noc-pillar-card p-4 rounded-4 shadow-sm h-100 border-left-amber">
                            <font-awesome-icon icon="bolt" class="fs-2 text-warning mb-3" />
                            <h3 class="h5 fw-bold mb-2">Sub-Second Pings</h3>
                            <p class="text-secondary small mb-0">High-frequency ping intervals with immediate status notifications across distributed probes.</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="noc-pillar-card p-4 rounded-4 shadow-sm h-100 border-left-danger">
                            <font-awesome-icon icon="server" class="fs-2 text-danger mb-3" />
                            <h3 class="h5 fw-bold mb-2">SNMP Hardware Stats</h3>
                            <p class="text-secondary small mb-0">Direct OID telemetry for MikroTik, Cisco, Huawei OLTs, switches, and core routers.</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="noc-pillar-card p-4 rounded-4 shadow-sm h-100 border-left-info">
                            <font-awesome-icon icon="sitemap" class="fs-2 text-info mb-3" />
                            <h3 class="h5 fw-bold mb-2">Topology Correlation</h3>
                            <p class="text-secondary small mb-0">Upstream parent-child dependency modeling to suppress downstream alert storms during core outages.</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="noc-pillar-card p-4 rounded-4 shadow-sm h-100 border-left-success">
                            <font-awesome-icon icon="building" class="fs-2 text-success mb-3" />
                            <h3 class="h5 fw-bold mb-2">Multi-Tenant RBAC</h3>
                            <p class="text-secondary small mb-0">Isolated organization workspaces with strict role-based access control and quota enforcement.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Interactive Live SLA Downtime Calculator -->
        <section class="py-5 border-top border-secondary">
            <div class="container py-4">
                <div class="noc-calculator-box p-4 p-md-5 rounded-4 shadow-lg mx-auto" style="max-width: 850px;">
                    <div class="text-center mb-4">
                        <h2 class="h4 fw-bold text-warning mb-1">Interactive Downtime & SLA Calculator</h2>
                        <p class="text-secondary small">Calculate annual downtime minutes and estimated revenue risk based on target availability.</p>
                    </div>

                    <div class="row g-4 align-items-center">
                        <div class="col-12 col-md-6">
                            <label class="form-label text-secondary small fw-bold text-uppercase">Target Uptime SLA %</label>
                            <input
                                v-model.number="slaTarget"
                                type="range"
                                class="form-range"
                                min="99.0"
                                max="99.999"
                                step="0.001"
                            />
                            <div class="d-flex justify-content-between text-secondary fs-6 font-monospace">
                                <span>99.0%</span>
                                <span class="fw-bold text-warning fs-5">{{ slaTarget }}%</span>
                                <span>99.999%</span>
                            </div>

                            <div class="mt-4">
                                <label class="form-label text-secondary small fw-bold text-uppercase">Estimated Hourly Outage Cost ($)</label>
                                <input
                                    v-model.number="hourlyCost"
                                    type="number"
                                    class="form-control noc-input font-monospace"
                                    placeholder="e.g. 500"
                                />
                            </div>
                        </div>

                        <div class="col-12 col-md-6">
                            <div class="p-4 rounded-3 text-center border border-secondary" style="background-color: var(--secondary);">
                                <div class="text-secondary small fw-bold text-uppercase mb-1">Allowed Annual Downtime</div>
                                <div class="display-6 fw-bold text-warning font-monospace mb-3">{{ allowedDowntimeMinutes }} <span class="fs-6 text-muted">mins/yr</span></div>

                                <div class="text-secondary small fw-bold text-uppercase mb-1">Estimated Annual Financial Loss Risk</div>
                                <div class="h3 fw-bold text-danger font-monospace mb-0">${{ formattedFinancialLoss }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Pricing Tiers Section -->
        <section class="py-5 border-top border-secondary">
            <div class="container py-4">
                <div class="text-center mb-5">
                    <h2 class="h3 fw-bold text-warning mb-2">Transparent Commercial Pricing</h2>
                    <p class="text-secondary small">Flexible monthly subscriptions scaled for regional ISPs and enterprise NOC centers.</p>
                </div>

                <div class="row g-4">
                    <!-- Starter Plan -->
                    <div class="col-12 col-md-4">
                        <div class="noc-pricing-card p-4 rounded-4 shadow-sm h-100 d-flex flex-column justify-content-between">
                            <div>
                                <h3 class="h5 fw-bold text-foreground mb-1">Starter</h3>
                                <p class="text-secondary small mb-3">For small regional networks & startups.</p>
                                <div class="display-5 fw-bold text-warning mb-4">$29 <span class="fs-6 text-muted font-normal">/ mo</span></div>

                                <ul class="list-unstyled text-secondary small mb-4">
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 25 Monitors</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 10 Network Devices</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />5 Team Member Seats</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Email & Telegram Alerts</li>
                                </ul>
                            </div>
                            <router-link to="/onboarding" class="btn btn-outline-warning fw-bold w-100 py-2">
                                Choose Starter
                            </router-link>
                        </div>
                    </div>

                    <!-- Professional Plan -->
                    <div class="col-12 col-md-4">
                        <div class="noc-pricing-card p-4 rounded-4 shadow-sm h-100 d-flex flex-column justify-content-between border-warning position-relative" style="border-width: 2px;">
                            <div class="position-absolute top-0 end-0 translate-middle-y me-3">
                                <span class="badge bg-warning text-dark font-monospace fw-bold">MOST POPULAR</span>
                            </div>
                            <div>
                                <h3 class="h5 fw-bold text-warning mb-1">Professional</h3>
                                <p class="text-secondary small mb-3">For growing ISPs & multi-pop operators.</p>
                                <div class="display-5 fw-bold text-warning mb-4">$99 <span class="fs-6 text-muted font-normal">/ mo</span></div>

                                <ul class="list-unstyled text-secondary small mb-4">
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 250 Monitors</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Up to 100 Network Devices</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />25 Team Member Seats</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />MikroTik & OLT Integration</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Topology Correlation</li>
                                </ul>
                            </div>
                            <router-link to="/onboarding" class="btn noc-cta-btn fw-bold w-100 py-2">
                                Choose Professional
                            </router-link>
                        </div>
                    </div>

                    <!-- Enterprise Plan -->
                    <div class="col-12 col-md-4">
                        <div class="noc-pricing-card p-4 rounded-4 shadow-sm h-100 d-flex flex-column justify-content-between">
                            <div>
                                <h3 class="h5 fw-bold text-foreground mb-1">Enterprise</h3>
                                <p class="text-secondary small mb-3">For Tier-1 ISPs & data center operators.</p>
                                <div class="display-5 fw-bold text-warning mb-4">$299 <span class="fs-6 text-muted font-normal">/ mo</span></div>

                                <ul class="list-unstyled text-secondary small mb-4">
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Unlimited Monitors</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Unlimited Devices</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Unlimited Team Seats</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Custom Remote Probes</li>
                                    <li class="mb-2"><font-awesome-icon icon="check" class="text-success me-2" />Dedicated Super Admin SLA</li>
                                </ul>
                            </div>
                            <router-link to="/onboarding" class="btn btn-outline-warning fw-bold w-100 py-2">
                                Contact Sales
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="py-4 border-top border-secondary text-center text-secondary small">
            <div class="container d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    © 2026 InfiniNOC Inc. All rights reserved. Powered by customized Uptime Kuma monitoring engine.
                </div>
                <div class="d-flex gap-3">
                    <router-link to="/status" class="text-secondary text-decoration-none">Status Page</router-link>
                    <router-link to="/dashboard" class="text-secondary text-decoration-none">Console</router-link>
                    <router-link to="/onboarding" class="text-secondary text-decoration-none">Onboarding</router-link>
                </div>
            </div>
        </footer>
    </div>
</template>

<script>
export default {
    name: "NocMarketingLandingPage",
    data() {
        return {
            slaTarget: 99.9,
            hourlyCost: 500,
        };
    },
    computed: {
        allowedDowntimeMinutes() {
            const minutesInYear = 365.25 * 24 * 60; // 525,960 minutes
            const downtimePercent = 100 - this.slaTarget;
            return ((minutesInYear * downtimePercent) / 100).toFixed(1);
        },
        formattedFinancialLoss() {
            const downtimeHours = parseFloat(this.allowedDowntimeMinutes) / 60;
            const loss = downtimeHours * (this.hourlyCost || 0);
            return new Intl.NumberFormat().format(loss.toFixed(0));
        },
    },
};
</script>

<style scoped>
.noc-landing-page {
    background-color: var(--background);
    min-height: 100vh;
}

.noc-pillar-card,
.noc-calculator-box,
.noc-pricing-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    color: var(--card-foreground);
    transition: transform 0.2s ease-in-out;
}

.noc-pillar-card:hover,
.noc-pricing-card:hover {
    transform: translateY(-4px);
}

.border-left-amber { border-left: 4px solid #ff9933; }
.border-left-danger { border-left: 4px solid #dc2626; }
.border-left-info { border-left: 4px solid #0ea5e9; }
.border-left-success { border-left: 4px solid #10b981; }

.noc-cta-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
}

.noc-cta-btn:hover {
    opacity: 0.9;
    box-shadow: 0 0 15px rgba(255, 153, 51, 0.4);
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--input-text);
    border-radius: 8px;
}
</style>
