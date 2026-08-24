<template>
    <div class="mac-lookup-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="microchip" class="text-primary" />
                    <span>MAC / OUI Hardware Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">IEEE Dataset</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">MAC Hardware Address</label>
                        <input
                            v-model="macInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 00:1A:2B:12:34:56, 00-1A-2B-12-34-56, or 001A2B123456"
                            @keydown.enter="lookup"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="lookup"
                        >
                            <font-awesome-icon icon="search" />
                            <span>Lookup OUI</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="card bg-card border-danger shadow-sm p-4 text-center my-4">
            <font-awesome-icon icon="exclamation-circle" class="fs-1 text-danger mb-2" />
            <h5 class="fw-bold text-danger">Invalid MAC Address</h5>
            <div class="text-muted small font-monospace">{{ error }}</div>
        </div>

        <!-- MAC OUI Result Dashboard -->
        <div v-else-if="result" class="mac-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Hardware Vendor Identification</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.vendor }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-secondary text-foreground font-monospace">OUI: {{ result.ouiPrefix }}</span>
                            <span class="badge bg-primary text-white font-monospace">MAC: {{ result.mac }}</span>
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

            <!-- Details Section Cards -->
            <div class="row g-4 mb-4">
                <!-- Hardware & OUI Block -->
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="microchip" class="text-primary" />
                            <span>OUI Hardware Block</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">Vendor Name</div>
                            <div class="fw-bold fs-5 text-foreground">{{ result.vendor }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small">OUI Prefix</div>
                            <div class="font-monospace fw-bold text-primary">{{ result.ouiPrefix }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Block Assignment Type</div>
                            <div class="font-monospace text-foreground">{{ result.assignmentType }}</div>
                        </div>
                    </div>
                </div>

                <!-- Scope & Transmission -->
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center gap-2">
                            <font-awesome-icon icon="network-wired" class="text-info" />
                            <span>Address Scope & Transmission</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">Administration Scope</div>
                            <div class="fw-semibold text-foreground">{{ result.administrationScope }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Transmission Mode</div>
                            <div class="fw-semibold text-foreground">{{ result.transmissionType }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Dataset Attribution Footer -->
            <div class="card bg-card border-secondary shadow-sm p-3 d-flex align-items-center justify-content-between flex-wrap gap-2 text-muted small">
                <div>
                    Database Source: <strong class="text-foreground">{{ result.databaseSource }}</strong>
                </div>
                <div>
                    Updated: <span class="font-monospace text-foreground">{{ formatDate(result.lastUpdated) }}</span>
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
            macInput: "00:1A:2B:12:34:56",
            loading: false,
            result: null,
            error: null,
        };
    },
    mounted() {
        this.lookup();
    },
    methods: {
        lookup() {
            if (!this.macInput.trim()) {
                this.$root.toastError("Please provide a valid MAC address.");
                return;
            }

            this.loading = true;
            this.error = null;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "mac-lookup",
                params: { mac: this.macInput.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result && res.result.ok) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Identified vendor '${res.result.vendor}' for MAC ${res.result.mac}`);
                } else {
                    this.error = (res && res.result && res.result.error) || (res && res.msg) || "Invalid MAC address format.";
                    this.$root.toastError(this.error);
                }
            });
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("MAC OUI result copied to clipboard.");
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
            a.download = `mac-oui-${this.result.ouiPrefix.replace(/:/g, "")}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported MAC OUI JSON.");
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
