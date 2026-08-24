<template>
    <div class="ssl-ciphers-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="shield-alt" class="text-primary" />
                    <span>TLS / SSL Cipher Suite & Protocol Audit</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">TLS Security Rating</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-7">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Hostname</label>
                        <input
                            v-model="hostInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. spidecloud.in, google.com"
                            @keydown.enter="runCheck"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Port</label>
                        <input
                            v-model.number="portInput"
                            type="number"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="443"
                            @keydown.enter="runCheck"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="lock" />
                            <span>{{ loading ? 'Auditing TLS...' : 'Audit TLS Ciphers' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Audit Dashboard -->
        <div v-if="result" class="ssl-ciphers-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">TLS Security Grade</div>
                        <h1 class="fw-bold font-monospace text-primary mb-1">{{ result.rating }}</h1>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge bg-primary text-white">{{ result.protocol }}</span>
                            <span class="badge bg-secondary text-foreground font-monospace">{{ result.cipherName }}</span>
                            <span class="badge bg-success-subtle border border-success text-success font-monospace">PFS: {{ result.isPfs ? 'Supported' : 'Not Supported' }}</span>
                        </div>
                    </div>
                    <div class="text-end font-monospace">
                        <div class="small text-muted">Certificate Expiration</div>
                        <div class="fs-5 fw-bold" :class="result.daysRemaining > 30 ? 'text-success' : 'text-danger'">
                            {{ result.daysRemaining }} Days Remaining
                        </div>
                    </div>
                </div>
            </div>

            <!-- Details Card -->
            <div class="card bg-card border-secondary shadow-sm p-4">
                <h6 class="fw-bold text-foreground mb-3 border-bottom border-secondary pb-2">Handshake Metrics & SANs</h6>
                <div class="row g-3">
                    <div class="col-12 col-md-6">
                        <div class="text-muted small">Subject Common Name</div>
                        <div class="font-monospace fw-bold text-foreground">{{ result.certSubject }}</div>
                    </div>
                    <div class="col-12 col-md-6">
                        <div class="text-muted small">Issuer Organization</div>
                        <div class="font-monospace fw-bold text-foreground">{{ result.certIssuer }}</div>
                    </div>
                    <div class="col-12">
                        <div class="text-muted small mb-1">Subject Alternative Names (SANs)</div>
                        <div class="d-flex flex-wrap gap-1">
                            <span v-for="(san, idx) in result.sans" :key="idx" class="badge bg-secondary font-monospace">{{ san }}</span>
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
        tool: { type: Object, default: null },
    },
    emits: ["history-updated"],
    data() {
        return {
            hostInput: "spidecloud.in",
            portInput: 443,
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runCheck();
    },
    methods: {
        runCheck() {
            if (!this.hostInput.trim()) {
                this.$root.toastError("Please enter a target hostname.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ssl-ciphers",
                params: {
                    host: this.hostInput.trim(),
                    port: this.portInput || 443,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && (res.result || res.rating)) {
                    this.result = res.result || res;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Audited TLS ciphers for ${this.hostInput}`);
                } else {
                    this.$root.toastError((res && res.error) || (res && res.msg) || "Failed to audit TLS ciphers.");
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
