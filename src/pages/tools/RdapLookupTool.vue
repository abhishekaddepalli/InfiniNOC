<template>
    <div class="rdap-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="address-card" class="text-primary" />
                    <span>WHOIS & RDAP Registry Lookup</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">ICANN / RIR Official RDAP</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Domain Name or IP Address</label>
                        <input
                            v-model="targetInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. google.com or 1.1.1.1"
                            @keydown.enter="runLookup"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runLookup"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Querying...' : 'Lookup RDAP' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Querying authoritative RDAP registries...</h5>
            <div class="text-muted small font-monospace">Fetching registration record for {{ targetInput }}</div>
        </div>

        <div v-else-if="result" class="rdap-results-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Registration Record — {{ result.target }}</span>
                    <span class="badge bg-primary font-monospace">{{ result.type }}</span>
                </div>
                <div class="card-body p-4 font-monospace">
                    <!-- Domain View -->
                    <div v-if="result.type === 'DOMAIN_REGISTRATION'" class="row g-3">
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Registrar</div>
                            <div class="fw-bold text-primary">{{ result.registrar }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Registry Handle</div>
                            <div class="text-muted">{{ result.handle }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Created</div>
                            <div>{{ formatDate(result.creationDate) }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Expires</div>
                            <div class="fw-bold text-foreground">{{ formatDate(result.expirationDate) }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Updated</div>
                            <div>{{ formatDate(result.updatedDate) }}</div>
                        </div>
                        <div class="col-12" v-if="result.nameServers && result.nameServers.length">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Authoritative Name Servers</div>
                            <div class="d-flex flex-wrap gap-2">
                                <span v-for="ns in result.nameServers" :key="ns" class="badge bg-secondary text-foreground">
                                    {{ ns }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- IP Allocation View -->
                    <div v-else class="row g-3">
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Organization / Registrant</div>
                            <div class="fw-bold text-primary">{{ result.organization }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Network Name</div>
                            <div class="fw-bold text-foreground">{{ result.networkName }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">IP Range Bounds</div>
                            <div class="small">{{ result.startAddress }} - {{ result.endAddress }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">CIDR Notation</div>
                            <div class="fw-bold text-primary">{{ result.cidrRange || 'N/A' }}</div>
                        </div>
                        <div class="col-6 col-md-4">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Country / Registry</div>
                            <div>{{ result.country }} · {{ result.handle }}</div>
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
            targetInput: "google.com",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runLookup();
    },
    methods: {
        runLookup() {
            if (!this.targetInput.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "rdap-lookup",
                params: { target: this.targetInput.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`RDAP query complete for ${res.result.target}`);
                } else {
                    this.$root.toastError((res && res.msg) || (res && res.result && res.result.error) || "RDAP lookup failed.");
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
