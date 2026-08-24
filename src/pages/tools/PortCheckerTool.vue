<template>
    <div class="port-checker-tool">
        <!-- Tool Execution Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="plug" class="text-primary" />
                    <span>TCP Connectivity Test Parameters</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Server Execution</span>
            </div>
            <div class="card-body p-4">
                <div class="row g-3">
                    <div class="col-12 col-md-5">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1 or example.com"
                            @keydown.enter="runTest"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Port Number</label>
                        <input
                            v-model.number="targetPort"
                            type="number"
                            min="1"
                            max="65535"
                            class="form-control border-secondary bg-card text-foreground font-monospace"
                            placeholder="443"
                            @keydown.enter="runTest"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Protocol</label>
                        <select v-model="targetProtocol" class="form-select border-secondary bg-card text-foreground font-monospace">
                            <option value="TCP">TCP</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-3">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Timeout (Seconds)</label>
                        <select v-model.number="targetTimeout" class="form-select border-secondary bg-card text-foreground font-monospace">
                            <option :value="2">2 seconds</option>
                            <option :value="5">5 seconds (Default)</option>
                            <option :value="10">10 seconds</option>
                        </select>
                    </div>
                    <div class="col-12 mt-3">
                        <button
                            class="btn btn-warning w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runTest"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Testing TCP Connection...' : 'Test Port Connectivity' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-warning mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Testing TCP connection...</h5>
            <div class="text-muted small font-monospace">Initiating socket handshake to {{ targetHost }}:{{ targetPort }} (Timeout: {{ targetTimeout }}s)</div>
        </div>

        <!-- Port Test Result Dashboard -->
        <div v-else-if="result" class="port-test-dashboard">
            <!-- Large Status Banner -->
            <div
                class="card border-0 shadow-sm mb-4 p-4 text-white"
                :class="statusCardClass"
            >
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="status-badge-circle d-flex align-items-center justify-content-center rounded-circle p-3" style="width: 56px; height: 56px; background: rgba(255,255,255,0.2);">
                            <font-awesome-icon :icon="statusIcon" class="fs-3" />
                        </div>
                        <div>
                            <div class="small text-uppercase fw-bold opacity-75">TCP Connection Result</div>
                            <h2 class="fw-extrabold mb-0 font-monospace">{{ result.status }}</h2>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="small text-uppercase opacity-75">Connect Time</div>
                        <div class="fs-3 fw-bold font-monospace">
                            {{ result.connectTimeMs !== null ? `${result.connectTimeMs} ms` : 'N/A' }}
                        </div>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-top border-white border-opacity-25 small font-monospace">
                    {{ result.message }}
                </div>
            </div>

            <!-- Technical Details Card -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex align-items-center justify-content-between">
                    <span class="fw-bold text-foreground">Technical Connection Breakdown</span>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="copyResult">
                            <font-awesome-icon icon="copy" class="me-1" /> Copy
                        </button>
                        <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="exportResult">
                            <font-awesome-icon icon="download" class="me-1" /> Export JSON
                        </button>
                        <button class="btn btn-outline-primary btn-sm fw-semibold" @click="runTest">
                            <font-awesome-icon icon="sync-alt" class="me-1" /> Test Again
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <tbody>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4" style="width: 30%;">Target Host</td>
                                    <td class="font-monospace fw-bold text-primary py-3 px-4">{{ result.host }}</td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Resolved Destination IP</td>
                                    <td class="font-monospace text-foreground py-3 px-4">{{ result.resolvedIp || 'N/A' }}</td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Port / Protocol</td>
                                    <td class="font-monospace text-foreground py-3 px-4">{{ result.port }} / {{ result.protocol }}</td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Handshake Status</td>
                                    <td class="py-3 px-4">
                                        <span class="badge" :class="statusBadgeClass">{{ result.status }}</span>
                                        <span v-if="result.errorCode" class="ms-2 font-monospace small text-muted">({{ result.errorCode }})</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Configured Timeout</td>
                                    <td class="font-monospace text-foreground py-3 px-4">{{ targetTimeout * 1000 }} ms</td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Execution Source</td>
                                    <td class="font-monospace text-foreground py-3 px-4">{{ result.executionSource || 'InfiniNOC Server' }}</td>
                                </tr>
                                <tr>
                                    <td class="fw-semibold text-muted py-3 px-4">Checked Timestamp</td>
                                    <td class="font-monospace text-muted py-3 px-4">{{ formatDate(result.checkedAt) }}</td>
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
            targetHost: "1.1.1.1",
            targetPort: 53,
            targetProtocol: "TCP",
            targetTimeout: 5,
            loading: false,
            result: null,
        };
    },
    computed: {
        statusCardClass() {
            if (!this.result) {
                return "bg-secondary";
            }
            if (this.result.status === "OPEN") {
                return "bg-success";
            }
            if (this.result.status === "CLOSED") {
                return "bg-danger";
            }
            if (this.result.status === "TIMEOUT") {
                return "bg-warning text-dark";
            }
            return "bg-dark text-white";
        },
        statusBadgeClass() {
            if (!this.result) {
                return "bg-secondary";
            }
            if (this.result.status === "OPEN") {
                return "bg-success text-white";
            }
            if (this.result.status === "CLOSED") {
                return "bg-danger text-white";
            }
            if (this.result.status === "TIMEOUT") {
                return "bg-warning text-dark";
            }
            return "bg-secondary text-white";
        },
        statusIcon() {
            if (!this.result) {
                return "plug";
            }
            if (this.result.status === "OPEN") {
                return "check-circle";
            }
            if (this.result.status === "CLOSED") {
                return "times-circle";
            }
            if (this.result.status === "TIMEOUT") {
                return "clock";
            }
            return "exclamation-triangle";
        },
    },
    mounted() {
        this.runTest();
    },
    methods: {
        runTest() {
            if (!this.targetHost.trim()) {
                this.$root.toastError("Please provide a target host or IP.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "port-checker",
                params: {
                    host: this.targetHost.trim(),
                    port: this.targetPort,
                    protocol: this.targetProtocol,
                    timeout: this.targetTimeout * 1000,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    if (res.result.status === "OPEN") {
                        this.$root.toastSuccess(`Port ${this.targetPort} on ${this.targetHost} is OPEN (${res.result.connectTimeMs}ms)`);
                    } else {
                        this.$root.toastError(`Port test result: ${res.result.status}`);
                    }
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to execute TCP port test.");
                }
            });
        },
        copyResult() {
            if (!this.result) {
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(this.result, null, 2)).then(() => {
                this.$root.toastSuccess("Port test result copied to clipboard.");
            });
        },
        exportResult() {
            if (!this.result) {
                return;
            }
            const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `port-test-${this.result.host}-${this.result.port}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Exported port test JSON.");
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
