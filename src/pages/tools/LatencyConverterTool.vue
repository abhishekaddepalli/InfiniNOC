<template>
    <div class="latency-converter-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="stopwatch" class="text-primary" />
                    <span>Latency Unit Converter & Optical Propagation Delay</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">G.652 Single-Mode Fiber</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-6 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Latency Value</label>
                        <input
                            v-model.number="latencyValue"
                            type="number"
                            min="0"
                            step="0.1"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="25.0"
                            @input="convertLatency"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Input Unit</label>
                        <select v-model="unit" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace" @change="convertLatency">
                            <option value="ms">Milliseconds (ms)</option>
                            <option value="us">Microseconds (µs)</option>
                            <option value="s">Seconds (s)</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Fiber Route Distance (km)</label>
                        <input
                            v-model.number="distanceKm"
                            type="number"
                            min="0"
                            step="10"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="500"
                            @input="convertLatency"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div v-if="result" class="latency-results-dashboard">
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Milliseconds</div>
                        <div class="fs-2 fw-bold font-monospace text-primary">{{ result.conversions.milliseconds }} ms</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Microseconds</div>
                        <div class="fs-2 fw-bold font-monospace text-foreground">{{ result.conversions.microseconds.toLocaleString() }} µs</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Theoretical RTT Delay</div>
                        <div class="fs-2 fw-bold font-monospace text-success">{{ result.fiberPropagation.theoreticalRttDelayMs }} ms</div>
                        <div class="small text-muted font-monospace mt-1">Over {{ distanceKm }} km of fiber</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Speed in Glass</div>
                        <div class="fs-4 fw-bold font-monospace text-info mt-1">204,190 km/s</div>
                        <div class="small text-muted font-monospace mt-1">~4.9 µs/km one-way</div>
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
            latencyValue: 25,
            unit: "ms",
            distanceKm: 500,
            result: null,
        };
    },
    mounted() {
        this.convertLatency();
    },
    methods: {
        convertLatency() {
            this.$root.getSocket().emit("executeTool", {
                slug: "latency-converter",
                params: {
                    value: this.latencyValue,
                    unit: this.unit,
                    fiberDistanceKm: this.distanceKm,
                },
            }, (res) => {
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
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
