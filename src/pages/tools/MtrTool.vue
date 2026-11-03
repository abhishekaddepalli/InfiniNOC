<template>
    <div class="mtr-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="chart-line" class="text-primary" />
                    <span>MTR Continuous Path Analysis</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Continuous Hop Diagnostics</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1 or example.com"
                            @keydown.enter="runMtr"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Probe Cycles</label>
                        <select v-model="cycles" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option :value="3">3 Cycles (Fast)</option>
                            <option :value="5">5 Cycles (Standard)</option>
                            <option :value="10">10 Cycles (Deep)</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runMtr"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Analyzing Path...' : 'Start MTR' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Performing continuous path latency analysis...</h5>
            <div class="text-muted small font-monospace">Tracing hops & executing {{ cycles }} probe cycles to {{ targetHost }}</div>
        </div>

        <div v-else-if="result" class="mtr-results-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>MTR Path Statistics — {{ result.host }} ({{ result.resolvedIp }})</span>
                    <span class="badge bg-primary font-monospace">{{ result.cycles }} Cycles · {{ result.totalHops }} Hops</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>HOP</th>
                                    <th>HOST / IP</th>
                                    <th>LOSS %</th>
                                    <th>SENT</th>
                                    <th>RECV</th>
                                    <th>BEST</th>
                                    <th>AVG</th>
                                    <th>WORST</th>
                                    <th>STDEV</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="h in result.hops" :key="h.hop">
                                    <td class="fw-bold text-muted">#{{ h.hop }}</td>
                                    <td>
                                        <div class="fw-bold text-primary">{{ h.ip }}</div>
                                        <div class="small text-muted text-truncate" style="max-width: 250px;">{{ h.hostname }}</div>
                                    </td>
                                    <td>
                                        <span class="badge" :class="h.lossPercent === 0 ? 'bg-success' : (h.lossPercent < 50 ? 'bg-warning text-dark' : 'bg-danger')">
                                            {{ h.lossPercent }}%
                                        </span>
                                    </td>
                                    <td>{{ h.sent }}</td>
                                    <td>{{ h.received }}</td>
                                    <td class="text-success">{{ h.bestMs }} ms</td>
                                    <td class="fw-bold">{{ h.avgMs }} ms</td>
                                    <td class="text-danger">{{ h.worstMs }} ms</td>
                                    <td class="text-muted">±{{ h.stdevMs }}</td>
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
            targetHost: "1.1.1.1",
            cycles: 5,
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runMtr();
    },
    methods: {
        runMtr() {
            if (!this.targetHost.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "mtr",
                params: {
                    host: this.targetHost.trim(),
                    cycles: this.cycles,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`MTR path analysis completed for ${res.result.host}`);
                } else {
                    this.$root.toastError((res && res.msg) || "MTR execution failed.");
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
