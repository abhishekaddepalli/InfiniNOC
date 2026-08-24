<template>
    <div class="dns-lookup-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="search" class="text-primary" />
                    <span>DNS Query Parameters</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Real Resolver Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Domain Name</label>
                        <input
                            v-model="domainInput"
                            type="text"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. example.com or google.com"
                            @keydown.enter="queryDns"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Record Type</label>
                        <select v-model="recordType" class="form-select border-secondary bg-card text-foreground font-monospace">
                            <option value="ALL">ALL Records</option>
                            <option value="A">A (IPv4)</option>
                            <option value="AAAA">AAAA (IPv6)</option>
                            <option value="MX">MX (Mail)</option>
                            <option value="TXT">TXT (Text/SPF)</option>
                            <option value="NS">NS (Nameserver)</option>
                            <option value="CNAME">CNAME</option>
                            <option value="SOA">SOA</option>
                            <option value="CAA">CAA</option>
                            <option value="SRV">SRV</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Resolver Choice</label>
                        <select v-model="resolverChoice" class="form-select border-secondary bg-card text-foreground font-monospace">
                            <option value="system">System Resolver</option>
                            <option value="google_doh">Google DoH</option>
                            <option value="cloudflare_doh">Cloudflare DoH</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-3 align-self-end">
                        <button
                            class="btn btn-warning w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="queryDns"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Querying DNS...' : 'Query DNS' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Querying DNS resolver...</h5>
            <div class="text-muted small font-monospace">Fetching {{ recordType }} records for {{ domainInput }}</div>
        </div>

        <!-- DNS Query Results Table Dashboard -->
        <div v-else-if="result" class="dns-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">DNS Resolution Overview</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.domain }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge" :class="result.status === 'NOERROR' ? 'bg-success text-white' : 'bg-danger text-white'">
                                ● Status: {{ result.status }}
                            </span>
                            <span class="badge bg-secondary text-foreground font-monospace">Resolver: {{ result.resolver }}</span>
                            <span class="badge bg-primary text-white font-monospace">{{ result.totalRecords }} Records Found</span>
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

            <!-- Professional DNS Record Table -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>DNS Record Response Table</span>
                    <span class="small text-muted font-monospace">Checked: {{ formatDate(result.checkedAt) }}</span>
                </div>
                <div class="card-body p-0">
                    <div v-if="!result.records || result.records.length === 0" class="text-center py-5 text-muted">
                        <font-awesome-icon icon="search" class="fs-1 opacity-50 mb-2" />
                        <div class="fw-bold">No {{ recordType }} records found for {{ result.domain }}</div>
                        <div class="small">The requested domain or record type did not return active resource records.</div>
                    </div>
                    <div v-else class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-dark font-monospace small">
                                <tr>
                                    <th style="width: 12%;">TYPE</th>
                                    <th style="width: 58%;">RECORD VALUE</th>
                                    <th style="width: 15%;">TTL (SEC)</th>
                                    <th style="width: 15%;">PRIORITY</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(rec, idx) in result.records" :key="idx">
                                    <td class="py-3 px-3">
                                        <span class="badge bg-primary-subtle text-primary border border-primary font-monospace fw-bold">{{ rec.type }}</span>
                                    </td>
                                    <td class="font-monospace fw-semibold text-foreground py-3 px-3 text-break">{{ rec.value }}</td>
                                    <td class="font-monospace text-muted py-3 px-3">{{ rec.ttl }}</td>
                                    <td class="font-monospace text-muted py-3 px-3">{{ rec.priority }}</td>
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
            domainInput: "example.com",
            recordType: "ALL",
            resolverChoice: "system",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.queryDns();
    },
    methods: {
        queryDns() {
            if (!this.domainInput.trim()) {
                this.$root.toastError("Please provide a target domain name.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "dns-lookup",
                params: {
                    domain: this.domainInput.trim(),
                    recordType: this.recordType,
                    resolver: this.resolverChoice,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Retrieved ${res.result.totalRecords} DNS records for ${res.result.domain}`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute DNS query.");
                }
            });
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("DNS records copied to clipboard.");
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
            a.download = `dns-${this.result.domain}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported DNS JSON.");
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
