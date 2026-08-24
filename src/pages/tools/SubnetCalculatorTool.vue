<template>
    <div class="subnet-calculator-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="calculator" class="text-primary" />
                    <span>Subnet & CIDR Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Deterministic Math</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">IP Address & Netmask / CIDR Notation</label>
                        <input
                            v-model="cidrInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 192.168.10.0/24 or 10.0.0.0/16"
                            @keydown.enter="calculate"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="calculate"
                        >
                            <font-awesome-icon icon="calculator" />
                            <span>Calculate Subnet</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="card bg-card border-danger shadow-sm p-4 text-center my-4">
            <font-awesome-icon icon="exclamation-circle" class="fs-1 text-danger mb-2" />
            <h5 class="fw-bold text-danger">Invalid Subnet Input</h5>
            <div class="text-muted small font-monospace">{{ error }}</div>
        </div>

        <!-- Subnet Mathematics Dashboard -->
        <div v-else-if="result" class="subnet-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Network Subnet Breakdown</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.networkAddress }} {{ result.prefix }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary text-white">{{ result.ipVersion }}</span>
                            <span class="badge bg-secondary text-foreground font-monospace">{{ result.classification }}</span>
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

            <!-- 4 Section Cards Grid -->
            <div class="row g-4 mb-4">
                <!-- Network Parameters Card -->
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="network-wired" class="text-primary" />
                            <span>Network</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">Network Address</div>
                            <div class="fw-bold font-monospace text-primary fs-6">{{ result.networkAddress }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small">Subnet Mask</div>
                            <div class="font-monospace text-foreground">{{ result.subnetMask }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small">Wildcard Mask</div>
                            <div class="font-monospace text-foreground">{{ result.wildcardMask }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Broadcast Address</div>
                            <div class="font-monospace text-foreground">{{ result.broadcastAddress }}</div>
                        </div>
                    </div>
                </div>

                <!-- Host Capacity Card -->
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="th-large" class="text-info" />
                            <span>Address Capacity</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">Total IP Addresses</div>
                            <div class="fw-bold font-monospace fs-4 text-foreground">{{ formatNumber(result.totalAddresses) }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Usable Host Capacity</div>
                            <div class="fw-bold font-monospace fs-4 text-success">{{ formatNumber(result.usableHosts) }}</div>
                        </div>
                    </div>
                </div>

                <!-- Host Range Card -->
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="arrows-alt-v" class="text-warning" />
                            <span>Usable Host Bounds</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">First Usable Host</div>
                            <div class="font-monospace text-foreground">{{ result.firstHost }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small">Last Usable Host</div>
                            <div class="font-monospace text-foreground">{{ result.lastHost }}</div>
                        </div>
                    </div>
                </div>

                <!-- Classification Card -->
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="shield-alt" class="text-success" />
                            <span>Classification</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">IP Version</div>
                            <div class="fw-bold font-monospace text-foreground">{{ result.ipVersion }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Network Scope</div>
                            <div class="badge bg-secondary text-foreground font-monospace fs-6">{{ result.classification }}</div>
                        </div>
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
            cidrInput: "192.168.10.0/24",
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
            if (!this.cidrInput.trim()) {
                this.$root.toastError("Please provide a valid CIDR network string.");
                return;
            }

            this.loading = true;
            this.error = null;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "subnet-calculator",
                params: { cidr: this.cidrInput.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result && res.result.ok) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Calculated subnet for ${res.result.networkAddress}${res.result.prefix}`);
                } else {
                    this.error = (res && res.result && res.result.error) || (res && res.msg) || "Invalid CIDR input syntax.";
                    this.$root.toastError(this.error);
                }
            });
        },
        formatNumber(num) {
            if (typeof num === "number") {
                return num.toLocaleString();
            }
            return num;
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("Subnet result copied to clipboard.");
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
            a.download = `subnet-${this.result.ipAddress}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported Subnet JSON.");
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
