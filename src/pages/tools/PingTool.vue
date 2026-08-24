<template>
    <div class="ping-tool">
        <!-- Form Input Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="network-wired" class="text-primary" />
                    <span>Ping Probe Parameters</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Server Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-7">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1, 8.8.8.8, or example.com"
                            @keydown.enter="runPing"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Probe Count</label>
                        <select v-model="probeCount" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option :value="4">4 Packets</option>
                            <option :value="6">6 Packets</option>
                            <option :value="10">10 Packets</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runPing"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Pinging Target...' : 'Run Ping Test' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Sending ICMP / TCP ping probes...</h5>
            <div class="text-muted small font-monospace">Probing {{ targetHost }} ({{ probeCount }} packets)</div>
        </div>

        <!-- Ping Results Dashboard -->
        <div v-else-if="result" class="ping-results-dashboard">
            <!-- Summary Metric Cards -->
            <div class="row g-4 mb-4">
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Packet Loss</div>
                        <div class="fs-2 fw-bold font-monospace" :class="result.lossPercent === 0 ? 'text-success' : 'text-danger'">
                            {{ result.lossPercent }}%
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Avg Latency</div>
                        <div class="fs-2 fw-bold font-monospace text-primary">{{ result.avgMs }} ms</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Min / Max RTT</div>
                        <div class="fs-4 fw-bold font-monospace text-foreground mt-1">{{ result.minMs }} / {{ result.maxMs }} ms</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Jitter</div>
                        <div class="fs-2 fw-bold font-monospace text-info">{{ result.jitterMs }} ms</div>
                    </div>
                </div>
            </div>

            <!-- Probe Sequence Table -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Probe Sequence Timeline</span>
                    <span class="font-monospace small text-muted">Target IP: {{ result.resolvedIp }}</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>SEQ</th>
                                    <th>DESTINATION IP</th>
                                    <th>PAYLOAD</th>
                                    <th>LATENCY</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in result.probes" :key="p.sequence">
                                    <td class="fw-bold">#{{ p.sequence }}</td>
                                    <td class="text-primary">{{ p.ip }}</td>
                                    <td class="text-muted">{{ p.bytes }} bytes</td>
                                    <td class="fw-bold">{{ p.timeMs }} ms</td>
                                    <td>
                                        <span class="badge" :class="p.status === 'SUCCESS' ? 'bg-success text-white' : 'bg-danger text-white'">
                                            {{ p.status }}
                                        </span>
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
            targetHost: "1.1.1.1",
            probeCount: 4,
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runPing();
    },
    methods: {
        runPing() {
            if (!this.targetHost.trim()) {
                this.$root.toastError("Please provide a target host or IP.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ping",
                params: {
                    host: this.targetHost.trim(),
                    count: this.probeCount,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Pinged ${res.result.host} (${res.result.avgMs}ms avg, ${res.result.lossPercent}% loss)`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute ping test.");
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
