<template>
    <div class="reverse-dns-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="search" class="text-primary" />
                    <span>Reverse DNS (PTR) Query Input</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Server Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target IP Address</label>
                        <input
                            v-model="ipInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 8.8.8.8, 1.1.1.1, or 2001:4860:4860::8888"
                            @keydown.enter="queryReverseDns"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="queryReverseDns"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Querying PTR...' : 'Lookup PTR' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Performing Reverse DNS PTR query...</h5>
            <div class="text-muted small font-monospace">Resolving IP address {{ ipInput }} to hostname</div>
        </div>

        <!-- Reverse DNS Query Results Dashboard -->
        <div v-else-if="result" class="ptr-results-dashboard">
            <!-- Header Summary Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Reverse DNS PTR Profile</div>
                        <h2 class="fw-bold font-monospace text-primary mb-1">{{ result.ip }}</h2>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge" :class="result.status === 'SUCCESS' ? 'bg-success text-white' : 'bg-warning text-dark'">
                                ● {{ result.status === 'SUCCESS' ? 'PTR Record Found' : 'No PTR Record' }}
                            </span>
                            <span class="badge bg-secondary text-foreground font-monospace">{{ result.totalRecords || 0 }} PTR Records</span>
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

            <!-- PTR Records Card -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Associated Reverse Domain Hostnames (PTR)</span>
                    <span class="small text-muted font-monospace">Checked: {{ formatDate(result.checkedAt) }}</span>
                </div>
                <div class="card-body p-4">
                    <div v-if="!result.ptrRecords || result.ptrRecords.length === 0" class="text-center py-4 text-muted">
                        <font-awesome-icon icon="exclamation-circle" class="fs-1 text-warning opacity-75 mb-2" />
                        <h5 class="fw-bold text-foreground mb-1">No PTR Record Found</h5>
                        <div class="small text-muted">{{ result.message || 'No reverse DNS hostname points to this IP address.' }}</div>
                    </div>
                    <div v-else class="list-group list-group-flush border border-secondary rounded">
                        <div v-for="(ptr, idx) in result.ptrRecords" :key="idx" class="list-group-item bg-card border-secondary p-3 d-flex align-items-center justify-content-between">
                            <span class="font-monospace fw-bold fs-5 text-primary">{{ ptr }}</span>
                            <span class="badge bg-success-subtle text-success border border-success px-3 py-1 font-monospace">PRIMARY PTR</span>
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
            ipInput: "8.8.8.8",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.queryReverseDns();
    },
    methods: {
        queryReverseDns() {
            if (!this.ipInput.trim()) {
                this.$root.toastError("Please provide a target IP address.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "reverse-dns",
                params: { ip: this.ipInput.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    if (res.result.status === "SUCCESS") {
                        this.$root.toastSuccess(`Resolved PTR hostname '${res.result.primaryPtr}' for ${res.result.ip}`);
                    } else {
                        this.$root.toastError(res.result.message || "No PTR record found.");
                    }
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute reverse DNS query.");
                }
            });
        },
        copyJson() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("PTR result copied to clipboard.");
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
            a.download = `ptr-${this.result.ip}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported PTR JSON.");
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
