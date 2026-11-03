<template>
    <div class="mtu-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="arrows-alt-h" class="text-primary" />
                    <span>Path MTU Discovery (DF Bit Testing)</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Don't Fragment Testing</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Destination Host / IP</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1, 8.8.8.8, or example.com"
                            @keydown.enter="runMtuTest"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runMtuTest"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Testing MTU...' : 'Discover MTU' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Testing Path MTU with DF bit set...</h5>
            <div class="text-muted small font-monospace">Evaluating packet sizes across 1280 to 1500 bytes for {{ targetHost }}</div>
        </div>

        <div v-else-if="result" class="mtu-results-dashboard">
            <div class="row g-3 mb-4">
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Discovered Path MTU</div>
                        <div class="fs-1 fw-bold font-monospace text-primary">
                            {{ result.discoveredPathMtu }} Bytes
                        </div>
                        <div class="small text-muted mt-1 font-monospace">Payload: {{ result.discoveredPathMtu - 28 }} B + 28 B IP/ICMP Header</div>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm p-4 d-flex flex-column justify-content-center">
                        <div class="fw-bold text-foreground mb-1">Diagnostic Explanation</div>
                        <div class="small text-muted mb-2">{{ result.explanation }}</div>
                        <div class="small font-monospace text-primary">Target: {{ result.host }} ({{ result.resolvedIp }})</div>
                    </div>
                </div>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    <span>Packet Size Threshold Evaluation</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>CANDIDATE MTU</th>
                                    <th>PAYLOAD SIZE</th>
                                    <th>STANDARD PROFILE</th>
                                    <th>FRAGMENTATION (DF)</th>
                                    <th>RTT</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="t in result.testedSizes" :key="t.mtu">
                                    <td class="fw-bold">{{ t.mtu }} B</td>
                                    <td>{{ t.payloadBytes }} B</td>
                                    <td class="text-muted">{{ t.label }}</td>
                                    <td>
                                        <span class="badge" :class="t.fragmented ? 'bg-danger text-white' : 'bg-secondary text-white'">
                                            {{ t.fragmented ? 'FRAGMENTATION REQUIRED' : 'NO FRAGMENTATION' }}
                                        </span>
                                    </td>
                                    <td>{{ t.rttMs ? `${t.rttMs} ms` : '—' }}</td>
                                    <td>
                                        <span class="badge" :class="t.success ? 'bg-success text-white' : 'bg-danger text-white'">
                                            {{ t.success ? 'PASSED' : 'BLOCKED / TIMEOUT' }}
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
    props: { tool: { type: Object, default: null } },
    emits: ["history-updated"],
    data() {
        return {
            targetHost: "1.1.1.1",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runMtuTest();
    },
    methods: {
        runMtuTest() {
            if (!this.targetHost.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "mtu-test",
                params: { host: this.targetHost.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Path MTU discovered: ${res.result.discoveredPathMtu} bytes`);
                } else {
                    this.$root.toastError((res && res.msg) || "Path MTU discovery failed.");
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
