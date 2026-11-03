<template>
    <div class="container-fluid py-4">
        <!-- Diagnostic Tools Top Header & Controls -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="tools" class="text-primary" />
                    <span>Real-Time Diagnostic Tools</span>
                </h3>
                <div class="text-muted small d-flex align-items-center gap-2 flex-wrap">
                    <span>Professional NOC network troubleshooting toolkit for connectivity, routing, DNS, security & infrastructure.</span>
                    <span class="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1">
                        <span class="spinner-grow spinner-grow-sm" style="width: 7px; height: 7px;" role="status"></span>
                        <span>Backend Services: Online</span>
                    </span>
                    <span class="badge bg-secondary font-monospace">
                        Node: Central Host ({{ executionLocations.length }} Nodes Available)
                    </span>
                </div>
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
                    placeholder="Search diagnostics... (e.g. ping, mtr, traceroute, dns, ssl, snmp)"
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
                <span>Essential NOC Diagnostics</span>
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
                            <span class="small text-muted font-monospace text-uppercase" style="font-size: 0.7rem;">
                                Execution: {{ tool.executionType }} {{ tool.supportsProbe ? '· Probe-Ready' : '' }}
                            </span>
                            <router-link :to="'/diagnostic-tools/' + tool.slug" class="btn btn-warning btn-sm fw-bold px-3">
                                Launch Tool →
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
                <span>My Favorite Tools</span>
            </h5>
            <div class="row g-3">
                <div v-for="tool in favoriteTools" :key="'fav-' + tool.id" class="col-12 col-md-6 col-lg-3">
                    <div class="card bg-card border-secondary h-100 shadow-sm tool-card p-3 d-flex flex-column justify-content-between">
                        <div>
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
                        </div>
                        <router-link :to="'/diagnostic-tools/' + tool.slug" class="btn btn-outline-primary btn-sm w-100 fw-semibold">
                            Launch Tool
                        </router-link>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recently Executed Tools Section -->
        <div v-if="(activeCategory === 'all' || activeCategory === 'recent') && recentHistory.length > 0 && !searchQuery.trim()" class="mb-5">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="history" class="text-info" />
                <span>Recently Executed Diagnostics</span>
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
                            <span class="badge" :class="item.status === 'SUCCESS' ? 'bg-success' : 'bg-secondary'">{{ item.status }}</span>
                            <span class="small text-muted font-monospace">{{ formatDate(item.timestamp) }}</span>
                            <router-link :to="'/diagnostic-tools/' + item.slug" class="btn btn-outline-secondary btn-xs py-1 px-2 small">
                                Re-run →
                            </router-link>
                        </div>
                    </li>
                </ul>
            </div>
        </div>

        <!-- All Categorized Tools Grid -->
        <div class="mb-4">
            <h5 class="fw-bold text-foreground mb-3 d-flex align-items-center justify-content-between">
                <span>{{ categoryTitle }}</span>
                <span class="small text-muted fw-normal">Showing {{ filteredTools.length }} diagnostics</span>
            </h5>

            <div v-if="filteredTools.length === 0" class="card bg-card border-secondary text-center py-5 shadow-sm">
                <font-awesome-icon icon="search" class="fs-1 text-muted opacity-50 mb-2" />
                <h5 class="fw-bold text-foreground">No matching diagnostic tools found</h5>
                <div class="text-muted small">Try searching for keywords like "ping", "traceroute", "dns", "ssl", or "snmp".</div>
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
                            <span class="small text-muted font-monospace text-uppercase" style="font-size: 0.7rem;">
                                {{ tool.executionType }} {{ tool.supportsProbe ? '· Probe' : '' }}
                            </span>
                            <router-link :to="'/diagnostic-tools/' + tool.slug" class="btn btn-outline-primary btn-sm fw-semibold px-3">
                                Open Tool →
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
            executionLocations: [{ id: "central", name: "Central Server" }],
            categories: [
                { id: "all", label: "All Tools", icon: "th-large" },
                { id: "featured", label: "Featured", icon: "star" },
                { id: "favorites", label: "Favorites", icon: "star" },
                { id: "recent", label: "Recently Used", icon: "history" },
                { id: "connectivity", label: "Connectivity", icon: "plug" },
                { id: "routing", label: "Routing & Path", icon: "route" },
                { id: "dns", label: "DNS & Domain", icon: "search" },
                { id: "ports", label: "Port & Service", icon: "network-wired" },
                { id: "ssl", label: "SSL & Security", icon: "shield-alt" },
                { id: "http", label: "HTTP & Web", icon: "globe" },
                { id: "intelligence", label: "IP Intelligence", icon: "building" },
                { id: "infrastructure", label: "Infrastructure", icon: "server" },
                { id: "calculators", label: "Calculators", icon: "calculator" },
            ],
            tools: [],
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
                list = list.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.keywords && t.keywords.some((k) => k.includes(q))));
            }
            return list;
        },
    },
    mounted() {
        this.fetchToolRegistry();
        this.fetchFavorites();
        this.fetchRecentHistory();
        this.fetchLocations();
    },
    methods: {
        fetchToolRegistry() {
            this.$root.getSocket().emit("getToolRegistry", (res) => {
                if (res && res.ok && res.tools) {
                    this.tools = res.tools;
                    if (res.categories && res.categories.length) {
                        // Merge categories dynamically
                        const specialCats = this.categories.slice(0, 4);
                        const dynamicCats = res.categories.filter((c) => c.id !== "all");
                        this.categories = [...specialCats, ...dynamicCats];
                    }
                }
            });
        },
        fetchLocations() {
            this.$root.getSocket().emit("getDiagnosticExecutionLocations", (res) => {
                if (res && res.ok && res.locations) {
                    this.executionLocations = res.locations;
                }
            });
        },
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
                        if (!this.favorites.includes(slug)) this.favorites.push(slug);
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
            if (catId === "all") return this.tools.length;
            if (catId === "featured") return this.featuredTools.length;
            if (catId === "favorites") return this.favoriteTools.length;
            if (catId === "recent") return this.recentHistory.length;
            return this.tools.filter((t) => t.category === catId).length;
        },
        formatDate(isoStr) {
            if (!isoStr) return "";
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
