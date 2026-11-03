<template>
    <div class="route-table-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="project-diagram" class="text-primary" />
                    <span>Host Kernel Routing Table</span>
                </span>
                <button class="btn btn-outline-primary btn-sm fw-semibold" :disabled="loading" @click="fetchRouteTable">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    <font-awesome-icon v-else icon="sync" class="me-1" />
                    Refresh Route Table
                </button>
            </div>
            <div class="card-body p-4">
                <div class="text-muted small">
                    Displays the authentic kernel IPv4 routing table from the active central monitoring node, showing network destinations, next-hop gateways, interface adapters, and metric priorities.
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Reading kernel routing table...</h5>
        </div>

        <div v-else-if="result" class="route-table-dashboard">
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Active IPv4 Routes</span>
                    <span class="badge bg-primary font-monospace">{{ result.totalRoutes }} Active Routes</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>DESTINATION</th>
                                    <th>NETMASK</th>
                                    <th>GATEWAY / NEXT HOP</th>
                                    <th>INTERFACE</th>
                                    <th>METRIC</th>
                                    <th>TYPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, idx) in result.routes" :key="idx" :class="{ 'table-active': r.type === 'DEFAULT_GATEWAY' }">
                                    <td class="fw-bold text-primary">{{ r.destination }}</td>
                                    <td class="text-muted">{{ r.netmask }}</td>
                                    <td class="fw-bold" :class="r.type === 'DEFAULT_GATEWAY' ? 'text-success' : 'text-foreground'">
                                        {{ r.gateway }}
                                    </td>
                                    <td>{{ r.interface }}</td>
                                    <td>{{ r.metric }}</td>
                                    <td>
                                        <span class="badge" :class="r.type === 'DEFAULT_GATEWAY' ? 'bg-success' : 'bg-secondary'">
                                            {{ r.type }}
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
            loading: false,
            result: null,
        };
    },
    mounted() {
        this.fetchRouteTable();
    },
    methods: {
        fetchRouteTable() {
            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "route-table",
                params: {},
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Loaded ${res.result.totalRoutes} kernel routes`);
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to load route table.");
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
