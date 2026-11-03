<template>
    <div class="container-fluid py-4">
        <!-- Breadcrumb Navigation -->
        <nav aria-label="breadcrumb" class="mb-3">
            <ol class="breadcrumb small">
                <li class="breadcrumb-item">
                    <router-link to="/diagnostic-tools" class="text-decoration-none text-muted">
                        <font-awesome-icon icon="tools" class="me-1" /> Diagnostic Tools
                    </router-link>
                </li>
                <li class="breadcrumb-item text-uppercase text-muted fw-semibold">
                    {{ currentTool ? currentTool.category : 'Diagnostic' }}
                </li>
                <li class="breadcrumb-item active text-foreground fw-bold" aria-current="page">
                    {{ currentTool ? currentTool.name : toolSlug }}
                </li>
            </ol>
        </nav>

        <!-- Tool Title & Favorite Action -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon :icon="currentTool ? currentTool.icon : 'tools'" class="text-primary" />
                    <span>{{ currentTool ? currentTool.name : toolSlug }}</span>
                </h3>
                <div class="text-muted small">{{ currentTool ? currentTool.description : 'NOC Diagnostic Tool' }}</div>
            </div>
            <div class="d-flex gap-2">
                <button
                    class="btn btn-outline-warning btn-sm fw-semibold d-flex align-items-center gap-2"
                    @click="toggleFavorite"
                >
                    <font-awesome-icon icon="star" :class="{ 'text-muted opacity-50': !isFav }" />
                    <span>{{ isFav ? 'Favorited' : 'Add to Favorites' }}</span>
                </button>
                <router-link to="/diagnostic-tools" class="btn btn-outline-secondary btn-sm fw-semibold">
                    ← All Diagnostic Tools
                </router-link>
            </div>
        </div>

        <!-- Render Diagnostic Tool Views -->
        <div class="mb-4">
            <!-- 1. Connectivity -->
            <PingTool
                v-if="toolSlug === 'ping'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <TracerouteTool
                v-else-if="toolSlug === 'traceroute'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <MtrTool
                v-else-if="toolSlug === 'mtr'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <MtuTool
                v-else-if="toolSlug === 'mtu-test'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 2. Routing -->
            <RouteTableTool
                v-else-if="toolSlug === 'route-table'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 3. DNS & Domain -->
            <DnsLookupTool
                v-else-if="toolSlug === 'dns-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <DnsPropagationTool
                v-else-if="toolSlug === 'dns-propagation'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <ReverseDnsTool
                v-else-if="toolSlug === 'reverse-dns'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <DnsHealthTool
                v-else-if="toolSlug === 'dns-health'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 4. Port & Service -->
            <PortCheckerTool
                v-else-if="toolSlug === 'port-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <CommonServicesTool
                v-else-if="toolSlug === 'common-services'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <PortScannerTool
                v-else-if="toolSlug === 'port-scanner'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 5. SSL & Security -->
            <SslCheckerTool
                v-else-if="toolSlug === 'ssl-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <SslCiphersTool
                v-else-if="toolSlug === 'ssl-ciphers'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <SslDecoderTool
                v-else-if="toolSlug === 'ssl-decoder'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 6. HTTP & Web -->
            <HttpCheckerTool
                v-else-if="toolSlug === 'http-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <RedirectCheckerTool
                v-else-if="toolSlug === 'redirect-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <SecurityHeadersTool
                v-else-if="toolSlug === 'security-headers'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 7. IP Intelligence -->
            <IpCheckerTool
                v-else-if="toolSlug === 'ip-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <RdapLookupTool
                v-else-if="toolSlug === 'rdap-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <IpReputationTool
                v-else-if="toolSlug === 'ip-reputation'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <AsnLookupTool
                v-else-if="toolSlug === 'asn-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 8. Network Infrastructure (SNMP) -->
            <SnmpDiagnosticsTool
                v-else-if="['snmp-device', 'snmp-interfaces', 'snmp-routes', 'snmp-arp'].includes(toolSlug)"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 9. Calculators & Utilities -->
            <SubnetCalculatorTool
                v-else-if="toolSlug === 'subnet-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <CidrCalculatorTool
                v-else-if="toolSlug === 'cidr-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <IpRangeCalculatorTool
                v-else-if="toolSlug === 'ip-range-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <VlanCalculatorTool
                v-else-if="toolSlug === 'vlan-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <OpticalBudgetTool
                v-else-if="toolSlug === 'optical-budget'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <LinkUtilizationTool
                v-else-if="toolSlug === 'link-utilization'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <LatencyConverterTool
                v-else-if="toolSlug === 'latency-converter'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <BandwidthCalculatorTool
                v-else-if="toolSlug === 'bandwidth-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />
            <MacLookupTool
                v-else-if="toolSlug === 'mac-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- Fallback View -->
            <div v-else class="card bg-card border-secondary shadow-sm p-5 text-center my-4">
                <font-awesome-icon icon="tools" class="fs-1 text-primary mb-3 opacity-75" />
                <h4 class="fw-bold text-foreground mb-2">{{ currentTool ? currentTool.name : toolSlug }}</h4>
                <div class="text-muted small mb-4 max-w-md mx-auto">
                    NOC Diagnostic Tool Suite is fully active.
                </div>
                <div>
                    <router-link to="/diagnostic-tools" class="btn btn-primary btn-sm me-2 fw-semibold">Back to All Tools</router-link>
                </div>
            </div>
        </div>

        <!-- Tool History Panel -->
        <div class="card bg-card border-secondary shadow-sm mt-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="history" class="text-info" />
                    <span>Execution History — {{ currentTool ? currentTool.name : 'Tool' }}</span>
                </div>
                <span class="badge bg-secondary font-monospace">{{ toolHistory.length }} Records</span>
            </div>
            <div class="card-body p-0">
                <div v-if="toolHistory.length === 0" class="text-center py-4 text-muted small">
                    No recent execution records for this tool.
                </div>
                <div v-else class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>Timestamp</th>
                                <th>Target Input</th>
                                <th>Duration</th>
                                <th>Result Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(h, idx) in toolHistory" :key="idx">
                                <td class="small text-muted">{{ formatDate(h.timestamp || h.createdAt) }}</td>
                                <td class="fw-bold text-primary">{{ h.input || h.target }}</td>
                                <td class="small text-muted">{{ h.durationMs ? `${h.durationMs}ms` : '—' }}</td>
                                <td>
                                    <span class="badge" :class="getStatusBadge(h.status)">{{ h.status }}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import IpCheckerTool from "./tools/IpCheckerTool.vue";
import PortCheckerTool from "./tools/PortCheckerTool.vue";
import SubnetCalculatorTool from "./tools/SubnetCalculatorTool.vue";
import CidrCalculatorTool from "./tools/CidrCalculatorTool.vue";
import IpRangeCalculatorTool from "./tools/IpRangeCalculatorTool.vue";
import MacLookupTool from "./tools/MacLookupTool.vue";
import DnsLookupTool from "./tools/DnsLookupTool.vue";
import ReverseDnsTool from "./tools/ReverseDnsTool.vue";
import PingTool from "./tools/PingTool.vue";
import TracerouteTool from "./tools/TracerouteTool.vue";
import HttpCheckerTool from "./tools/HttpCheckerTool.vue";
import SslCheckerTool from "./tools/SslCheckerTool.vue";
import AsnLookupTool from "./tools/AsnLookupTool.vue";
import IpReputationTool from "./tools/IpReputationTool.vue";
import BandwidthCalculatorTool from "./tools/BandwidthCalculatorTool.vue";
import DnsPropagationTool from "./tools/DnsPropagationTool.vue";
import SslCiphersTool from "./tools/SslCiphersTool.vue";
import SecurityHeadersTool from "./tools/SecurityHeadersTool.vue";

// Newly implemented tools
import MtrTool from "./tools/MtrTool.vue";
import MtuTool from "./tools/MtuTool.vue";
import RouteTableTool from "./tools/RouteTableTool.vue";
import DnsHealthTool from "./tools/DnsHealthTool.vue";
import CommonServicesTool from "./tools/CommonServicesTool.vue";
import PortScannerTool from "./tools/PortScannerTool.vue";
import RedirectCheckerTool from "./tools/RedirectCheckerTool.vue";
import SslDecoderTool from "./tools/SslDecoderTool.vue";
import RdapLookupTool from "./tools/RdapLookupTool.vue";
import SnmpDiagnosticsTool from "./tools/SnmpDiagnosticsTool.vue";
import VlanCalculatorTool from "./tools/VlanCalculatorTool.vue";
import OpticalBudgetTool from "./tools/OpticalBudgetTool.vue";
import LinkUtilizationTool from "./tools/LinkUtilizationTool.vue";
import LatencyConverterTool from "./tools/LatencyConverterTool.vue";

export default {
    components: {
        IpCheckerTool,
        PortCheckerTool,
        SubnetCalculatorTool,
        CidrCalculatorTool,
        IpRangeCalculatorTool,
        MacLookupTool,
        DnsLookupTool,
        ReverseDnsTool,
        PingTool,
        TracerouteTool,
        HttpCheckerTool,
        SslCheckerTool,
        AsnLookupTool,
        IpReputationTool,
        BandwidthCalculatorTool,
        DnsPropagationTool,
        SslCiphersTool,
        SecurityHeadersTool,
        MtrTool,
        MtuTool,
        RouteTableTool,
        DnsHealthTool,
        CommonServicesTool,
        PortScannerTool,
        RedirectCheckerTool,
        SslDecoderTool,
        RdapLookupTool,
        SnmpDiagnosticsTool,
        VlanCalculatorTool,
        OpticalBudgetTool,
        LinkUtilizationTool,
        LatencyConverterTool,
    },
    data() {
        return {
            currentTool: null,
            isFav: false,
            history: [],
        };
    },
    computed: {
        toolSlug() {
            return this.$route.params.toolSlug || "ping";
        },
        toolHistory() {
            return this.history.filter((h) => (h.slug === this.toolSlug || h.toolId === this.toolSlug));
        },
    },
    watch: {
        toolSlug: {
            immediate: true,
            handler() {
                this.loadTool();
                this.fetchHistory();
            },
        },
    },
    methods: {
        loadTool() {
            this.$root.getSocket().emit("getToolRegistry", (res) => {
                if (res && res.ok && res.tools) {
                    this.currentTool = res.tools.find((t) => t.slug === this.toolSlug) || {
                        id: this.toolSlug,
                        name: this.toolSlug.replace(/-/g, " ").toUpperCase(),
                        slug: this.toolSlug,
                        category: "utility",
                        description: "NOC Diagnostic Tool",
                        executionType: "server",
                        icon: "tools",
                    };
                }
            });
            this.checkFavorite();
        },
        checkFavorite() {
            this.$root.getSocket().emit("getUserToolFavorites", (res) => {
                if (res && res.ok && res.favorites) {
                    this.isFav = res.favorites.includes(this.toolSlug);
                }
            });
        },
        toggleFavorite() {
            this.$root.getSocket().emit("toggleUserToolFavorite", { slug: this.toolSlug }, (res) => {
                if (res && res.ok) {
                    this.isFav = res.isFavorite;
                    this.$root.toastSuccess(this.isFav ? "Added to Favorites" : "Removed from Favorites");
                }
            });
        },
        fetchHistory() {
            this.$root.getSocket().emit("getRecentlyUsedTools", (res) => {
                if (res && res.ok && res.history) {
                    this.history = res.history;
                }
            });
        },
        onHistoryUpdated(newHistory) {
            if (Array.isArray(newHistory)) {
                this.history = newHistory;
            } else {
                this.fetchHistory();
            }
        },
        getStatusBadge(status) {
            const s = String(status || "").toUpperCase();
            if (s === "SUCCESS" || s === "OPEN" || s === "EXCELLENT" || s === "VALID" || s === "PASSED" || s === "OPTIMAL") {
                return "bg-success text-white";
            }
            if (s === "DEGRADED" || s === "EXPIRING_SOON" || s === "MARGINAL" || s === "WARNING") {
                return "bg-warning text-dark";
            }
            return "bg-danger text-white";
        },
        formatDate(isoStr) {
            if (!isoStr) return "";
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
