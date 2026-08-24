<template>
    <div>
        <!-- Search Trigger Input (Desktop Header Bar) -->
        <div class="noc-search-trigger-box d-none d-md-flex align-items-center" @click="openSearch">
            <font-awesome-icon icon="search" class="text-muted me-2" />
            <span class="search-placeholder text-muted">Search monitors, devices, sites...</span>
            <kbd class="ms-auto search-kbd">{{ shortcutLabel }}</kbd>
        </div>

        <!-- Search Trigger Icon Button (Mobile Header Bar) -->
        <button
            class="btn btn-sm btn-outline-secondary d-md-none border-0 rounded-circle"
            aria-label="Search"
            title="Search"
            @click="openSearch"
        >
            <font-awesome-icon icon="search" />
        </button>

        <!-- Search Modal Dialog Overlay -->
        <div v-if="isOpen" class="noc-search-overlay" @click.self="closeSearch">
            <div class="noc-search-modal card shadow-lg border-secondary">
                <!-- Search Input Header -->
                <div class="card-header bg-transparent border-bottom border-secondary p-3 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="search" class="text-primary fs-5" />
                    <input
                        ref="searchInput"
                        v-model="query"
                        type="text"
                        class="form-control form-control-lg border-0 bg-transparent text-foreground shadow-none px-0"
                        placeholder="Type to search monitors, devices, sites, incidents..."
                        @keydown.down.prevent="navigateResults(1)"
                        @keydown.up.prevent="navigateResults(-1)"
                        @keydown.enter.prevent="selectCurrentResult"
                        @keydown.esc.prevent="closeSearch"
                    />
                    <kbd class="text-muted small">ESC</kbd>
                </div>

                <!-- Category Filter Tabs -->
                <div class="px-3 py-2 border-bottom border-secondary d-flex gap-2 bg-secondary-subtle">
                    <button
                        v-for="cat in categories"
                        :key="cat.id"
                        class="btn btn-xs rounded-pill px-3 py-1 fw-semibold text-capitalize"
                        :class="activeCategory === cat.id ? 'btn-primary' : 'btn-outline-secondary'"
                        @click="activeCategory = cat.id"
                    >
                        {{ cat.label }} ({{ getCategoryCount(cat.id) }})
                    </button>
                </div>

                <!-- Search Results Body -->
                <div class="card-body p-2 overflow-y-auto" style="max-height: 400px;">
                    <div v-if="filteredResults.length === 0" class="text-center py-5 text-muted">
                        <font-awesome-icon icon="search-minus" class="fs-1 mb-2 opacity-50" />
                        <div class="fw-semibold">No results found for "{{ query }}"</div>
                        <div class="small">Try searching by monitor name, IP address, device, or incident title.</div>
                    </div>

                    <div v-else class="list-group list-group-flush">
                        <div
                            v-for="(item, index) in filteredResults"
                            :key="item.id || index"
                            class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-3 rounded mb-1 border-0 cursor-pointer"
                            :class="{ 'bg-primary text-white': selectedIndex === index }"
                            @mouseenter="selectedIndex = index"
                            @click="clickResult(item)"
                        >
                            <div class="d-flex align-items-center gap-3">
                                <div
                                    class="type-icon rounded-circle d-flex align-items-center justify-content-center"
                                    :class="getTypeIconBg(item)"
                                    style="width: 36px; height: 36px;"
                                >
                                    <font-awesome-icon :icon="getTypeIcon(item)" />
                                </div>
                                <div>
                                    <div class="fw-bold mb-0" :class="{ 'text-foreground': selectedIndex !== index }">{{ item.name }}</div>
                                    <div class="small" :class="selectedIndex === index ? 'text-white-50' : 'text-muted'">
                                        {{ item.typeLabel }} · {{ item.secondaryText }}
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge rounded-pill" :class="getStatusBadgeClass(item)">
                                    {{ item.statusText }}
                                </span>
                                <font-awesome-icon icon="chevron-right" class="small opacity-50" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Shortcut Guide -->
                <div class="card-footer bg-transparent border-top border-secondary px-3 py-2 d-flex align-items-center justify-content-between text-muted small">
                    <div class="d-flex gap-3">
                        <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
                        <span><kbd>↵</kbd> Select</span>
                        <span><kbd>ESC</kbd> Close</span>
                    </div>
                    <div>InfiniNOC Telemetry Search</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            isOpen: false,
            query: "",
            activeCategory: "all",
            selectedIndex: 0,
            categories: [
                { id: "all", label: "All" },
                { id: "monitors", label: "Monitors" },
                { id: "tools", label: "Tools" },
                { id: "devices", label: "Devices" },
                { id: "sites", label: "Sites" },
                { id: "incidents", label: "Incidents" },
            ],
        };
    },
    computed: {
        shortcutLabel() {
            if (typeof window !== "undefined" && navigator.platform && navigator.platform.toUpperCase().indexOf("MAC") >= 0) {
                return "⌘ K";
            }
            return "Ctrl K";
        },
        allMonitors() {
            const list = this.$root.monitorList || {};
            return Object.values(list).map((m) => ({
                id: `monitor-${m.id}`,
                rawId: m.id,
                category: "monitors",
                typeLabel: "Monitor (" + (m.type || "HTTP").toUpperCase() + ")",
                name: m.name || `Monitor #${m.id}`,
                secondaryText: m.url || m.hostname || m.target || "Target Endpoint",
                statusText: m.active ? "Active" : "Paused",
                isOnline: m.active === 1,
                route: `/dashboard/${m.id}`,
            }));
        },
        nocTools() {
            return [
                { id: "tool-ip-checker", category: "tools", typeLabel: "Tool (Network)", name: "IP & Domain Intelligence", secondaryText: "Lookup IP/Domain address, ASN, BGP prefix, ISP & location", statusText: "Ready", isOnline: true, route: "/tools/ip-checker", keywords: ["ip", "address", "asn", "isp", "myip", "location", "domain", "spidecloud"] },
                { id: "tool-port-checker", category: "tools", typeLabel: "Tool (Connectivity)", name: "Port Checker", secondaryText: "Test open TCP ports and service reachability", statusText: "Ready", isOnline: true, route: "/tools/port-checker", keywords: ["port", "tcp", "scan", "reachability"] },
                { id: "tool-subnet-calc", category: "tools", typeLabel: "Tool (Calculators)", name: "Subnet Calculator", secondaryText: "Calculate network, broadcast, netmask & usable hosts", statusText: "Ready", isOnline: true, route: "/tools/subnet-calculator", keywords: ["subnet", "cidr", "netmask", "host"] },
                { id: "tool-cidr-calc", category: "tools", typeLabel: "Tool (Calculators)", name: "CIDR Calculator", secondaryText: "Calculate IPv4 and IPv6 CIDR blocks", statusText: "Ready", isOnline: true, route: "/tools/cidr-calculator", keywords: ["cidr", "ipv4", "ipv6", "prefix"] },
                { id: "tool-ip-range", category: "tools", typeLabel: "Tool (Calculators)", name: "IP Range Calculator", secondaryText: "Convert start/end IPs to CIDR blocks", statusText: "Ready", isOnline: true, route: "/tools/ip-range-calculator", keywords: ["ip", "range", "start", "end"] },
                { id: "tool-mac-lookup", category: "tools", typeLabel: "Tool (Network)", name: "MAC / OUI Lookup", secondaryText: "Lookup hardware vendor and IEEE OUI block", statusText: "Ready", isOnline: true, route: "/tools/mac-lookup", keywords: ["mac", "oui", "vendor", "hardware"] },
                { id: "tool-ip-reputation", category: "tools", typeLabel: "Tool (Security)", name: "IP Reputation Checker", secondaryText: "Check threat score, abuse reports & blacklist status", statusText: "Ready", isOnline: true, route: "/tools/ip-reputation", keywords: ["reputation", "blacklist", "threat", "abuse"] },
                { id: "tool-dns-lookup", category: "tools", typeLabel: "Tool (DNS)", name: "DNS Lookup", secondaryText: "Query A, AAAA, MX, CNAME, TXT, NS, SOA records", statusText: "Ready", isOnline: true, route: "/tools/dns-lookup", keywords: ["dns", "lookup", "a", "mx", "txt", "cname"] },
                { id: "tool-reverse-dns", category: "tools", typeLabel: "Tool (DNS)", name: "Reverse DNS", secondaryText: "Resolve IP address to PTR domain hostname", statusText: "Ready", isOnline: true, route: "/tools/reverse-dns", keywords: ["ptr", "reverse", "dns", "rdns"] },
                { id: "tool-ping", category: "tools", typeLabel: "Tool (Connectivity)", name: "Ping Tool", secondaryText: "Measure RTT, packet loss, jitter and latency", statusText: "Ready", isOnline: true, route: "/tools/ping", keywords: ["ping", "icmp", "latency", "rtt", "jitter"] },
                { id: "tool-traceroute", category: "tools", typeLabel: "Tool (Connectivity)", name: "Traceroute", secondaryText: "Trace router hops, latency spikes and path", statusText: "Ready", isOnline: true, route: "/tools/traceroute", keywords: ["traceroute", "tracert", "hop", "route"] },
                { id: "tool-http-checker", category: "tools", typeLabel: "Tool (Web)", name: "HTTP / HTTPS Checker", secondaryText: "Test response codes, headers, redirects & TLS", statusText: "Ready", isOnline: true, route: "/tools/http-checker", keywords: ["http", "https", "status", "headers", "web"] },
                { id: "tool-ssl-checker", category: "tools", typeLabel: "Tool (Web)", name: "SSL Certificate Checker", secondaryText: "Verify SSL validity, expiration date & chain", statusText: "Ready", isOnline: true, route: "/tools/ssl-checker", keywords: ["ssl", "tls", "certificate", "expiry"] },
                { id: "tool-asn-lookup", category: "tools", typeLabel: "Tool (ISP)", name: "ASN Lookup", secondaryText: "Inspect Autonomous System & BGP prefixes", statusText: "Ready", isOnline: true, route: "/tools/asn-lookup", keywords: ["asn", "bgp", "autonomous", "system"] },
                { id: "tool-bandwidth-calc", category: "tools", typeLabel: "Tool (Calculators)", name: "Bandwidth Speed Matrix", secondaryText: "Calculate file transfer speed matrix across link speeds", statusText: "Ready", isOnline: true, route: "/tools/bandwidth-calculator", keywords: ["bandwidth", "capacity", "speed"] },
                { id: "tool-dns-prop", category: "tools", typeLabel: "Tool (DNS)", name: "Global DNS Propagation", secondaryText: "Test DNS record resolution across global public resolvers", statusText: "Ready", isOnline: true, route: "/tools/dns-propagation", keywords: ["propagation", "dns", "resolver", "global"] },
                { id: "tool-ssl-ciphers", category: "tools", typeLabel: "Tool (Web)", name: "TLS / SSL Cipher Suite Audit", secondaryText: "Audit TLS 1.2/1.3, ciphers, PFS & compute security grade", statusText: "Ready", isOnline: true, route: "/tools/ssl-ciphers", keywords: ["tls", "cipher", "ssl", "grade", "pfs"] },
                { id: "tool-sec-headers", category: "tools", typeLabel: "Tool (Web)", name: "HTTP Security Headers", secondaryText: "Audit HSTS, CSP, X-Frame-Options security headers & grade", statusText: "Ready", isOnline: true, route: "/tools/security-headers", keywords: ["headers", "hsts", "csp", "security", "grade"] },
            ];
        },
        mockDevices() {
            return [
                { id: "dev-1", category: "devices", typeLabel: "Device (Router)", name: "MikroTik Core Gateway", secondaryText: "10.20.2.1 · Vijayawada POP", statusText: "Online", isOnline: true, route: "/network/devices" },
                { id: "dev-2", category: "devices", typeLabel: "Device (OLT)", name: "Huawei GPON OLT 5608T", secondaryText: "10.50.1.10 · Guntur Site", statusText: "Online", isOnline: true, route: "/network/devices" },
                { id: "dev-3", category: "devices", typeLabel: "Device (Switch)", name: "Cisco Catalyst 3850", secondaryText: "10.30.4.2 · Core Rack A", statusText: "Online", isOnline: true, route: "/network/devices" },
            ];
        },
        mockSites() {
            return [
                { id: "site-1", category: "sites", typeLabel: "Site (Datacenter)", name: "Vijayawada Main POP", secondaryText: "Primary Fiber Ingress", statusText: "Operational", isOnline: true, route: "/network/sites" },
                { id: "site-2", category: "sites", typeLabel: "Site (Tower)", name: "Guntur Tower Node", secondaryText: "Wireless Backhaul", statusText: "Operational", isOnline: true, route: "/network/sites" },
            ];
        },
        mockIncidents() {
            return [
                { id: "inc-1", category: "incidents", typeLabel: "Incident (P1 Outage)", name: "Backbone Uplink Latency Spike", secondaryText: "P1 Critical · Active 25m", statusText: "Investigating", isOnline: false, route: "/incidents" },
            ];
        },
        allResults() {
            return [
                ...this.allMonitors,
                ...this.nocTools,
                ...this.mockDevices,
                ...this.mockSites,
                ...this.mockIncidents,
            ];
        },
        filteredResults() {
            let items = this.allResults;
            if (this.activeCategory !== "all") {
                items = items.filter((i) => i.category === this.activeCategory);
            }
            if (this.query.trim()) {
                const q = this.query.toLowerCase().trim();
                items = items.filter(
                    (i) =>
                        i.name.toLowerCase().includes(q) ||
                        i.secondaryText.toLowerCase().includes(q) ||
                        i.typeLabel.toLowerCase().includes(q) ||
                        (i.keywords && i.keywords.some((k) => k.toLowerCase().includes(q)))
                );
            }
            return items;
        },
    },
    watch: {
        query() {
            this.selectedIndex = 0;
        },
        activeCategory() {
            this.selectedIndex = 0;
        },
    },
    mounted() {
        window.addEventListener("keydown", this.handleGlobalKeydown);
    },
    beforeUnmount() {
        window.removeEventListener("keydown", this.handleGlobalKeydown);
    },
    methods: {
        handleGlobalKeydown(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                this.openSearch();
            }
        },
        openSearch() {
            this.isOpen = true;
            this.query = "";
            this.selectedIndex = 0;
            this.$nextTick(() => {
                if (this.$refs.searchInput) {
                    this.$refs.searchInput.focus();
                }
            });
        },
        closeSearch() {
            this.isOpen = false;
        },
        getCategoryCount(catId) {
            if (catId === "all") {
                return this.allResults.length;
            }
            return this.allResults.filter((i) => i.category === catId).length;
        },
        navigateResults(direction) {
            if (this.filteredResults.length === 0) {
                return;
            }
            let nextIndex = this.selectedIndex + direction;
            if (nextIndex < 0) {
                nextIndex = this.filteredResults.length - 1;
            } else if (nextIndex >= this.filteredResults.length) {
                nextIndex = 0;
            }
            this.selectedIndex = nextIndex;
        },
        selectCurrentResult() {
            if (this.filteredResults[this.selectedIndex]) {
                this.clickResult(this.filteredResults[this.selectedIndex]);
            }
        },
        clickResult(item) {
            this.closeSearch();
            if (item.route) {
                this.$router.push(item.route);
            }
        },
        getTypeIcon(item) {
            if (item.category === "monitors") {
                return "desktop";
            }
            if (item.category === "devices") {
                return "server";
            }
            if (item.category === "sites") {
                return "building";
            }
            if (item.category === "incidents") {
                return "exclamation-triangle";
            }
            return "cubes";
        },
        getTypeIconBg(item) {
            if (item.category === "monitors") {
                return "bg-primary text-white";
            }
            if (item.category === "devices") {
                return "bg-info text-dark";
            }
            if (item.category === "sites") {
                return "bg-success text-white";
            }
            if (item.category === "incidents") {
                return "bg-danger text-white";
            }
            return "bg-secondary text-white";
        },
        getStatusBadgeClass(item) {
            if (item.category === "incidents") {
                return "bg-danger text-white";
            }
            return item.isOnline ? "bg-success text-white" : "bg-secondary text-white";
        },
    },
};
</script>

<style scoped>
.noc-search-trigger-box {
    background-color: var(--secondary, #1e293b);
    border: 1px solid var(--border, #334155);
    color: var(--foreground, #f8fafc);
    border-radius: 10px;
    padding: 0.45rem 0.85rem;
    width: 340px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.noc-search-trigger-box:hover {
    border-color: var(--ring, #ff9933);
    box-shadow: 0 0 0 2px rgba(255, 153, 51, 0.15);
}

.search-placeholder {
    font-size: 0.875rem;
}

.search-kbd {
    background-color: var(--card, #0f172a);
    border: 1px solid var(--border, #334155);
    color: var(--muted-foreground, #94a3b8);
    font-size: 0.7rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
}

.noc-search-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(4px);
    z-index: 1080;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 80px;
}

.noc-search-modal {
    width: 100%;
    max-width: 620px;
    background-color: var(--card, #1e293b);
    border-radius: 14px;
    overflow: hidden;
}

.cursor-pointer {
    cursor: pointer;
}
</style>
