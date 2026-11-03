<template>
    <div class="link-utilization-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="tachometer-alt" class="text-primary" />
                    <span>Link Bandwidth & Saturation Calculator</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Capacity Headroom Analysis</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Current Throughput (Mbps)</label>
                        <input
                            v-model.number="throughputMbps"
                            type="number"
                            min="0"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 750"
                            @input="calculateUtilization"
                        />
                    </div>
                    <div class="col-12 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Link Physical Capacity</label>
                        <select v-model="linkCapacity" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace" @change="calculateUtilization">
                            <option value="10M">10 Mbps (Legacy Ethernet)</option>
                            <option value="100M">100 Mbps (Fast Ethernet)</option>
                            <option value="1G">1 Gbps (Gigabit Ethernet)</option>
                            <option value="2.5G">2.5 Gbps (Multi-Gig / GPON)</option>
                            <option value="10G">10 Gbps (10GBASE-R / XGS-PON)</option>
                            <option value="25G">25 Gbps (25GBASE-R)</option>
                            <option value="40G">40 Gbps (40GBASE-SR4)</option>
                            <option value="100G">100 Gbps (100GBASE-LR4)</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-3">
                        <button class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm" @click="calculateUtilization">
                            Analyze Link
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="result" class="utilization-results-dashboard">
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-4">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Utilization</div>
                        <div class="fs-1 fw-bold font-monospace" :class="result.color">
                            {{ result.utilizationPercent }}%
                        </div>
                        <div class="progress mt-2" style="height: 6px;">
                            <div
                                class="progress-bar"
                                :class="result.utilizationPercent < 70 ? 'bg-success' : (result.utilizationPercent < 85 ? 'bg-warning' : 'bg-danger')"
                                :style="{ width: result.utilizationPercent + '%' }"
                            ></div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-4">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Remaining Headroom</div>
                        <div class="fs-2 fw-bold font-monospace text-primary mt-1">
                            {{ result.remainingHeadroomMbps }} Mbps
                        </div>
                        <div class="small text-muted font-monospace mt-1">Available buffer before drop</div>
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="card bg-card border-secondary shadow-sm p-4 d-flex flex-column justify-content-center">
                        <div class="fw-bold text-foreground mb-1">Capacity Status: {{ result.status }}</div>
                        <div class="small text-muted">{{ result.recommendation }}</div>
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
            throughputMbps: 450,
            linkCapacity: "1G",
            result: null,
        };
    },
    mounted() {
        this.calculateUtilization();
    },
    methods: {
        calculateUtilization() {
            this.$root.getSocket().emit("executeTool", {
                slug: "link-utilization",
                params: {
                    throughputMbps: this.throughputMbps,
                    linkCapacity: this.linkCapacity,
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
