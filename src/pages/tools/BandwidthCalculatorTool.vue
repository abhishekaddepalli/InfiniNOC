<template>
    <div class="bandwidth-calculator-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="calculator" class="text-primary" />
                    <span>Bandwidth & Transfer Parameters</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Deterministic Math</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Data / File Size</label>
                        <input
                            v-model.number="fileSize"
                            type="number"
                            step="any"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="1"
                            @keydown.enter="calculate"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Unit</label>
                        <select v-model="sizeUnit" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option value="MB">MB (Megabytes)</option>
                            <option value="GB">GB (Gigabytes)</option>
                            <option value="TB">TB (Terabytes)</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="calculate"
                        >
                            <font-awesome-icon icon="calculator" />
                            <span>Calculate Speed</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Transfer Time Matrix Dashboard -->
        <div v-if="result" class="bandwidth-results-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    Transfer Time Across Network Link Speeds — {{ result.fileSize }} {{ result.sizeUnit }}
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 45%;">NETWORK LINK SPEED</th>
                                    <th style="width: 25%;">SPEED (MBPS)</th>
                                    <th style="width: 30%;">ESTIMATED TRANSFER TIME</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(m, idx) in result.transferMatrix" :key="idx">
                                    <td class="fw-bold text-foreground py-3 px-3">{{ m.linkName }}</td>
                                    <td class="text-primary py-3 px-3">{{ m.speedMbps.toLocaleString() }} Mbps</td>
                                    <td class="py-3 px-3">
                                        <span class="badge bg-success-subtle border border-success text-success fs-6 px-3 py-2">
                                            {{ m.formattedTime }}
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
            fileSize: 1,
            sizeUnit: "GB",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.calculate();
    },
    methods: {
        calculate() {
            if (!this.fileSize || this.fileSize <= 0) {
                this.$root.toastError("Please provide a valid file size.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "bandwidth-calculator",
                params: {
                    fileSize: this.fileSize,
                    sizeUnit: this.sizeUnit,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Calculated transfer speed matrix for ${res.result.fileSize} ${res.result.sizeUnit}`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to calculate bandwidth.");
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
