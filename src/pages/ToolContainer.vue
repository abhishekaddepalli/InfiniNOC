<template>
    <div class="container-fluid py-4">
        <!-- Breadcrumb Navigation -->
        <nav aria-label="breadcrumb" class="mb-3">
            <ol class="breadcrumb small">
                <li class="breadcrumb-item">
                    <router-link to="/tools" class="text-decoration-none text-muted">
                        <font-awesome-icon icon="wrench" class="me-1" /> Tools
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
                    <font-awesome-icon :icon="currentTool ? currentTool.icon : 'wrench'" class="text-primary" />
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
                <router-link to="/tools" class="btn btn-outline-secondary btn-sm fw-semibold">
                    ← All Tools
                </router-link>
            </div>
        </div>

        <!-- Render Diagnostic Tool Views -->
        <div class="mb-4">
            <!-- 1. IP Intelligence Checker -->
            <IpCheckerTool
                v-if="toolSlug === 'ip-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 2. TCP Port Checker -->
            <PortCheckerTool
                v-else-if="toolSlug === 'port-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 3. Subnet Calculator -->
            <SubnetCalculatorTool
                v-else-if="toolSlug === 'subnet-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 4. CIDR Calculator -->
            <CidrCalculatorTool
                v-else-if="toolSlug === 'cidr-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 5. IP Range Calculator -->
            <IpRangeCalculatorTool
                v-else-if="toolSlug === 'ip-range-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 6. MAC / OUI Lookup -->
            <MacLookupTool
                v-else-if="toolSlug === 'mac-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 7. DNS Lookup -->
            <DnsLookupTool
                v-else-if="toolSlug === 'dns-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 8. Reverse DNS -->
            <ReverseDnsTool
                v-else-if="toolSlug === 'reverse-dns'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 9. Ping Test -->
            <PingTool
                v-else-if="toolSlug === 'ping'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 10. Traceroute Diagnostic -->
            <TracerouteTool
                v-else-if="toolSlug === 'traceroute'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 11. HTTP / HTTPS Checker -->
            <HttpCheckerTool
                v-else-if="toolSlug === 'http-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 12. SSL Certificate Checker -->
            <SslCheckerTool
                v-else-if="toolSlug === 'ssl-checker'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 13. ASN / BGP Lookup -->
            <AsnLookupTool
                v-else-if="toolSlug === 'asn-lookup'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 14. IP Reputation / Blacklist -->
            <IpReputationTool
                v-else-if="toolSlug === 'ip-reputation'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- 15. Bandwidth & Transfer Calculator -->
            <BandwidthCalculatorTool
                v-else-if="toolSlug === 'bandwidth-calculator'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- NEW 16. DNS Propagation Checker -->
            <DnsPropagationTool
                v-else-if="toolSlug === 'dns-propagation'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- NEW 17. TLS / SSL Cipher Suite Audit -->
            <SslCiphersTool
                v-else-if="toolSlug === 'ssl-ciphers'"
                :tool="currentTool"
                @history-updated="onHistoryUpdated"
            />

            <!-- NEW 18. HTTP Security Headers Hardening -->
            <SecurityHeadersTool
                v-else-if="toolSlug === 'security-headers'"
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
                    <router-link to="/tools" class="btn btn-primary btn-sm me-2 fw-semibold">Back to All Tools</router-link>
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
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Timestamp</th>
                                <th>Target Input</th>
                                <th>Result Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(h, idx) in toolHistory" :key="idx">
                                <td class="small text-muted">{{ formatDate(h.timestamp) }}</td>
                                <td class="font-monospace fw-bold text-primary">{{ h.input }}</td>
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
            return this.$route.params.toolSlug || "ip-checker";
        },
        toolHistory() {
            return this.history.filter((h) => h.slug === this.toolSlug);
        },
    },
    watch: {
        toolSlug: {
            immediate: true,
            handler() {
                this.loadTool();
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
                        icon: "wrench",
                    };
                }
            });
            this.checkFav();
            this.fetchHistory();
        },
        checkFav() {
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
                    this.$root.toastSuccess(res.isFavorite ? "Added to favorites" : "Removed from favorites");
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
            if (newHistory) {
                this.history = newHistory;
            }
        },
        getStatusBadge(status) {
            if (status === "OPEN" || status === "SUCCESS" || status === "NOERROR" || status === "VALID" || status === "CLEAN" || status === "EXCELLENT" || status === "COMPLETED") {
                return "bg-success text-white";
            }
            if (status === "CLOSED" || status === "FAILED" || status === "NXDOMAIN" || status === "HTTP_ERROR" || status === "BLACK_LISTED" || status === "EXPIRED") {
                return "bg-danger text-white";
            }
            if (status === "TIMEOUT" || status === "NO_PTR" || status === "DEGRADED" || status === "EXPIRING_SOON") {
                return "bg-warning text-dark";
            }
            return "bg-secondary text-white";
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
