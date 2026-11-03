<template>
    <div class="traceroute-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="route" class="text-primary" />
                    <span>Traceroute Hop Diagnostics</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Real Network Path Trace</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1, 8.8.8.8, or example.com"
                            @keydown.enter="runTraceroute"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Max Hops</label>
                        <select v-model="maxHops" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option :value="10">10 Hops</option>
                            <option :value="15">15 Hops</option>
                            <option :value="20">20 Hops</option>
                            <option :value="30">30 Hops</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Execution Node</label>
                        <select v-model="selectedLocation" class="form-select form-select-lg border-secondary bg-card text-foreground small">
                            <option value="central">Central Server</option>
                            <option v-for="loc in executionLocations.filter(l => l.id !== 'central')" :key="loc.id" :value="loc.id">
                                {{ loc.name }}
                            </option>
                        </select>
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runTraceroute"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="route" />
                            <span>{{ loading ? 'Tracing Path...' : 'Start Traceroute' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Tracing authentic network router hops...</h5>
            <div class="text-muted small font-monospace">Probing path to {{ targetHost }} (max {{ maxHops }} hops)</div>
        </div>

        <!-- Traceroute Hop Table Dashboard -->
        <div v-else-if="result" class="traceroute-results-dashboard">
            <!-- Summary Banner -->
            <div class="alert border-secondary shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4" :class="result.destinationReached ? 'alert-success' : 'alert-warning'">
                <div class="d-flex align-items-center gap-3">
                    <font-awesome-icon :icon="result.destinationReached ? 'check-circle' : 'exclamation-triangle'" class="fs-4" />
                    <div>
                        <div class="fw-bold">{{ result.destinationReached ? 'Destination Reached' : 'Traceroute Complete' }}</div>
                        <div class="small font-monospace">Target: {{ result.host }} ({{ result.resolvedIp }}) · {{ result.totalHops }} Hops discovered in {{ (result.totalDurationMs / 1000).toFixed(1) }}s</div>
                    </div>
                </div>
                <div class="badge bg-secondary font-monospace px-3 py-2 text-uppercase">
                    Node: {{ result.executionLocation || 'Central Server' }}
                </div>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Hop-by-Hop Path Sequence</span>
                    <span class="badge bg-primary font-monospace">{{ result.totalHops }} Hops</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 8%;">HOP</th>
                                    <th style="width: 25%;">ROUTER IP</th>
                                    <th style="width: 35%;">HOSTNAME / REVERSE DNS</th>
                                    <th style="width: 20%;">PROBE LATENCIES</th>
                                    <th style="width: 12%;">AVG RTT</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="h in result.hops" :key="h.hop" :class="{ 'table-active': h.ip === result.resolvedIp }">
                                    <td class="fw-bold text-muted">#{{ h.hop }}</td>
                                    <td class="fw-bold" :class="h.ip === '*' ? 'text-muted' : (h.ip === result.resolvedIp ? 'text-success' : 'text-primary')">
                                        {{ h.ip }}
                                    </td>
                                    <td class="text-foreground text-truncate" style="max-width: 250px;">
                                        {{ h.hostname || h.ptr || (h.ip === '*' ? 'Request timed out / filtered' : h.ip) }}
                                    </td>
                                    <td>
                                        <span v-if="h.rtt1 != null" class="badge bg-secondary-subtle border border-secondary text-foreground me-1">{{ h.rtt1 }} ms</span>
                                        <span v-else class="badge bg-dark-subtle text-muted me-1">*</span>
                                        <span v-if="h.rtt2 != null" class="badge bg-secondary-subtle border border-secondary text-foreground me-1">{{ h.rtt2 }} ms</span>
                                        <span v-else class="badge bg-dark-subtle text-muted me-1">*</span>
                                        <span v-if="h.rtt3 != null" class="badge bg-secondary-subtle border border-secondary text-foreground">{{ h.rtt3 }} ms</span>
                                        <span v-else class="badge bg-dark-subtle text-muted">*</span>
                                    </td>
                                    <td>
                                        <span v-if="h.avgRtt != null" class="fw-bold" :class="h.avgRtt < 30 ? 'text-success' : (h.avgRtt < 80 ? 'text-warning' : 'text-danger')">
                                            {{ h.avgRtt }} ms
                                        </span>
                                        <span v-else class="text-muted small">Timeout</span>
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
            maxHops: 15,
            selectedLocation: "central",
            executionLocations: [{ id: "central", name: "Central Server" }],
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.fetchLocations();
        this.runTraceroute();
    },
    methods: {
        fetchLocations() {
            this.$root.getSocket().emit("getDiagnosticExecutionLocations", (res) => {
                if (res && res.ok && res.locations) {
                    this.executionLocations = res.locations;
                }
            });
        },
        runTraceroute() {
            if (!this.targetHost.trim()) {
                this.$root.toastError("Please provide a target host or IP.");
                return;
            }

            this.loading = true;
            this.result = null;

            const probeId = this.selectedLocation.startsWith("probe:") ? parseInt(this.selectedLocation.split(":")[1], 10) : null;

            this.$root.getSocket().emit("executeTool", {
                slug: "traceroute",
                params: {
                    host: this.targetHost.trim(),
                    maxHops: this.maxHops,
                    probeId,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Traced ${res.result.totalHops} hops to ${res.result.host}`);
                } else {
                    this.$root.toastError((res && res.msg) || (res && res.result && res.result.error) || "Failed to execute traceroute.");
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
