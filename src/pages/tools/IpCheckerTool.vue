<template>
    <div class="ip-checker-tool-v3">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="globe" class="text-primary" />
                    <span>IP & Domain Intelligence Lookup</span>
                </span>
                <span class="badge bg-success-subtle text-success border border-success px-2 py-1 font-monospace">Real-Time Data Engine</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-7">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address or Domain</label>
                        <input
                            v-model="targetInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="Enter IP address or domain (e.g. spidecloud.in, 1.1.1.1)"
                            @keydown.enter="runCheck(false)"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runCheck(false)"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Querying...' : 'Lookup Intelligence' }}</span>
                        </button>
                    </div>
                    <div class="col-6 col-md-2">
                        <button
                            class="btn btn-outline-secondary btn-lg w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading || !result"
                            title="Force fresh provider request"
                            @click="runCheck(true)"
                        >
                            <font-awesome-icon icon="sync-alt" :class="{ 'fa-spin': loading }" />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Provider Health & Timing Panel -->
        <div v-if="result && result.dataSources" class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-2 px-4 d-flex align-items-center justify-content-between">
                <span class="small fw-bold text-uppercase text-muted">Active Data Sources & Provider Response Status</span>
                <span class="small text-muted font-monospace">Real-time Verified</span>
            </div>
            <div class="card-body p-3">
                <div class="d-flex flex-wrap gap-3 align-items-center">
                    <div v-for="(src, idx) in result.dataSources" :key="idx" class="d-flex align-items-center gap-2 bg-secondary-subtle border border-secondary rounded px-3 py-1 text-foreground small font-monospace">
                        <span class="badge rounded-circle p-1" :class="src.status === 'Connected' ? 'bg-success' : 'bg-secondary'"></span>
                        <strong class="text-foreground">{{ src.provider }}</strong>
                        <span :class="src.status === 'Connected' ? 'text-success' : 'text-muted'">● {{ src.status }}</span>
                        <span v-if="src.latencyMs > 0" class="text-muted opacity-75">({{ src.latencyMs }}ms)</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Querying multi-provider network intelligence...</h5>
            <div class="text-muted small font-monospace">Executing RIPEstat BGP table, IPinfo, and DNS PTR resolvers for {{ targetInput }}</div>
        </div>

        <!-- Main IP Intelligence Dashboard -->
        <div v-else-if="result" class="ip-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Target Network Profile — {{ result.targetInput || result.ip }}</div>
                        <h1 class="fw-bold font-monospace text-primary mb-1">{{ result.ip }}</h1>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge bg-primary text-white">{{ result.ipVersion }}</span>
                            <span class="badge bg-secondary text-foreground font-monospace">{{ result.addressType }}</span>
                            <span class="badge bg-info-subtle border border-info text-info font-monospace">
                                PTR: {{ getFieldVal(result.identity ? result.identity.reverseDns : null) }}
                                <span class="ms-1 text-muted">[{{ getFieldSrc(result.identity ? result.identity.reverseDns : null) }}]</span>
                            </span>
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

            <!-- Dynamic Intelligence Grid -->
            <div class="row g-4 mb-4">
                <!-- 1. Identity & DNS Card -->
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center justify-content-between">
                            <span class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="fingerprint" class="text-primary" />
                                <span>Identity & Reverse DNS</span>
                            </span>
                            <span class="badge bg-secondary text-uppercase" style="font-size: 0.6rem;">DNS</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small">Resolved IP Address</div>
                            <div class="fw-bold font-monospace text-primary fs-5">{{ result.ip }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small d-flex justify-content-between">
                                <span>PTR Record Hostname</span>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ getFieldSrc(result.identity ? result.identity.reverseDns : null) }}</span>
                            </div>
                            <div class="font-monospace fw-bold text-foreground text-break mt-1">{{ getFieldVal(result.identity ? result.identity.reverseDns : null) }}</div>
                        </div>
                    </div>
                </div>

                <!-- 2. Network & BGP Routing Card -->
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center justify-content-between">
                            <span class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="network-wired" class="text-info" />
                                <span>Network & BGP Routing</span>
                            </span>
                            <span class="badge bg-secondary text-uppercase" style="font-size: 0.6rem;">RIPEstat</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small d-flex justify-content-between">
                                <span>Autonomous System (ASN)</span>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ getFieldSrc(result.network ? result.network.asn : null) }}</span>
                            </div>
                            <div class="fw-bold font-monospace text-primary fs-6 mt-1">{{ getFieldVal(result.network ? result.network.asn : null) }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small d-flex justify-content-between">
                                <span>ASN Name / Operator</span>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ getFieldSrc(result.network ? result.network.asnName : null) }}</span>
                            </div>
                            <div class="fw-semibold text-foreground mt-1">{{ getFieldVal(result.network ? result.network.asnName : null) }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small d-flex justify-content-between">
                                <span>Announced BGP Prefix</span>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ getFieldSrc(result.network ? result.network.announcedPrefix : null) }}</span>
                            </div>
                            <div class="font-monospace text-foreground mt-1">{{ getFieldVal(result.network ? result.network.announcedPrefix : null) }}</div>
                        </div>
                        <div class="row">
                            <div class="col-6 mb-2">
                                <div class="text-muted small">RIR Registry</div>
                                <div class="font-monospace fw-bold text-foreground mt-1">{{ getFieldVal(result.network ? result.network.rir : null) }}</div>
                            </div>
                            <div class="col-6 mb-2">
                                <div class="text-muted small">RPKI Validation</div>
                                <div class="badge bg-success-subtle border border-success text-success font-monospace mt-1">{{ getFieldVal(result.network ? result.network.rpkiStatus : null) }}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. Location & Geolocation Card -->
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2 d-flex align-items-center justify-content-between">
                            <span class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="map-marker-alt" class="text-warning" />
                                <span>Location & Geolocation</span>
                            </span>
                            <span class="badge bg-secondary text-uppercase" style="font-size: 0.6rem;">IPinfo/Fallback</span>
                        </h6>
                        <div class="mb-3">
                            <div class="text-muted small d-flex justify-content-between">
                                <span>Country</span>
                                <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ getFieldSrc(result.location ? result.location.country : null) }}</span>
                            </div>
                            <div class="fw-bold text-foreground fs-5 mt-1">{{ getFieldVal(result.location ? result.location.country : null) }}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-6">
                                <div class="text-muted small">State / Region</div>
                                <div class="fw-bold text-foreground mt-1">{{ getFieldVal(result.location ? result.location.region : null) }}</div>
                            </div>
                            <div class="col-6">
                                <div class="text-muted small">City</div>
                                <div class="fw-semibold text-foreground mt-1">{{ getFieldVal(result.location ? result.location.city : null) }}</div>
                            </div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-6">
                                <div class="text-muted small">Country Code</div>
                                <div class="fw-bold font-monospace text-foreground mt-1">{{ getFieldVal(result.location ? result.location.countryCode : null) }}</div>
                            </div>
                            <div class="col-6">
                                <div class="text-muted small">Timezone</div>
                                <div class="font-monospace text-foreground mt-1">{{ getFieldVal(result.location ? result.location.timezone : null) }}</div>
                            </div>
                        </div>
                        <div class="text-muted opacity-75 font-italic mt-2" style="font-size: 0.65rem;">
                            IP geolocation is an estimate and should not be interpreted as a physical address.
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
            targetInput: "",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.targetInput = "spidecloud.in";
        this.runCheck(false);
    },
    methods: {
        runCheck(forceRefresh = false) {
            if (!this.targetInput.trim()) {
                this.$root.toastError("Please provide a target host or IP address.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ip-checker",
                params: {
                    target: this.targetInput.trim(),
                    refresh: forceRefresh,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && (res.result || res.ip)) {
                    this.result = res.result || res;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Retrieved real network intelligence for ${this.result.ip}`);
                } else {
                    this.$root.toastError((res && res.error) || (res && res.msg) || "Failed to execute IP Intelligence query.");
                }
            });
        },
        getFieldVal(fieldObj) {
            if (!fieldObj) {
                return "Not returned by provider";
            }
            if (typeof fieldObj === "object" && fieldObj.value !== undefined && fieldObj.value !== null && fieldObj.value !== "") {
                return fieldObj.value;
            }
            if (typeof fieldObj === "object" && fieldObj.status) {
                if (fieldObj.status === "no_data") {
                    return "Not returned by provider";
                }
                if (fieldObj.status === "not_supported") {
                    return "Not included in current plan";
                }
                if (fieldObj.status === "not_configured") {
                    return "Provider not configured";
                }
                if (fieldObj.status === "timeout") {
                    return "Provider timed out";
                }
            }
            return fieldObj || "Not returned by provider";
        },
        getFieldSrc(fieldObj) {
            if (fieldObj && typeof fieldObj === "object" && fieldObj.source) {
                return fieldObj.source;
            }
            return "Provider";
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("IP Intelligence JSON copied to clipboard.");
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
            a.download = `ip-intelligence-${this.result.ip}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported IP Intelligence JSON.");
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
