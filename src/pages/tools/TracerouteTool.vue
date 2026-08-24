<template>
    <div class="traceroute-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="route" class="text-primary" />
                    <span>Traceroute Hop Diagnostics</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Server Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 8.8.8.8 or example.com"
                            @keydown.enter="runTraceroute"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runTraceroute"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="route" />
                            <span>{{ loading ? 'Tracing Route...' : 'Start Traceroute' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Tracing network hop path...</h5>
            <div class="text-muted small font-monospace">Probing path to {{ targetHost }}</div>
        </div>

        <!-- Traceroute Hop Table Dashboard -->
        <div v-else-if="result" class="traceroute-results-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Path Hop Diagnostics — {{ result.host }} ({{ result.resolvedIp }})</span>
                    <span class="badge bg-primary font-monospace">{{ result.totalHops }} Hops</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 8%;">HOP</th>
                                    <th style="width: 25%;">HOP IP ADDRESS</th>
                                    <th style="width: 45%;">REVERSE DNS / HOSTNAME</th>
                                    <th style="width: 22%;">PROBE LATENCIES</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="h in result.hops" :key="h.hop">
                                    <td class="fw-bold text-muted">#{{ h.hop }}</td>
                                    <td class="fw-bold text-primary">{{ h.ip }}</td>
                                    <td class="text-foreground">{{ h.ptr }}</td>
                                    <td>
                                        <span class="badge bg-secondary-subtle border border-secondary text-foreground me-1">{{ h.rtt1 }} ms</span>
                                        <span class="badge bg-secondary-subtle border border-secondary text-foreground me-1">{{ h.rtt2 }} ms</span>
                                        <span class="badge bg-secondary-subtle border border-secondary text-foreground">{{ h.rtt3 }} ms</span>
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
        tool: {
            type: Object,
            default: null,
        },
    },
    emits: ["history-updated"],
    data() {
        return {
            targetHost: "8.8.8.8",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runTraceroute();
    },
    methods: {
        runTraceroute() {
            if (!this.targetHost.trim()) {
                this.$root.toastError("Please provide a target host.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "traceroute",
                params: { host: this.targetHost.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Traceroute path completed (${res.result.totalHops} hops)`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute traceroute.");
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
