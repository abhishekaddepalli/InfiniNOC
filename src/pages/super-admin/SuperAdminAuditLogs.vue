<template>
    <div class="super-admin-audit-logs">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="history" class="text-secondary" />
                    <span>Platform Security & Audit Stream</span>
                </h3>
                <div class="text-muted small">
                    Immutable event stream of administrative actions, organization creation, impersonation, and security events.
                </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm fw-bold" @click="fetchLogs">
                <font-awesome-icon icon="sync" class="me-1" />
                Refresh Stream
            </button>
        </div>

        <!-- Audit Table Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0 text-foreground text-uppercase">Platform Audit Log Entries ({{ logs.length }})</h6>
                <span class="badge bg-secondary font-monospace">Append-Only Event Stream</span>
            </div>
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary me-2" role="status"></div>
                    <span>Loading audit log stream...</span>
                </div>

                <div v-else-if="logs.length > 0" class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>LOG ID</th>
                                <th>ORGANIZATION</th>
                                <th>EVENT TYPE</th>
                                <th>PERFORMED BY</th>
                                <th>EVENT DETAILS</th>
                                <th>TIMESTAMP</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="l in logs" :key="l.id">
                                <td class="fw-bold text-muted">#{{ l.id }}</td>
                                <td>{{ l.org_name || 'System / Platform' }}</td>
                                <td>
                                    <span class="badge bg-secondary text-uppercase">{{ l.event }}</span>
                                </td>
                                <td class="fw-bold text-foreground">{{ l.username || 'System' }}</td>
                                <td class="text-muted small text-truncate" style="max-width: 350px;">{{ l.details }}</td>
                                <td class="text-muted small">{{ l.created_at }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else class="text-center py-5 text-muted small">
                    No platform audit events logged yet.
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            logs: [],
            loading: true,
        };
    },
    mounted() {
        this.fetchLogs();
    },
    methods: {
        fetchLogs() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminAuditLogs", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.logs = res.logs || [];
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
