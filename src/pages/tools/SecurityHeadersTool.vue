<template>
    <div class="security-headers-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="shield-alt" class="text-primary" />
                    <span>HTTP Header Security & Hardening Inspector</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Security Score Grade</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target URL or Domain</label>
                        <input
                            v-model="urlInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. https://spidecloud.in or google.com"
                            @keydown.enter="runCheck"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Analyzing...' : 'Scan Headers' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Audit Dashboard -->
        <div v-if="result" class="security-headers-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Security Score Grade</div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="badge fs-1 px-4 py-2" :class="result.gradeBadgeClass">{{ result.grade }}</span>
                            <div>
                                <div class="fw-bold text-foreground font-monospace fs-5">Score: {{ result.score }} / 100</div>
                                <div class="text-muted small">HTTP Status: {{ result.status }} {{ result.statusText }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="text-end font-monospace">
                        <div class="small text-muted">Target Host IP</div>
                        <div class="fs-6 fw-bold text-primary">{{ result.resolvedIp }}</div>
                    </div>
                </div>
            </div>

            <!-- Header Audit Table -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    Security Header Audit Breakdown
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>SECURITY HEADER</th>
                                    <th>STATUS</th>
                                    <th>HEADER VALUE / RECOMMENDATION</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(h, idx) in result.headerAuditList" :key="idx">
                                    <td class="fw-bold text-foreground py-3 px-3">{{ h.name }}</td>
                                    <td class="py-3 px-3">
                                        <span class="badge" :class="h.present ? 'bg-success' : 'bg-danger'">
                                            {{ h.present ? 'PRESENT' : 'MISSING' }}
                                        </span>
                                    </td>
                                    <td class="py-3 px-3">
                                        <div class="fw-semibold text-break" :class="h.present ? 'text-primary' : 'text-muted'">
                                            {{ h.value }}
                                        </div>
                                        <div class="small text-muted opacity-75 mt-1">💡 {{ h.recommendation }}</div>
                                    </td>
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
    props: {
        tool: { type: Object, default: null },
    },
    emits: ["history-updated"],
    data() {
        return {
            urlInput: "spidecloud.in",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runCheck();
    },
    methods: {
        runCheck() {
            if (!this.urlInput.trim()) {
                this.$root.toastError("Please enter a target URL or domain.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "security-headers",
                params: {
                    url: this.urlInput.trim(),
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && (res.result || res.grade)) {
                    this.result = res.result || res;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Scanned HTTP security headers for ${this.urlInput}`);
                } else {
                    this.$root.toastError((res && res.error) || (res && res.msg) || "Failed to scan security headers.");
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
