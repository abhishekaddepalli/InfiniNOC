<template>
    <div class="dns-health-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="heartbeat" class="text-primary" />
                    <span>DNS Health & RFC Compliance Audit</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Authoritative Audit</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Domain Name</label>
                        <input
                            v-model="domain"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. google.com or cloudflare.com"
                            @keydown.enter="runHealthCheck"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runHealthCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Auditing DNS...' : 'Audit DNS Health' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Auditing authoritative name servers & SOA...</h5>
            <div class="text-muted small font-monospace">Validating NS dispersion, SOA serials, MX & SPF for {{ domain }}</div>
        </div>

        <div v-else-if="result" class="dns-health-dashboard">
            <!-- Score Banner -->
            <div class="card bg-card border-secondary shadow-sm p-4 mb-4">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div class="d-flex align-items-center gap-4">
                        <div class="display-5 fw-bold font-monospace" :class="result.healthScore >= 80 ? 'text-success' : (result.healthScore >= 50 ? 'text-warning' : 'text-danger')">
                            {{ result.healthScore }}/100
                        </div>
                        <div>
                            <h5 class="fw-bold text-foreground mb-1">Overall DNS Health: {{ result.status }}</h5>
                            <div class="text-muted small">Domain: {{ result.domain }} · Audited {{ result.checks.length }} critical DNS checks</div>
                        </div>
                    </div>
                    <div class="badge bg-secondary font-monospace px-3 py-2 text-uppercase">
                        {{ result.nameServers.length }} Authoritative NS
                    </div>
                </div>
            </div>

            <!-- Audit Checklist Table -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    <span>DNS Health Verification Checklist</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>CHECK CATEGORY</th>
                                    <th>RESULT STATUS</th>
                                    <th>DETAILED OBSERVATION</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(c, idx) in result.checks" :key="idx">
                                    <td class="fw-bold text-foreground">{{ c.name }}</td>
                                    <td>
                                        <span class="badge" :class="c.status === 'PASS' ? 'bg-success' : (c.status === 'WARN' ? 'bg-warning text-dark' : (c.status === 'INFO' ? 'bg-info text-dark' : 'bg-danger'))">
                                            {{ c.status }}
                                        </span>
                                    </td>
                                    <td class="small text-muted">{{ c.detail }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: { tool: { type: Object, default: null } },
    emits: ["history-updated"],
    data() {
        return {
            domain: "google.com",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runHealthCheck();
    },
    methods: {
        runHealthCheck() {
            if (!this.domain.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "dns-health",
                params: { domain: this.domain.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`DNS audit score for ${res.result.domain}: ${res.result.healthScore}/100`);
                } else {
                    this.$root.toastError((res && res.msg) || "DNS health check failed.");
                }
            });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
