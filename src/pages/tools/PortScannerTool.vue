<template>
    <div class="port-scanner-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="crosshairs" class="text-primary" />
                    <span>Controlled Network Port Scanner</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Bounded TCP Scan</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1 or example.com"
                            @keydown.enter="runScan"
                        />
                    </div>
                    <div class="col-12 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Port Range or List (Max 50)</label>
                        <input
                            v-model="portsInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 80,443,22,21,25,3389 or 80-90"
                            @keydown.enter="runScan"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runScan"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Scanning Ports...' : 'Start Port Scan' }}</span>
                        </button>
                    </div>
                </div>
                <div class="form-text small text-muted mt-2">
                    Security Policy: Internal sweeps, cloud metadata endpoints, and mass network scanning are prohibited. Maximum 50 ports per scan request.
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Scanning specified destination ports...</h5>
            <div class="text-muted small font-monospace">Probing ports on {{ targetHost }} with concurrency limiter</div>
        </div>

        <div v-else-if="result" class="scan-results-dashboard">
            <div class="alert border-secondary shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4" :class="result.openCount > 0 ? 'alert-success' : 'alert-secondary'">
                <div>
                    <span class="fw-bold">{{ result.openCount }} of {{ result.scannedCount }} ports are open</span>
                    <span class="small font-monospace ms-2">({{ result.host }} · {{ result.resolvedIp }})</span>
                </div>
                <span class="badge bg-secondary font-monospace text-uppercase">Node: {{ result.executionLocation || 'Central Server' }}</span>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    <span>Scanned Port Table</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>PORT</th>
                                    <th>PROTOCOL</th>
                                    <th>SERVICE</th>
                                    <th>RESPONSE TIME</th>
                                    <th>STATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in result.ports" :key="p.port" :class="{ 'table-active': p.state === 'OPEN' }">
                                    <td class="fw-bold">{{ p.port }}</td>
                                    <td>{{ p.protocol }}</td>
                                    <td class="text-primary">{{ p.service }}</td>
                                    <td>{{ p.rttMs }} ms</td>
                                    <td>
                                        <span class="badge" :class="p.state === 'OPEN' ? 'bg-success text-white' : (p.state === 'CLOSED' ? 'bg-secondary' : 'bg-danger text-white')">
                                            {{ p.state }}
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
            portsInput: "80,443,22,21,25,53,3389,8080",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runScan();
    },
    methods: {
        runScan() {
            if (!this.targetHost.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "port-scanner",
                params: {
                    host: this.targetHost.trim(),
                    ports: this.portsInput.trim(),
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Scan complete: ${res.result.openCount} open ports`);
                } else {
                    this.$root.toastError((res && res.msg) || "Port scan failed.");
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
