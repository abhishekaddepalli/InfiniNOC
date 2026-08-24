<template>
    <div class="ip-range-calculator-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="calculator" class="text-primary" />
                    <span>IP Range Parameters</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Deterministic Math</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Start IP Address</label>
                        <input
                            v-model="startIp"
                            type="text"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 10.0.0.1"
                            @keydown.enter="calculate"
                        />
                    </div>
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">End IP Address</label>
                        <input
                            v-model="endIp"
                            type="text"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 10.0.0.254"
                            @keydown.enter="calculate"
                        />
                    </div>
                    <div class="col-12 col-md-2">
                        <button
                            class="btn btn-warning w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="calculate"
                        >
                            <font-awesome-icon icon="calculator" />
                            <span>Calculate Range</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="card bg-card border-danger shadow-sm p-4 text-center my-4">
            <font-awesome-icon icon="exclamation-circle" class="fs-1 text-danger mb-2" />
            <h5 class="fw-bold text-danger">Invalid IP Range</h5>
            <div class="text-muted small font-monospace">{{ error }}</div>
        </div>

        <!-- Range Calculation Results Dashboard -->
        <div v-else-if="result" class="range-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">IP Range Address Bounds</div>
                        <h3 class="fw-bold font-monospace text-primary mb-1">{{ result.startIp }} — {{ result.endIp }}</h3>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary text-white">{{ result.ipVersion }}</span>
                            <span class="badge bg-success text-white font-monospace">{{ result.totalAddresses.toLocaleString() }} Addresses</span>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="copyJson">
                            <font-awesome-icon icon="copy" class="me-1" /> Copy JSON
                        </button>
                        <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="exportJson">
                            <font-awesome-icon icon="download" class="me-1" /> Export
                        </button>
                    </div>
                </div>
            </div>

            <!-- Covering CIDRs Breakdown -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    Covering CIDR Prefix Blocks
                </div>
                <div class="card-body p-4">
                    <div v-if="!result.coveringCidrs || result.coveringCidrs.length === 0" class="text-muted small">
                        No covering CIDRs calculated.
                    </div>
                    <div v-else class="d-flex flex-wrap gap-2">
                        <span v-for="(cidr, idx) in result.coveringCidrs" :key="idx" class="badge bg-secondary-subtle border border-secondary text-primary font-monospace fs-6 px-3 py-2">
                            {{ cidr }}
                        </span>
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
            startIp: "10.0.0.1",
            endIp: "10.0.0.254",
            loading: false,
            result: null,
            error: null,
        };
    },
    mounted() {
        this.calculate();
    },
    methods: {
        calculate() {
            if (!this.startIp.trim() || !this.endIp.trim()) {
                this.$root.toastError("Please provide both Start IP and End IP addresses.");
                return;
            }

            this.loading = true;
            this.error = null;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ip-range-calculator",
                params: {
                    startIp: this.startIp.trim(),
                    endIp: this.endIp.trim(),
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result && res.result.ok) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Calculated IP range (${res.result.totalAddresses.toLocaleString()} addresses)`);
                } else {
                    this.error = (res && res.result && res.result.error) || (res && res.msg) || "Invalid IP range parameters.";
                    this.$root.toastError(this.error);
                }
            });
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("IP Range result copied to clipboard.");
            });
        },
        exportJson() {
            if (!this.result) {
                return;
            }
            const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ip-range-${this.result.startIp}-to-${this.result.endIp}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported IP Range JSON.");
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
