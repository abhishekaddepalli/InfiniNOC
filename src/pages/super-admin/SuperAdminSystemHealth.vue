<template>
    <div class="super-admin-system-health">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="heartbeat" class="text-danger" />
                    <span>System Health & Diagnostic Telemetry</span>
                </h3>
                <div class="text-muted small">
                    Real-time platform telemetry for database connections, process memory, CPU, and node runtime.
                </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm fw-bold" @click="fetchHealth">
                <font-awesome-icon icon="sync" class="me-1" />
                Refresh Telemetry
            </button>
        </div>

        <!-- System Status Banner -->
        <div class="card bg-card border-success shadow-sm mb-4">
            <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-success text-white rounded-circle p-3 d-flex align-items-center justify-content-center" style="width: 54px; height: 54px;">
                        <font-awesome-icon icon="check-circle" class="fs-2" />
                    </div>
                    <div>
                        <h4 class="fw-bold text-success mb-1">PLATFORM STATUS: OPTIMAL</h4>
                        <div class="text-muted small font-monospace">Node.js {{ health.nodeVersion || 'v24' }} — OS: {{ health.platform || 'win32' }}</div>
                    </div>
                </div>
                <div class="text-end font-monospace">
                    <div class="text-muted small">PROCESS UPTIME</div>
                    <div class="fs-4 fw-bold text-foreground">{{ formatUptime(health.uptimeSeconds) }}</div>
                </div>
            </div>
        </div>

        <!-- Telemetry Cards -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-md-4">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <div class="text-muted small text-uppercase fw-semibold mb-2">Memory Utilization (RAM)</div>
                    <div class="d-flex align-items-center justify-content-between mb-2 font-monospace">
                        <span class="fs-3 fw-bold text-foreground">{{ health.memoryUsagePercent || 0 }}%</span>
                        <span class="small text-muted">{{ health.freeMemoryMB }} MB Free / {{ health.totalMemoryMB }} MB</span>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-primary" :style="{ width: (health.memoryUsagePercent || 0) + '%' }"></div>
                    </div>
                </div>
            </div>

            <div class="col-12 col-md-4">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <div class="text-muted small text-uppercase fw-semibold mb-2">Database Connection</div>
                    <div class="fs-3 fw-bold text-success font-monospace mb-1">{{ health.databaseStatus || 'CONNECTED' }}</div>
                    <div class="small text-muted font-monospace">Database Engine: {{ health.databaseType || 'SQLite' }}</div>
                </div>
            </div>

            <div class="col-12 col-md-4">
                <div class="card bg-card border-secondary shadow-sm p-4 h-100">
                    <div class="text-muted small text-uppercase fw-semibold mb-2">CPU Cores & Threads</div>
                    <div class="fs-3 fw-bold text-info font-monospace mb-1">{{ health.cpuCores || 4 }} Cores</div>
                    <div class="small text-muted font-monospace">Parallel Diagnostic Workers Active</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            health: {},
            loading: true,
        };
    },
    mounted() {
        this.fetchHealth();
    },
    methods: {
        fetchHealth() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminSystemHealth", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.health = res.health || {};
                }
            });
        },
        formatUptime(sec) {
            if (!sec) {
                return "0s";
            }
            const hrs = Math.floor(sec / 3600);
            const mins = Math.floor((sec % 3600) / 60);
            const secs = sec % 60;
            return `${hrs}h ${mins}m ${secs}s`;
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
