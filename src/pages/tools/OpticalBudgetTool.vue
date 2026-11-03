<template>
    <div class="optical-budget-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="wave-square" class="text-primary" />
                    <span>FTTH Fiber Optical Loss Budget & Splitter Calculator</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">ITU-T G.984 GPON Standard</span>
            </div>
            <div class="card-body p-4">
                <div class="row g-3">
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Tx Power (dBm)</label>
                        <input
                            v-model.number="txPower"
                            type="number"
                            step="0.5"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="+3.0"
                            @input="calculateBudget"
                        />
                        <div class="form-text small text-muted">OLT SFP Class B+: +3 dBm</div>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Rx Sensitivity (dBm)</label>
                        <input
                            v-model.number="rxSensitivity"
                            type="number"
                            step="0.5"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="-28.0"
                            @input="calculateBudget"
                        />
                        <div class="form-text small text-muted">ONU threshold: -28 dBm</div>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Distance (km)</label>
                        <input
                            v-model.number="fiberDistanceKm"
                            type="number"
                            step="0.5"
                            min="0"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="10.0"
                            @input="calculateBudget"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">PLC Splitter</label>
                        <select v-model="splitterRatio" class="form-select border-secondary bg-card text-foreground font-monospace" @change="calculateBudget">
                            <option value="none">None (0 dB)</option>
                            <option value="1:2">1:2 (3.5 dB)</option>
                            <option value="1:4">1:4 (7.2 dB)</option>
                            <option value="1:8">1:8 (10.5 dB)</option>
                            <option value="1:16">1:16 (13.8 dB)</option>
                            <option value="1:32">1:32 (17.0 dB)</option>
                            <option value="1:64">1:64 (20.5 dB)</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Wavelength</label>
                        <select v-model="wavelength" class="form-select border-secondary bg-card text-foreground font-monospace" @change="calculateBudget">
                            <option value="1490">1490 nm Downstream (0.28 dB/km)</option>
                            <option value="1310">1310 nm Upstream (0.35 dB/km)</option>
                            <option value="1550">1550 nm Video / CWDM (0.22 dB/km)</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Mated Connectors (0.5 dB/ea)</label>
                        <input v-model.number="connectorCount" type="number" min="0" class="form-control border-secondary bg-card text-foreground font-monospace" @input="calculateBudget" />
                    </div>
                    <div class="col-6 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Fusion Splices (0.1 dB/ea)</label>
                        <input v-model.number="spliceCount" type="number" min="0" class="form-control border-secondary bg-card text-foreground font-monospace" @input="calculateBudget" />
                    </div>
                </div>
            </div>
        </div>

        <div v-if="result" class="optical-results-dashboard">
            <!-- Summary Metric Cards -->
            <div class="row g-3 mb-4">
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Total Link Loss</div>
                        <div class="fs-2 fw-bold font-monospace text-danger">{{ result.breakdown.totalLinkLossDb }} dB</div>
                        <div class="small text-muted font-monospace mt-1">Fiber + Splitter + Splices</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Estimated Rx Power</div>
                        <div class="fs-2 fw-bold font-monospace" :class="result.breakdown.estimatedRxPowerDbm >= -27 ? 'text-success' : 'text-danger'">
                            {{ result.breakdown.estimatedRxPowerDbm }} dBm
                        </div>
                        <div class="small text-muted font-monospace mt-1">Expected at ONT Port</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Safety Margin</div>
                        <div class="fs-2 fw-bold font-monospace" :class="result.breakdown.safetyMarginDb >= 3.0 ? 'text-success' : (result.breakdown.safetyMarginDb >= 0 ? 'text-warning' : 'text-danger')">
                            {{ result.breakdown.safetyMarginDb }} dB
                        </div>
                        <div class="small text-muted font-monospace mt-1">Target: &gt;= 3.0 dB margin</div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Power Budget</div>
                        <div class="fs-2 fw-bold font-monospace text-primary">{{ result.breakdown.totalPowerBudgetDb }} dB</div>
                        <div class="small text-muted font-monospace mt-1">Tx to Rx Sensitivity</div>
                    </div>
                </div>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Optical Link Loss Itemized Breakdown</span>
                    <span class="badge" :class="result.status === 'OPTIMAL' ? 'bg-success' : (result.status === 'MARGINAL' ? 'bg-warning text-dark' : 'bg-danger')">
                        {{ result.status }}
                    </span>
                </div>
                <div class="card-body p-4">
                    <div class="p-3 bg-secondary-subtle border border-secondary rounded mb-3 small">
                        <strong>Engineering Assessment:</strong> {{ result.recommendation }}
                    </div>
                    <div class="row g-2 font-monospace small">
                        <div class="col-6 col-md-3">Fiber Attenuation: <strong>{{ result.breakdown.fiberAttenuationDb }} dB</strong></div>
                        <div class="col-6 col-md-3">Splitter Insertion: <strong>{{ result.breakdown.splitterLossDb }} dB</strong></div>
                        <div class="col-6 col-md-3">Connectors ({{ connectorCount }}x): <strong>{{ result.breakdown.connectorLossDb }} dB</strong></div>
                        <div class="col-6 col-md-3">Splices ({{ spliceCount }}x): <strong>{{ result.breakdown.spliceLossDb }} dB</strong></div>
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
            txPower: 3.0,
            rxSensitivity: -28.0,
            fiberDistanceKm: 10.0,
            wavelength: "1490",
            splitterRatio: "1:8",
            connectorCount: 2,
            spliceCount: 4,
            result: null,
        };
    },
    mounted() {
        this.calculateBudget();
    },
    methods: {
        calculateBudget() {
            this.$root.getSocket().emit("executeTool", {
                slug: "optical-budget",
                params: {
                    txPowerDbm: this.txPower,
                    rxSensitivityDbm: this.rxSensitivity,
                    fiberDistanceKm: this.fiberDistanceKm,
                    wavelength: this.wavelength,
                    splitterRatio: this.splitterRatio,
                    connectorCount: this.connectorCount,
                    spliceCount: this.spliceCount,
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
