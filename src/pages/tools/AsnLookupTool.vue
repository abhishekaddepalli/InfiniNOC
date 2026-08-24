<template>
    <div class="asn-lookup-tool">
        <!-- Form Input Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="network-wired" class="text-primary" />
                    <span>Autonomous System (ASN / BGP) Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">RIPEstat BGP API</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Autonomous System Number (ASN)</label>
                        <input
                            v-model="asnInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. AS15169, AS13335, or 15169"
                            @keydown.enter="runAsnLookup"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runAsnLookup"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Querying BGP...' : 'Lookup ASN' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Fetching BGP routing intelligence...</h5>
            <div class="text-muted small font-monospace">Querying RIPEstat BGP API for {{ asnInput }}</div>
        </div>

        <!-- ASN Results Dashboard -->
        <div v-else-if="result" class="asn-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Autonomous System Profile</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.asn }} — {{ result.name }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-secondary text-foreground font-monospace">Org: {{ result.org }}</span>
                            <span class="badge bg-primary text-white font-monospace">{{ result.totalAnnouncedPrefixes }} Announced Prefixes</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Announced Prefixes Table -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    Announced BGP IPv4/IPv6 Prefixes
                </div>
                <div class="card-body p-4">
                    <div v-if="!result.prefixes || result.prefixes.length === 0" class="text-muted small">
                        No announced prefixes returned.
                    </div>
                    <div v-else class="d-flex flex-wrap gap-2">
                        <span v-for="(p, idx) in result.prefixes" :key="idx" class="badge bg-secondary-subtle border border-secondary text-primary font-monospace fs-6 px-3 py-2">
                            {{ p }}
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
            asnInput: "AS15169",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runAsnLookup();
    },
    methods: {
        runAsnLookup() {
            if (!this.asnInput.trim()) {
                this.$root.toastError("Please provide an ASN.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "asn-lookup",
                params: { asn: this.asnInput.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Retrieved BGP details for ${res.result.asn}`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute ASN lookup.");
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
