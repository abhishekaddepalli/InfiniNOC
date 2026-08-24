<template>
    <div class="third-party-notices-container p-4">
        <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom border-secondary-subtle">
            <div>
                <h3 class="fw-bold mb-1" style="color: var(--foreground);">Third-Party & Licensing Notices</h3>
                <p class="text-secondary small mb-0">Legal attribution & open-source origin disclosures for {{ productConfig.productName }}</p>
            </div>
            <router-link to="/settings/about" class="btn btn-outline-secondary btn-sm">
                <font-awesome-icon icon="arrow-left" class="me-1" /> Back to About
            </router-link>
        </div>

        <div class="card bg-card border-secondary-subtle p-4 shadow-sm mb-4">
            <h5 class="fw-bold mb-3 text-warning">Origin Statement & Notice</h5>
            <p class="text-foreground">
                <strong>{{ productConfig.productName }}</strong> is a modified and independently maintained commercial monitoring platform derived from open-source <strong>Uptime Kuma core engine</strong>.
            </p>
            <div class="row g-3 my-2 text-secondary small">
                <div class="col-md-4">
                    <span class="d-block text-muted">Original Project:</span>
                    <strong class="text-foreground">Uptime Kuma</strong>
                </div>
                <div class="col-md-4">
                    <span class="d-block text-muted">Original Author:</span>
                    <strong class="text-foreground">Louis Lam</strong>
                </div>
                <div class="col-md-4">
                    <span class="d-block text-muted">Original License:</span>
                    <strong class="text-foreground">MIT License</strong>
                </div>
            </div>
        </div>

        <div class="card bg-card border-secondary-subtle p-4 shadow-sm mb-4">
            <h5 class="fw-bold mb-3 text-foreground">Original MIT License Notice</h5>
            <pre class="bg-dark text-light p-3 rounded font-monospace small mb-0 overflow-auto" style="max-height: 250px;">
MIT License

Copyright (c) 2021 Louis Lam

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files ("Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
            </pre>
        </div>

        <div class="card bg-card border-secondary-subtle p-4 shadow-sm">
            <h5 class="fw-bold mb-3 text-foreground">{{ productConfig.companyName }} Commercial Enhancements</h5>
            <ul class="text-secondary mb-0">
                <li class="mb-2"><strong class="text-foreground">Multi-Tenant Organization Workspaces:</strong> Strict database isolation for customer tenant spaces.</li>
                <li class="mb-2"><strong class="text-foreground">Server-Side Role-Based Access Control (RBAC):</strong> Role permissions matrix (Owner, Admin, Operator, Viewer).</li>
                <li class="mb-2"><strong class="text-foreground">Enterprise SLA & Incidents Operations:</strong> Lifecycle incident management with MTTR calculations and P1-P4 severity badging.</li>
                <li class="mb-2"><strong class="text-foreground">Network Hardware Telemetry:</strong> SNMP monitoring engine for MikroTik routers, Cisco switches, and Huawei OLTs.</li>
                <li class="mb-2"><strong class="text-foreground">Upstream/Downstream Alert Storm Suppression:</strong> Parent-child network topology dependency link modeling.</li>
                <li class="mb-2"><strong class="text-foreground">SaaS Quotas & Razorpay Billing:</strong> Quota meter gauges, tier plans (Starter, Professional, Enterprise), and payment integration.</li>
                <li class="mb-0"><strong class="text-foreground">InfiniNOC 2.0 Design System:</strong> Saffron theme token palette, Inter typography, and responsive modern application shell.</li>
            </ul>
        </div>
    </div>
</template>

<script>
import productConfig from "../../../config/product.json";

export default {
    data() {
        return {
            productConfig,
        };
    },
};
</script>

<style scoped>
.bg-card {
    background-color: var(--card, #1e293b);
}
.text-foreground {
    color: var(--foreground, #f8fafc);
}
</style>
