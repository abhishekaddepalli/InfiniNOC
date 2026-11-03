<template>
    <div class="common-services-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="tasks" class="text-primary" />
                    <span>Common Network Services Reachability</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Concurrent TCP Probe</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Host / IP Address</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 1.1.1.1 or example.com"
                            @keydown.enter="runCheck"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runCheck"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Testing Services...' : 'Audit Services' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Concurrently probing standard service ports...</h5>
            <div class="text-muted small font-monospace">Testing HTTP (80), HTTPS (443), SSH (22), DNS (53), DBs on {{ targetHost }}</div>
        </div>

        <div v-else-if="result" class="services-results-dashboard">
            <div class="alert border-secondary shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4" :class="result.openCount > 0 ? 'alert-info' : 'alert-secondary'">
                <div>
                    <span class="fw-bold">{{ result.openCount }} of {{ result.testedCount }} standard services are open</span>
                    <span class="small font-monospace ms-2">({{ result.host }} · {{ result.resolvedIp }})</span>
                </div>
                <span class="badge bg-secondary font-monospace text-uppercase">Node: {{ result.executionLocation || 'Central Server' }}</span>
            </div>

            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground">
                    <span>Well-Known Service Ports</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>PORT</th>
                                    <th>SERVICE NAME</th>
                                    <th>DESCRIPTION</th>
                                    <th>PROTOCOL</th>
                                    <th>LATENCY</th>
                                    <th>STATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="s in result.services" :key="s.port" :class="{ 'table-active': s.state === 'OPEN' }">
                                    <td class="fw-bold">{{ s.port }}</td>
                                    <td class="fw-bold text-primary">{{ s.name }}</td>
                                    <td class="text-muted small">{{ s.description }}</td>
                                    <td>{{ s.protocol }}</td>
                                    <td>{{ s.rttMs }} ms</td>
                                    <td>
                                        <span class="badge" :class="s.state === 'OPEN' ? 'bg-success text-white' : (s.state === 'CLOSED' ? 'bg-secondary' : 'bg-danger text-white')">
                                            {{ s.state }}
                                        </span>
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
    props: { tool: { type: Object, default: null } },
    emits: ["history-updated"],
    data() {
        return {
            targetHost: "1.1.1.1",
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.runCheck();
    },
    methods: {
        runCheck() {
            if (!this.targetHost.trim()) return;
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "common-services",
                params: { host: this.targetHost.trim() },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Discovered ${res.result.openCount} open services on ${res.result.host}`);
                } else {
                    this.$root.toastError((res && res.msg) || "Service check failed.");
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
