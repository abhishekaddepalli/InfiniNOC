<template>
    <div class="ssl-decoder-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="file-code" class="text-primary" />
                    <span>SSL Certificate PEM Decoder (X.509)</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">In-Memory Safe Parser</span>
            </div>
            <div class="card-body p-4">
                <label class="form-label small fw-semibold text-muted text-uppercase">Paste X.509 Certificate (PEM Format)</label>
                <textarea
                    v-model="pemInput"
                    class="form-control border-secondary bg-card text-foreground font-monospace mb-3"
                    rows="6"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdPe5...&#10;-----END CERTIFICATE-----"
                ></textarea>
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span class="small text-muted">Never paste private keys. Only public X.509 certificates are parsed.</span>
                    <button class="btn btn-warning fw-bold px-4 shadow-sm" :disabled="!pemInput.trim()" @click="decodeCert">
                        Decode Certificate
                    </button>
                </div>
            </div>
        </div>

        <div v-if="result" class="ssl-decoder-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Parsed Certificate Details</span>
                    <span class="badge" :class="result.status === 'VALID' ? 'bg-success' : 'bg-danger'">{{ result.status }}</span>
                </div>
                <div class="card-body p-4">
                    <div class="row g-3 font-monospace small">
                        <div class="col-12 col-md-6">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Subject</div>
                            <div class="p-2 bg-secondary-subtle border border-secondary rounded text-break">{{ result.subject }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Issuer CA</div>
                            <div class="p-2 bg-secondary-subtle border border-secondary rounded text-break">{{ result.issuer }}</div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Valid From</div>
                            <div>{{ formatDate(result.validFrom) }}</div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Valid To (Expiry)</div>
                            <div>{{ formatDate(result.validTo) }}</div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Days Remaining</div>
                            <div class="fw-bold fs-5" :class="result.daysRemaining > 30 ? 'text-success' : 'text-danger'">
                                {{ result.daysRemaining }} Days
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Key Type / CA</div>
                            <div>{{ result.publicKeyType }} · {{ result.ca ? 'CA Certificate' : 'Leaf Cert' }}</div>
                        </div>
                        <div class="col-12">
                            <div class="text-muted text-uppercase fw-semibold mb-1">Subject Alternative Names (SANs)</div>
                            <div class="d-flex flex-wrap gap-1">
                                <span v-for="san in result.subjectAltNames" :key="san" class="badge bg-secondary text-foreground">
                                    {{ san }}
                                </span>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="text-muted text-uppercase fw-semibold mb-1">SHA-256 Fingerprint</div>
                            <div class="text-muted text-break">{{ result.fingerprint256 }}</div>
                        </div>
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
            pemInput: "",
            result: null,
        };
    },
    methods: {
        decodeCert() {
            if (!this.pemInput.trim()) return;

            this.$root.getSocket().emit("executeTool", {
                slug: "ssl-decoder",
                params: { certificate: this.pemInput.trim() },
            }, (res) => {
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess("Certificate successfully decoded");
                } else {
                    this.$root.toastError((res && res.msg) || (res && res.result && res.result.error) || "Failed to decode certificate.");
                }
            });
        },
        formatDate(iso) {
            if (!iso) return "N/A";
            return new Date(iso).toLocaleDateString();
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
