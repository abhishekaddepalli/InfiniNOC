<template>
    <div class="http-checker-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="globe" class="text-primary" />
                    <span>HTTP / HTTPS Inspection Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Server Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-7">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target URL</label>
                        <input
                            v-model="targetUrl"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="https://httpbin.org/get or example.com"
                            @keydown.enter="runHttpCheck"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">HTTP Method</label>
                        <select v-model="httpMethod" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option value="GET">GET</option>
                            <option value="HEAD">HEAD</option>
                            <option value="POST">POST</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runHttpCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="globe" />
                            <span>{{ loading ? 'Inspecting...' : 'Inspect HTTP' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Performing HTTP request & header analysis...</h5>
            <div class="text-muted small font-monospace">Fetching {{ targetUrl }}</div>
        </div>

        <!-- HTTP Inspection Results Dashboard -->
        <div v-else-if="result" class="http-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">HTTP Response Summary</div>
                        <h3 class="fw-bold font-monospace text-primary mb-1">{{ result.url }}</h3>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge fs-6" :class="result.statusCode >= 200 && result.statusCode < 400 ? 'bg-success text-white' : 'bg-danger text-white'">
                                HTTP {{ result.statusCode }} {{ result.statusText }}
                            </span>
                            <span class="badge bg-secondary text-foreground font-monospace">Time: {{ result.totalTimeMs }} ms</span>
                            <span class="badge bg-info text-white font-monospace">Size: {{ (result.contentLength || 0).toLocaleString() }} Bytes</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Timing Breakdown Cards -->
            <div v-if="result.timingBreakdown" class="card bg-card border-secondary shadow-sm mb-4 p-4">
                <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2">Network Waterfall Timing Breakdown</h6>
                <div class="row text-center g-3 font-monospace">
                    <div class="col-6 col-md">
                        <div class="text-muted small">DNS Lookup</div>
                        <div class="fw-bold text-primary fs-5">{{ result.timingBreakdown.dnsMs }} ms</div>
                    </div>
                    <div class="col-6 col-md">
                        <div class="text-muted small">TCP Connect</div>
                        <div class="fw-bold text-info fs-5">{{ result.timingBreakdown.tcpMs }} ms</div>
                    </div>
                    <div class="col-6 col-md">
                        <div class="text-muted small">TLS Handshake</div>
                        <div class="fw-bold text-warning fs-5">{{ result.timingBreakdown.tlsMs }} ms</div>
                    </div>
                    <div class="col-6 col-md">
                        <div class="text-muted small">TTFB</div>
                        <div class="fw-bold text-success fs-5">{{ result.timingBreakdown.ttfbMs }} ms</div>
                    </div>
                    <div class="col-12 col-md">
                        <div class="text-muted small">Transfer</div>
                        <div class="fw-bold text-foreground fs-5">{{ result.timingBreakdown.transferMs }} ms</div>
                    </div>
                </div>
            </div>

            <!-- Response Headers Inspector -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    HTTP Response Headers Map
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace small">
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 30%;">HEADER NAME</th>
                                    <th style="width: 70%;">HEADER VALUE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(v, k) in result.headers" :key="k">
                                    <td class="fw-bold text-primary py-2 px-3">{{ k }}</td>
                                    <td class="text-foreground py-2 px-3 text-break">{{ v }}</td>
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
        tool: {
            type: Object,
            default: null,
        },
    },
    emits: ["history-updated"],
    data() {
        return {
            targetUrl: "https://httpbin.org/get",
            httpMethod: "GET",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runHttpCheck();
    },
    methods: {
        runHttpCheck() {
            if (!this.targetUrl.trim()) {
                this.$root.toastError("Please provide a target URL.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "http-checker",
                params: {
                    url: this.targetUrl.trim(),
                    method: this.httpMethod,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`HTTP ${res.result.statusCode} (${res.result.totalTimeMs}ms)`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute HTTP check.");
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
