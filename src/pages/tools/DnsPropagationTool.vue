<template>
    <div class="dns-propagation-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="globe" class="text-primary" />
                    <span>Global DNS Propagation Checker</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Multi-Region Resolvers</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Domain Name</label>
                        <input
                            v-model="domainInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. spidecloud.in, google.com"
                            @keydown.enter="runCheck"
                        />
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Record Type</label>
                        <select v-model="recordType" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option value="A">A (IPv4)</option>
                            <option value="AAAA">AAAA (IPv6)</option>
                            <option value="MX">MX (Mail Exchange)</option>
                            <option value="NS">NS (Name Server)</option>
                            <option value="TXT">TXT (Text/SPF)</option>
                            <option value="CNAME">CNAME (Alias)</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="sync" />
                            <span>{{ loading ? 'Testing Resolvers...' : 'Check Propagation' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Global Results Dashboard -->
        <div v-if="result" class="propagation-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Propagation Results for {{ result.domain }} ({{ result.recordType }} Record)</span>
                    <span class="badge" :class="result.propagated ? 'bg-success text-white' : 'bg-warning text-dark'">
                        {{ result.propagated ? 'Fully Propagated (100% Consensus)' : 'Partial Propagation / Divergence' }}
                    </span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>GLOBAL RESOLVER</th>
                                    <th>REGION / COUNTRY</th>
                                    <th>STATUS</th>
                                    <th>RESPONSE TIME</th>
                                    <th>RESOLVED RECORD VALUES</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(res, idx) in result.propagationMatrix" :key="idx">
                                    <td class="fw-bold text-foreground py-3 px-3">{{ res.resolver }}</td>
                                    <td class="text-muted py-3 px-3">{{ res.region }} ({{ res.country }})</td>
                                    <td class="py-3 px-3">
                                        <span class="badge" :class="res.status === 'NOERROR' ? 'bg-success' : 'bg-danger'">
                                            {{ res.status }}
                                        </span>
                                    </td>
                                    <td class="text-primary py-3 px-3">{{ res.latencyMs }} ms</td>
                                    <td class="py-3 px-3">
                                        <div v-if="res.records.length > 0" class="d-flex flex-column gap-1">
                                            <span v-for="(rec, rIdx) in res.records" :key="rIdx" class="badge bg-secondary text-foreground text-break">
                                                {{ rec }}
                                            </span>
                                        </div>
                                        <span v-else class="text-muted small">No records returned</span>
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
        tool: { type: Object, default: null },
    },
    emits: ["history-updated"],
    data() {
        return {
            domainInput: "spidecloud.in",
            recordType: "A",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runCheck();
    },
    methods: {
        runCheck() {
            if (!this.domainInput.trim()) {
                this.$root.toastError("Please enter a domain name.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "dns-propagation",
                params: {
                    domain: this.domainInput.trim(),
                    recordType: this.recordType,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && (res.result || res.propagationMatrix)) {
                    this.result = res.result || res;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Checked global DNS propagation for ${this.domainInput}`);
                } else {
                    this.$root.toastError((res && res.error) || (res && res.msg) || "Failed to check DNS propagation.");
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
