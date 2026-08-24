<template>
    <div class="ip-reputation-tool">
        <!-- Input Form Card -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="shield-alt" class="text-primary" />
                    <span>IP Reputation & DNSBL Blacklist Checker</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">23+ Major Global DNSBL Zones</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">Target IP Address or Domain</label>
                        <input
                            v-model="ipInput"
                            type="text"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="Enter IPv4 address or domain (e.g. spidecloud.in, 1.1.1.1)"
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
                            <font-awesome-icon v-else icon="search" />
                            <span>{{ loading ? 'Checking Blacklists...' : 'Check Reputation' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
            <div class="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h5 class="fw-bold text-foreground mb-1">Scanning 23+ Global DNSBL Blacklist Zones...</h5>
            <div class="text-muted small font-monospace">Querying Spamhaus, Mailspike, Barracuda, Spamcop, SORBS, UCEPROTECT, CBL & RBL resolvers for {{ ipInput }}</div>
        </div>

        <!-- Main Dashboard Results -->
        <div v-else-if="result" class="reputation-dashboard">
            <!-- Header Metrics Banner -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Target Host IP — {{ result.ip }}</div>
                        <div class="d-flex align-items-center gap-3 flex-wrap">
                            <h1 class="fw-bold font-monospace text-primary mb-0">{{ result.reputationScore }} / 100</h1>
                            <span class="badge fs-6 px-3 py-2" :class="getRiskBadgeClass(result.riskLevel)">
                                {{ result.riskLevel }} REPUTATION
                            </span>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-4 text-center font-monospace">
                        <div>
                            <div class="text-muted small text-uppercase">Listed Zones</div>
                            <div class="fs-4 fw-bold" :class="result.listedCount > 0 ? 'text-danger' : 'text-success'">
                                {{ result.listedCount }}
                            </div>
                        </div>
                        <div>
                            <div class="text-muted small text-uppercase">Clean Zones</div>
                            <div class="fs-4 fw-bold text-success">{{ result.cleanCount }}</div>
                        </div>
                        <div>
                            <div class="text-muted small text-uppercase">Total Scanned</div>
                            <div class="fs-4 fw-bold text-foreground">{{ result.totalZonesChecked }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Delisting & Remediation Action Plan Panel (If Listed) -->
            <div v-if="result.listedCount > 0" class="card bg-card border-danger shadow-sm mb-4">
                <div class="card-header bg-danger text-white py-3 px-4 fw-bold d-flex align-items-center justify-content-between">
                    <span class="d-flex align-items-center gap-2">
                        <font-awesome-icon icon="exclamation-triangle" />
                        <span>IP Blacklist Delisting & Remediation Guide</span>
                    </span>
                    <span class="badge bg-white text-danger font-monospace">{{ result.listedCount }} Blacklist Listings Detected</span>
                </div>
                <div class="card-body p-4">
                    <p class="small text-foreground mb-3">
                        Your IP address <strong class="text-danger font-monospace">{{ result.ip }}</strong> is currently flagged on <strong>{{ result.listedCount }}</strong> blacklist databases. Follow the recommended remediation steps below to resolve root causes and request official delisting:
                    </p>
                    <div class="row g-3">
                        <div v-for="(step, idx) in result.remediationGuide" :key="idx" class="col-12 col-md-6">
                            <div class="p-3 bg-secondary-subtle border border-secondary rounded h-100">
                                <div class="fw-bold text-warning small mb-1">{{ step.step }}</div>
                                <div class="small text-muted">{{ step.detail }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DNSBL Blacklist Zone Table Card -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span class="fw-bold text-foreground">DNSBL Blacklist Zone Results</span>
                    <div class="btn-group btn-group-sm">
                        <button
                            class="btn"
                            :class="filterTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'"
                            @click="filterTab = 'all'"
                        >
                            All Zones ({{ result.zones ? result.zones.length : 0 }})
                        </button>
                        <button
                            class="btn"
                            :class="filterTab === 'listed' ? 'btn-danger' : 'btn-outline-secondary'"
                            @click="filterTab = 'listed'"
                        >
                            Listed Only ({{ result.listedCount }})
                        </button>
                        <button
                            class="btn"
                            :class="filterTab === 'clean' ? 'btn-success' : 'btn-outline-secondary'"
                            @click="filterTab = 'clean'"
                        >
                            Clean Only ({{ result.cleanCount }})
                        </button>
                    </div>
                </div>

                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>BLACKLIST ZONE</th>
                                    <th>CATEGORY</th>
                                    <th>STATUS</th>
                                    <th>RESPONSE CODE</th>
                                    <th>DELISTING & REMOVAL INSTRUCTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(z, idx) in filteredZones" :key="idx">
                                    <td class="py-3 px-3">
                                        <div class="fw-bold text-foreground">{{ z.name }}</div>
                                        <div class="small text-muted opacity-75">{{ z.zone }}</div>
                                    </td>
                                    <td class="text-muted small py-3 px-3">{{ z.category }}</td>
                                    <td class="py-3 px-3">
                                        <span class="badge" :class="z.listed ? 'bg-danger text-white' : 'bg-success text-white'">
                                            {{ z.listed ? 'LISTED' : 'CLEAN' }}
                                        </span>
                                    </td>
                                    <td class="py-3 px-3" :class="z.listed ? 'text-danger fw-bold' : 'text-success'">
                                        {{ z.responseCode }}
                                    </td>
                                    <td class="py-3 px-3">
                                        <div class="small text-muted mb-1">{{ z.info }}</div>
                                        <a
                                            v-if="z.delistUrl"
                                            :href="z.delistUrl"
                                            target="_blank"
                                            class="btn btn-outline-warning btn-xs fw-semibold"
                                        >
                                            <font-awesome-icon icon="external-link-alt" class="me-1" />
                                            Request Delisting ↗
                                        </a>
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
            ipInput: "spidecloud.in",
            loading: false,
            result: null,
            filterTab: "all",
        };
    },
    computed: {
        filteredZones() {
            if (!this.result || !this.result.zones) {
                return [];
            }
            if (this.filterTab === "listed") {
                return this.result.zones.filter((z) => z.listed);
            }
            if (this.filterTab === "clean") {
                return this.result.zones.filter((z) => !z.listed);
            }
            return this.result.zones;
        },
    },
    mounted() {
        this.runCheck();
    },
    methods: {
        runCheck() {
            if (!this.ipInput.trim()) {
                this.$root.toastError("Please enter a target IP address or domain.");
                return;
            }

            this.loading = true;
            this.result = null;

            this.$root.getSocket().emit("executeTool", {
                slug: "ip-reputation",
                params: {
                    ip: this.ipInput.trim(),
                    target: this.ipInput.trim(),
                },
            }, (res) => {
                this.loading = false;
                if (res && res.ok && (res.result || res.ip)) {
                    this.result = res.result || res;
                    this.$emit("history-updated", res.history);
                    this.$root.toastSuccess(`Checked IP reputation for ${this.result.ip}`);
                } else {
                    this.$root.toastError((res && res.error) || (res && res.msg) || "Failed to check IP reputation.");
                }
            });
        },
        getRiskBadgeClass(riskLevel) {
            if (riskLevel === "CRITICAL") {
                return "bg-danger text-white";
            }
            if (riskLevel === "WARNING") {
                return "bg-warning text-dark";
            }
            return "bg-success text-white";
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
