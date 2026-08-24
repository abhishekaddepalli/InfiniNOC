<template>
    <div class="container-fluid py-4">
        <!-- Dashboard Header & Search Bar -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="wrench" class="text-primary" />
                    <span>Enterprise NOC Network Tools</span>
                </h3>
                <div class="text-muted small">Real-time network diagnostics, BGP routing, security audits, and utility suite for NOC teams.</div>
            </div>
            <!-- Global Tool Search Input -->
            <div class="input-group input-group-lg search-box ms-auto" style="max-width: 420px; width: 100%;">
                <span class="input-group-text border-secondary bg-card text-muted">
                    <font-awesome-icon icon="search" />
                </span>
                <input
                    v-model="searchQuery"
                    type="text"
                    class="form-control border-secondary bg-card text-foreground"
                    placeholder="Search tools... (e.g. subnet, port, dns, ciphers)"
                />
                <button v-if="searchQuery" class="btn btn-outline-secondary border-secondary bg-card text-muted" @click="searchQuery = ''">
                    <font-awesome-icon icon="times" />
                </button>
            </div>
        </div>

        <!-- Filter Category Tabs (Clean Flex-Wrap Layout) -->
        <div class="d-flex flex-wrap align-items-center gap-2 pb-3 mb-4 border-bottom border-secondary">
            <button
                v-for="cat in categories"
                :key="cat.id"
                class="btn btn-sm rounded-pill px-3 py-2 fw-semibold text-nowrap transition-all d-inline-flex align-items-center gap-2"
                :class="activeCategory === cat.id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'"
                @click="activeCategory = cat.id"
            >
                <font-awesome-icon :icon="cat.icon" class="small" />
                <span>{{ cat.label }}</span>
                <span class="badge rounded-pill bg-secondary text-foreground small">{{ getCategoryCount(cat.id) }}</span>
            </button>
        </div>

        <!-- Featured Tools Section -->
        <div v-if="(activeCategory === 'all' || activeCategory === 'featured') && !searchQuery.trim()" class="mb-5">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="star" class="text-warning" />
                <span>Featured NOC Diagnostics</span>
            </h5>
            <div class="row g-3">
                <div v-for="tool in featuredTools" :key="tool.id" class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary h-100 shadow-sm tool-card featured-card p-3">
                        <div class="d-flex align-items-start justify-content-between mb-2">
                            <div class="d-flex align-items-center gap-3">
                                <div class="tool-icon-bg bg-primary text-white rounded-3 p-2 d-flex align-items-center justify-content-center" style="width: 44px; height: 44px;">
                                    <font-awesome-icon :icon="tool.icon" class="fs-5" />
                                </div>
                                <div>
                                    <h6 class="fw-bold text-foreground mb-0">{{ tool.name }}</h6>
                                    <span class="badge bg-secondary text-uppercase text-foreground small" style="font-size: 0.65rem;">{{ tool.category }}</span>
                                </div>
                            </div>
                            <button
                                class="btn btn-sm border-0 text-warning p-1"
                                :title="isFavorite(tool.slug) ? 'Remove from Favorites' : 'Add to Favorites'"
                                @click="toggleFavorite(tool.slug)"
                            >
                                <font-awesome-icon icon="star" :class="{ 'text-muted opacity-50': !isFavorite(tool.slug) }" />
                            </button>
                        </div>
                        <p class="small text-muted mb-3 flex-grow-1">{{ tool.description }}</p>
                        <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary">
                            <span class="small text-muted font-monospace text-uppercase" style="font-size: 0.7rem;">Execution: {{ tool.executionType }}</span>
                            <router-link :to="'/tools/' + tool.slug" class="btn btn-warning btn-sm fw-bold px-3">
                                Open Tool →
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Favorites Section -->
        <div v-if="(activeCategory === 'all' || activeCategory === 'favorites') && favoriteTools.length > 0 && !searchQuery.trim()" class="mb-5">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="star" class="text-warning" />
                <span>Favorites</span>
            </h5>
            <div class="row g-3">
                <div v-for="tool in favoriteTools" :key="'fav-' + tool.id" class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary h-100 shadow-sm tool-card p-3">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center gap-2">
                                <font-awesome-icon :icon="tool.icon" class="text-primary" />
                                <h6 class="fw-bold text-foreground mb-0 text-truncate">{{ tool.name }}</h6>
                            </div>
                            <button class="btn btn-sm border-0 text-warning p-0" @click="toggleFavorite(tool.slug)">
                                <font-awesome-icon icon="star" />
                            </button>
                        </div>
                        <p class="small text-muted mb-3 line-clamp-2" style="min-height: 38px;">{{ tool.description }}</p>
                        <router-link :to="'/tools/' + tool.slug" class="btn btn-outline-primary btn-sm w-100 fw-semibold">
                            Open Tool
                        </router-link>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recently Used Section -->
        <div v-if="(activeCategory === 'all' || activeCategory === 'recent') && recentHistory.length > 0 && !searchQuery.trim()" class="mb-5">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="history" class="text-info" />
                <span>Recently Used</span>
            </h5>
            <div class="card bg-card border-secondary shadow-sm">
                <ul class="list-group list-group-flush">
                    <li v-for="(item, idx) in recentHistory.slice(0, 5)" :key="'rec-' + idx" class="list-group-item bg-card border-secondary d-flex align-items-center justify-content-between py-2 px-3">
                        <div class="d-flex align-items-center gap-3">
                            <font-awesome-icon icon="terminal" class="text-muted" />
                            <div>
                                <span class="fw-bold text-foreground me-2">{{ item.name }}</span>
                                <span class="font-monospace small text-primary">{{ item.input }}</span>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="small text-muted">{{ formatDate(item.timestamp) }}</span>
                            <router-link :to="'/tools/' + item.slug" class="btn btn-outline-secondary btn-xs py-0 px-2 small">
                                Run Again
                            </router-link>
                        </div>
                    </li>
                </ul>
            </div>
        </div>

        <!-- All Tools Grid -->
        <div class="mb-4">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center justify-content-between">
                <span>{{ categoryTitle }}</span>
                <span class="small text-muted fw-normal">Showing {{ filteredTools.length }} tools</span>
            </h5>

            <div v-if="filteredTools.length === 0" class="card bg-card border-secondary text-center py-5 shadow-sm">
                <font-awesome-icon icon="search" class="fs-1 text-muted opacity-50 mb-2" />
                <h5 class="fw-bold text-foreground">No tools found</h5>
                <div class="text-muted small">Try adjusting your search criteria or selecting a different category.</div>
            </div>

            <div v-else class="row g-3">
                <div v-for="tool in filteredTools" :key="tool.id" class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary h-100 shadow-sm tool-card p-3 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="tool-icon-bg bg-secondary text-primary rounded-3 p-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                        <font-awesome-icon :icon="tool.icon" class="fs-5" />
                                    </div>
                                    <div>
                                        <h6 class="fw-bold text-foreground mb-0">{{ tool.name }}</h6>
                                        <span class="badge bg-secondary text-uppercase text-foreground small" style="font-size: 0.65rem;">{{ tool.category }}</span>
                                    </div>
                                </div>
                                <button
                                    class="btn btn-sm border-0 text-warning p-1"
                                    :title="isFavorite(tool.slug) ? 'Remove from Favorites' : 'Add to Favorites'"
                                    @click="toggleFavorite(tool.slug)"
                                >
                                    <font-awesome-icon icon="star" :class="{ 'text-muted opacity-50': !isFavorite(tool.slug) }" />
                                </button>
                            </div>
                            <p class="small text-muted mb-3 flex-grow-1">{{ tool.description }}</p>
                        </div>
                        <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary mt-auto">
                            <span class="small text-muted font-monospace text-uppercase" style="font-size: 0.7rem;">{{ tool.executionType }}</span>
                            <router-link :to="'/tools/' + tool.slug" class="btn btn-outline-primary btn-sm fw-semibold px-3">
                                Launch →
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            searchQuery: "",
            activeCategory: "all",
            favorites: [],
            recentHistory: [],
            categories: [
                { id: "all", label: "All Tools", icon: "th-large" },
                { id: "featured", label: "Featured", icon: "star" },
                { id: "favorites", label: "Favorites", icon: "star" },
                { id: "recent", label: "Recently Used", icon: "history" },
                { id: "network", label: "Network", icon: "network-wired" },
                { id: "connectivity", label: "Connectivity", icon: "signal" },
                { id: "dns", label: "DNS & Domain", icon: "globe" },
                { id: "security", label: "Security", icon: "shield-alt" },
                { id: "isp", label: "ISP / NOC", icon: "sitemap" },
                { id: "calculators", label: "Calculators", icon: "calculator" },
                { id: "web", label: "Web / TLS", icon: "desktop" },
            ],
            tools: [
                { id: "ip-checker", name: "IP & Domain Intelligence", slug: "ip-checker", category: "network", description: "Lookup IP/Domain, BGP routing, ASN, ISP & location", executionType: "provider", icon: "globe", featured: true },
                { id: "port-checker", name: "Port Checker", slug: "port-checker", category: "connectivity", description: "Test open TCP ports and service reachability", executionType: "server", icon: "plug", featured: true },
                { id: "subnet-calculator", name: "Subnet Calculator", slug: "subnet-calculator", category: "calculators", description: "Calculate network, broadcast, netmask & host capacity", executionType: "local", icon: "calculator", featured: true },
                { id: "cidr-calculator", name: "CIDR Calculator", slug: "cidr-calculator", category: "calculators", description: "Calculate IPv4 and IPv6 CIDR prefix blocks", executionType: "local", icon: "calculator", featured: false },
                { id: "ip-range-calculator", name: "IP Range Calculator", slug: "ip-range-calculator", category: "calculators", description: "Convert start/end IPs to covering CIDR blocks", executionType: "local", icon: "calculator", featured: false },
                { id: "mac-lookup", name: "MAC / OUI Lookup", slug: "mac-lookup", category: "network", description: "Lookup hardware vendor and IEEE OUI block", executionType: "local", icon: "microchip", featured: false },
                { id: "ip-reputation", name: "IP Reputation Checker", slug: "ip-reputation", category: "security", description: "Check threat score, abuse reports & DNSBL status", executionType: "provider", icon: "shield-alt", featured: true },
                { id: "dns-lookup", name: "DNS Lookup", slug: "dns-lookup", category: "dns", description: "Query A, AAAA, MX, CNAME, TXT, NS, SOA records", executionType: "server", icon: "search", featured: true },
                { id: "reverse-dns", name: "Reverse DNS (PTR)", slug: "reverse-dns", category: "dns", description: "Resolve IP address to PTR domain hostname", executionType: "server", icon: "exchange-alt", featured: false },
                { id: "ping", name: "Ping Probe Tool", slug: "ping", category: "connectivity", description: "Measure RTT, packet loss, jitter and latency", executionType: "server", icon: "exchange-alt", featured: true },
                { id: "traceroute", name: "Traceroute Diagnostic", slug: "traceroute", category: "connectivity", description: "Trace router hops, latency spikes and path", executionType: "server", icon: "route", featured: false },
                { id: "http-checker", name: "HTTP / HTTPS Inspector", slug: "http-checker", category: "web", description: "Test response codes, headers, redirects & TLS", executionType: "server", icon: "globe", featured: false },
                { id: "ssl-checker", name: "SSL Certificate Inspector", slug: "ssl-checker", category: "web", description: "Verify SSL validity, expiration date & CA chain", executionType: "server", icon: "lock", featured: false },
                { id: "asn-lookup", name: "ASN BGP Lookup", slug: "asn-lookup", category: "isp", description: "Inspect Autonomous System & BGP prefixes", executionType: "provider", icon: "sitemap", featured: false },
                { id: "bandwidth-calculator", name: "Bandwidth Speed Matrix", slug: "bandwidth-calculator", category: "calculators", description: "Calculate data transfer times across link speeds", executionType: "local", icon: "calculator", featured: false },
                { id: "dns-propagation", name: "Global DNS Propagation", slug: "dns-propagation", category: "dns", description: "Test DNS record resolution across global public resolvers", executionType: "server", icon: "globe", featured: true },
                { id: "ssl-ciphers", name: "TLS / SSL Cipher Suite Audit", slug: "ssl-ciphers", category: "web", description: "Audit TLS 1.2/1.3, ciphers, PFS & compute security grade", executionType: "server", icon: "shield-alt", featured: true },
                { id: "security-headers", name: "HTTP Security Headers", slug: "security-headers", category: "web", description: "Audit HSTS, CSP, X-Frame-Options security headers & grade", executionType: "server", icon: "lock", featured: true },
            ],
        };
    },
    computed: {
        featuredTools() {
            return this.tools.filter((t) => t.featured);
        },
        favoriteTools() {
            return this.tools.filter((t) => this.favorites.includes(t.slug));
        },
        categoryTitle() {
            const cat = this.categories.find((c) => c.id === this.activeCategory);
            return cat ? cat.label : "All Tools";
        },
        filteredTools() {
            let list = this.tools;
            if (this.activeCategory !== "all" && this.activeCategory !== "featured" && this.activeCategory !== "favorites" && this.activeCategory !== "recent") {
                list = list.filter((t) => t.category === this.activeCategory);
            }
            if (this.searchQuery.trim()) {
                const q = this.searchQuery.toLowerCase().trim();
                list = list.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
            }
            return list;
        },
    },
    mounted() {
        this.fetchFavorites();
        this.fetchRecentHistory();
    },
    methods: {
        fetchFavorites() {
            this.$root.getSocket().emit("getUserToolFavorites", (res) => {
                if (res && res.ok && res.favorites) {
                    this.favorites = res.favorites;
                }
            });
        },
        toggleFavorite(slug) {
            this.$root.getSocket().emit("toggleUserToolFavorite", { slug }, (res) => {
                if (res && res.ok) {
                    if (res.isFavorite) {
                        if (!this.favorites.includes(slug)) {
                            this.favorites.push(slug);
                        }
                    } else {
                        this.favorites = this.favorites.filter((s) => s !== slug);
                    }
                }
            });
        },
        isFavorite(slug) {
            return this.favorites.includes(slug);
        },
        fetchRecentHistory() {
            this.$root.getSocket().emit("getRecentlyUsedTools", (res) => {
                if (res && res.ok && res.history) {
                    this.recentHistory = res.history;
                }
            });
        },
        getCategoryCount(catId) {
            if (catId === "all") {
                return this.tools.length;
            }
            if (catId === "featured") {
                return this.featuredTools.length;
            }
            if (catId === "favorites") {
                return this.favoriteTools.length;
            }
            if (catId === "recent") {
                return this.recentHistory.length;
            }
            return this.tools.filter((t) => t.category === catId).length;
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
.tool-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.tool-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
