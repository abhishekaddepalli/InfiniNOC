<template>
    <div class="snmp-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="server" class="text-primary" />
                    <span>SNMP Infrastructure Diagnostics</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Managed Device MIB-II Query</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Query Sub-System</label>
                        <select v-model="queryType" class="form-select form-select-lg border-secondary bg-card text-foreground font-monospace">
                            <option value="device-info">System Description (sysDescr & Uptime)</option>
                            <option value="interfaces">Interface Status & Traffic (ifTable)</option>
                            <option value="routes">Remote Route Table (ipRouteTable)</option>
                            <option value="arp">ARP Table Lookup (ipNetToMediaTable)</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-4">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target Managed Device / IP</label>
                        <input
                            v-model="targetHost"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 192.168.1.1 or Core-Router"
                            @keydown.enter="runSnmp"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Community</label>
                        <input
                            v-model="community"
                            type="password"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="public"
                        />
                    </div>
                    <div class="col-6 col-md-2">
                        <button
                            class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                            :disabled="loading"
                            @click="runSnmp"
                        >
                            <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                            <font-awesome-icon v-else icon="play" />
                            <span>{{ loading ? 'Querying...' : 'Query SNMP' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Querying SNMP agent on {{ targetHost }}...</h5>
            <div class="text-muted small font-monospace">Executing {{ queryType }} MIB walk</div>
        </div>

        <div v-else-if="result" class="snmp-results-dashboard">
            <!-- 1. System Info View -->
            <div v-if="result.system" class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>System Information — {{ result.label || result.host }}</span>
                    <span class="badge bg-success font-monospace">SNMP Responsive</span>
                </div>
                <div class="card-body p-4 font-monospace">
                    <div class="row g-3">
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">System Name</div>
                            <div class="fw-bold text-primary">{{ result.system.sysName }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">System Uptime</div>
                            <div class="fw-bold text-success">{{ result.system.sysUpTimeFormatted }}</div>
                        </div>
                        <div class="col-12">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">System Description (sysDescr)</div>
                            <div class="p-2 bg-secondary-subtle border border-secondary rounded text-break small">{{ result.system.sysDescr }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">SysObjectID</div>
                            <div class="text-muted small">{{ result.system.sysObjectID }}</div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="text-muted small text-uppercase fw-semibold mb-1">Location / Contact</div>
                            <div class="text-muted small">{{ result.system.sysLocation }} · {{ result.system.sysContact }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Interfaces View -->
            <div v-else-if="result.interfaces" class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Interface Status & Speed (ifTable)</span>
                    <span class="badge bg-primary font-monospace">{{ result.upCount }} of {{ result.totalInterfaces }} Interfaces UP</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>INDEX</th>
                                    <th>INTERFACE NAME</th>
                                    <th>SPEED</th>
                                    <th>OPER STATUS</th>
                                    <th>ADMIN STATUS</th>
                                    <th>IN OCTETS</th>
                                    <th>OUT OCTETS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="i in result.interfaces" :key="i.index" :class="{ 'table-active': i.operStatus === 'UP' }">
                                    <td class="fw-bold text-muted">#{{ i.index }}</td>
                                    <td class="fw-bold text-primary">{{ i.name }}</td>
                                    <td>{{ i.speedFormatted }}</td>
                                    <td>
                                        <span class="badge" :class="i.operStatus === 'UP' ? 'bg-success' : 'bg-danger'">
                                            {{ i.operStatus }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge" :class="i.adminStatus === 'UP' ? 'bg-secondary' : 'bg-dark'">
                                            {{ i.adminStatus }}
                                        </span>
                                    </td>
                                    <td>{{ i.inOctets.toLocaleString() }}</td>
                                    <td>{{ i.outOctets.toLocaleString() }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 3. Routes View -->
            <div v-else-if="result.routes" class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Remote Router Routing Table (ipRouteTable)</span>
                    <span class="badge bg-primary font-monospace">{{ result.totalRoutes }} Routes</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>DESTINATION</th>
                                    <th>NETMASK</th>
                                    <th>NEXT HOP</th>
                                    <th>IF INDEX</th>
                                    <th>METRIC</th>
                                    <th>TYPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, idx) in result.routes" :key="idx">
                                    <td class="fw-bold text-primary">{{ r.destination }}</td>
                                    <td>{{ r.netmask }}</td>
                                    <td class="fw-bold text-foreground">{{ r.nextHop }}</td>
                                    <td>#{{ r.ifIndex }}</td>
                                    <td>{{ r.metric }}</td>
                                    <td><span class="badge bg-secondary">{{ r.type }}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 4. ARP View -->
            <div v-else-if="result.arp" class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                    <span>Remote Device ARP Table (ipNetToMediaTable)</span>
                    <span class="badge bg-primary font-monospace">{{ result.totalEntries }} ARP Entries</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>IP ADDRESS</th>
                                    <th>MAC ADDRESS</th>
                                    <th>INTERFACE</th>
                                    <th>ENTRY TYPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(a, idx) in result.arp" :key="idx">
                                    <td class="fw-bold text-primary">{{ a.ipAddress }}</td>
                                    <td class="fw-bold text-foreground">{{ a.macAddress }}</td>
                                    <td>#{{ a.ifIndex }}</td>
                                    <td><span class="badge bg-secondary">{{ a.type }}</span></td>
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
            queryType: "device-info",
            targetHost: "192.168.1.1",
            community: "public",
            loading: false,
            result: null,
        };
    },
    methods: {
        runSnmp() {
            if (!this.targetHost.trim()) return;
            this.loading = true;
            this.result = null;

            const slug = this.queryType === "interfaces" ? "snmp-interfaces" : (this.queryType === "routes" ? "snmp-routes" : (this.queryType === "arp" ? "snmp-arp" : "snmp-device"));

            this.$root.getSocket().emit("executeTool", {
                slug,
                params: {
                    host: this.targetHost.trim(),
                    community: this.community.trim(),
                    queryType: this.queryType,
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess("SNMP query completed successfully");
                } else {
                    this.$root.toastError((res && res.msg) || (res && res.result && res.result.error) || "SNMP query failed.");
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
