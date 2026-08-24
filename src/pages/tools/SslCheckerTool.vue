<template>
    <div class="ssl-checker-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="lock" class="text-primary" />
                    <span>SSL / TLS Certificate Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">TLS Handshake</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-7">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Domain / Hostname</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. google.com or github.com"
                            @keydown.enter="runSslCheck"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Port</label>
                        <input
                            v-model.number="targetPort"
                            type="number"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="443"
                            @keydown.enter="runSslCheck"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runSslCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="lock" />
                            <span>{{ loading ? 'Inspecting TLS...' : 'Inspect SSL' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Performing TLS handshake...</h5>
            <div class="text-muted small font-monospace">Fetching certificate parameters for {{ targetHost }}:{{ targetPort }}</div>
        </div>

        <!-- SSL Certificate Results Dashboard -->
        <div v-else-if="result" class="ssl-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">SSL Certificate Expiration Profile</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.subject }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge fs-6" :class="result.status === 'VALID' ? 'bg-success text-white' : result.status === 'EXPIRING_SOON' ? 'bg-warning text-dark' : 'bg-danger text-white'">
                                ● {{ result.status }} ({{ result.daysRemaining }} Days Remaining)
                            </span>
                            <span class="badge bg-secondary text-foreground font-monospace">Issuer: {{ result.issuer }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Certificate Properties Grid -->
            <div class="row g-4 mb-4">
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2">Validity Window</h6>
                        <div class="mb-3">
                            <div class="text-muted small">Issued On</div>
                            <div class="font-monospace text-foreground">{{ formatDate(result.validFrom) }}</div>
                        </div>
                        <div class="mb-3">
                            <div class="text-muted small">Expires On</div>
                            <div class="font-monospace fw-bold text-primary">{{ formatDate(result.validTo) }}</div>
                        </div>
                        <div>
                            <div class="text-muted small">Days Remaining</div>
                            <div class="font-monospace fs-4 fw-bold text-success">{{ result.daysRemaining }} Days</div>
                        </div>
                    </div>
                </div>

                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-4">
                        <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2">Subject Alternative Names (SANs)</h6>
                        <div v-if="!result.subjectAltNames || result.subjectAltNames.length === 0" class="text-muted small">
                            No SAN domains listed.
                        </div>
                        <div v-else class="d-flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                            <span v-for="(san, idx) in result.subjectAltNames" :key="idx" class="badge bg-secondary-subtle border border-secondary text-primary font-monospace px-2 py-1">
                                {{ san }}
                            </span>
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
            targetHost: "google.com",
            targetPort: 443,
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runSslCheck();
    },
    methods: {
        runSslCheck() {
            if (!this.targetHost.trim()) {
                this.$root.toastError("Please provide a target hostname.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ssl-checker",
                params: {
                    host: this.targetHost.trim(),
                    port: this.targetPort,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`SSL Cert valid for ${res.result.daysRemaining} days (${res.result.issuer})`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to inspect SSL certificate.");
                }
            });
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
