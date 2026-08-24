<template>
    <div class="saas-landing-page min-vh-100 bg-dark text-white d-flex flex-column">
        <!-- Top Navigation Bar -->
        <header class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary px-4 py-3 sticky-top">
            <div class="container d-flex align-items-center justify-content-between">
                <router-link to="/" class="d-flex align-items-center gap-2 text-decoration-none">
                    <object width="36" height="36" data="/icon.svg" />
                    <span class="fw-bold text-primary fs-4">InfiniNOC</span>
                </router-link>

                <div class="d-flex align-items-center gap-3">
                    <router-link to="/login" class="btn btn-outline-light fw-bold px-3">Login</router-link>
                    <router-link to="/signup" class="btn btn-warning fw-bold px-4">Start Free Trial</router-link>
                </div>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="py-5 px-3 text-center my-auto">
            <div class="container py-4">
                <span class="badge bg-warning text-dark font-monospace text-uppercase mb-3 px-3 py-2 fs-6">
                    Enterprise NOC & Network Intelligence
                </span>
                <h1 class="display-3 fw-extrabold text-white mb-3">
                    Know Your Network.<br />
                    <span class="text-primary">Before Your Customers Do.</span>
                </h1>
                <p class="lead text-secondary max-w-2xl mx-auto mb-4" style="max-width: 700px;">
                    Complete cloud-native NOC monitoring platform built for ISPs, MSPs, and IT infrastructure teams. Monitor SNMP routers, OLT optical power, TLS security, and global DNSBL blacklists in real-time.
                </p>
                <div class="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                    <router-link to="/signup" class="btn btn-warning btn-lg fw-bold px-5 py-3 shadow-lg">
                        Start 14-Day Free Trial ↗
                    </router-link>
                    <router-link to="/login" class="btn btn-outline-light btn-lg fw-semibold px-4 py-3">
                        View Live Dashboard Demo
                    </router-link>
                </div>
            </div>
        </section>

        <!-- Feature Grid -->
        <section class="py-5 bg-card border-top border-secondary">
            <div class="container py-4">
                <div class="text-center mb-5">
                    <h2 class="fw-bold text-white mb-2">Engineered for Enterprise Network Operations</h2>
                    <p class="text-secondary small">Real-time telemetry, automated incident detection, and multi-tenant governance.</p>
                </div>

                <div class="row g-4">
                    <div class="col-12 col-md-4">
                        <div class="p-4 bg-dark border border-secondary rounded-3 h-100">
                            <font-awesome-icon icon="network-wired" class="fs-1 text-primary mb-3" />
                            <h4 class="fw-bold text-white">SNMP & MikroTik Monitoring</h4>
                            <p class="text-secondary small">Automated SNMP interface traffic polling, CPU/RAM telemetry, and MikroTik RouterOS capabilities.</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-4">
                        <div class="p-4 bg-dark border border-secondary rounded-3 h-100">
                            <font-awesome-icon icon="project-diagram" class="fs-1 text-warning mb-3" />
                            <h4 class="fw-bold text-white">GPON / EPON OLT Telemetry</h4>
                            <p class="text-secondary small">Optical Power (Tx/Rx) monitor, ONU/ONT count metrics, and vendor adapter compatibility (Huawei, ZTE, V-SOL).</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-4">
                        <div class="p-4 bg-dark border border-secondary rounded-3 h-100">
                            <font-awesome-icon icon="shield-alt" class="fs-1 text-success mb-3" />
                            <h4 class="fw-bold text-white">23+ DNSBL Blacklist Checker</h4>
                            <p class="text-secondary small">Parallel DNSBL lookup across Spamhaus, Mailspike, Barracuda, Spamcop, SORBS, and UCEPROTECT with delisting action plans.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="py-4 bg-dark border-top border-secondary text-center text-muted small mt-auto">
            <div class="container">
                <div>© 2026 InfiniNOC by Infiniforge Technologies. All rights reserved.</div>
            </div>
        </footer>
    </div>
</template>
