<template>
    <div class="redirect-checker-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="directions" class="text-primary" />
                    <span>HTTP Redirect Chain Tracer</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Hop-by-Hop Trace</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target URL</label>
                        <input
                            v-model="targetUrl"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. http://google.com or https://bit.ly/example"
                            @keydown.enter="runTrace"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runTrace"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Tracing...' : 'Trace Redirects' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Following HTTP redirect hops...</h5>
            <div class="text-muted small font-monospace">Auditing 301/302 status codes & destination headers for {{ targetUrl }}</div>
        </div>

        <div v-else-if="result" class="redirect-results-dashboard">
            <div class="card bg-card border-secondary shadow-sm p-4 mb-4">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <div class="fw-bold text-foreground">
                            {{ result.redirectCount === 0 ? 'Direct Endpoint (No Redirects)' : `${result.redirectCount} Redirect Hop(s) Detected` }}
                        </div>
                        <div class="small font-monospace text-primary text-break mt-1">Final Destination: {{ result.finalDestination }}</div>
                    </div>
                    <span class="badge bg-secondary font-monospace px-3 py-2 text-uppercase">{{ result.status }}</span>
                </div>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    <span>Redirect Hop Chain</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>HOP</th>
                                    <th>STATUS</th>
                                    <th>REQUESTED URL</th>
                                    <th>REDIRECT TARGET (LOCATION)</th>
                                    <th>LATENCY</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="h in result.chain" :key="h.hop">
                                    <td class="fw-bold text-muted">#{{ h.hop }}</td>
                                    <td>
                                        <span class="badge" :class="[301, 308].includes(h.statusCode) ? 'bg-primary' : ([302, 307].includes(h.statusCode) ? 'bg-warning text-dark' : 'bg-success')">
                                            {{ h.statusCode || 'ERR' }}
                                        </span>
                                    </td>
                                    <td class="text-break small text-foreground" style="max-width: 300px;">{{ h.url }}</td>
                                    <td class="text-break small text-primary" style="max-width: 300px;">{{ h.location || 'Final Endpoint' }}</td>
                                    <td>{{ h.rttMs }} ms</td>
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
            targetUrl: "http://google.com",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runTrace();
    },
    methods: {
        runTrace() {
            if (!this.targetUrl.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "redirect-checker",
                params: { url: this.targetUrl.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Traced ${res.result.redirectCount} redirects`);
                } else {
                    this.$root.toastError((res && res.msg) || "Redirect trace failed.");
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
