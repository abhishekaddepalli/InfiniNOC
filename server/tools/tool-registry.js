/**
 * Central InfiniNOC Network Tools Registry
 * Defines metadata, classification, icons, keywords, and execution types for NOC tools.
 */

const TOOL_CATEGORIES = [
    { id: "all", label: "All Tools", icon: "th-large" },
    { id: "network", label: "Network", icon: "network-wired" },
    { id: "connectivity", label: "Connectivity", icon: "plug" },
    { id: "dns", label: "DNS & Domain", icon: "search" },
    { id: "security", label: "Security", icon: "shield-alt" },
    { id: "isp", label: "ISP / NOC", icon: "building" },
    { id: "calculators", label: "Calculators", icon: "calculator" },
    { id: "web", label: "Web & SSL", icon: "globe" },
    { id: "utility", label: "Utility", icon: "wrench" },
];

const TOOL_REGISTRY = [
    {
        id: "ip-checker",
        name: "IP Checker",
        slug: "ip-checker",
        category: "network",
        description: "Lookup IP address, version, location, ASN, ISP, and network routing information.",
        executionType: "provider",
        icon: "globe",
        keywords: ["ip", "address", "asn", "isp", "myip", "location", "whois", "geoip"],
        featured: true,
        enabled: true,
        sortOrder: 1,
    },
    {
        id: "port-checker",
        name: "Port Checker",
        slug: "port-checker",
        category: "connectivity",
        description: "Test open TCP ports and service reachability on any destination host or IP.",
        executionType: "server",
        icon: "plug",
        keywords: ["port", "tcp", "checker", "scan", "reachability", "socket", "connection"],
        featured: true,
        enabled: true,
        sortOrder: 2,
    },
    {
        id: "subnet-calculator",
        name: "Subnet Calculator",
        slug: "subnet-calculator",
        category: "calculators",
        description: "Calculate network address, broadcast, netmask, wildcard, and usable IP host ranges.",
        executionType: "local",
        icon: "calculator",
        keywords: ["subnet", "cidr", "netmask", "ip", "host", "broadcast", "range", "mask"],
        featured: true,
        enabled: true,
        sortOrder: 3,
    },
    {
        id: "cidr-calculator",
        name: "CIDR Calculator",
        slug: "cidr-calculator",
        category: "calculators",
        description: "Calculate IPv4 and IPv6 Classless Inter-Domain Routing address blocks.",
        executionType: "local",
        icon: "calculator",
        keywords: ["cidr", "ipv4", "ipv6", "prefix", "notation", "block", "subnet"],
        featured: false,
        enabled: true,
        sortOrder: 4,
    },
    {
        id: "ip-range-calculator",
        name: "IP Range Calculator",
        slug: "ip-range-calculator",
        category: "calculators",
        description: "Convert start and end IP address bounds into valid CIDR blocks and address counts.",
        executionType: "local",
        icon: "calculator",
        keywords: ["ip", "range", "start", "end", "cidr", "count", "addresses"],
        featured: false,
        enabled: true,
        sortOrder: 5,
    },
    {
        id: "mac-lookup",
        name: "MAC / OUI Lookup",
        slug: "mac-lookup",
        category: "network",
        description: "Lookup hardware vendor, IEEE OUI block, and address assignment type from MAC address.",
        executionType: "local",
        icon: "microchip",
        keywords: ["mac", "oui", "vendor", "hardware", "ieee", "ethernet", "device"],
        featured: false,
        enabled: true,
        sortOrder: 6,
    },
    {
        id: "ip-reputation",
        name: "IP Reputation Checker",
        slug: "ip-reputation",
        category: "security",
        description: "Check IP threat score, abuse reports, blacklist status, and risk categories.",
        executionType: "provider",
        icon: "shield-alt",
        keywords: ["ip", "reputation", "blacklist", "threat", "abuse", "security", "spam"],
        featured: true,
        enabled: true,
        sortOrder: 7,
    },
    {
        id: "dns-lookup",
        name: "DNS Lookup",
        slug: "dns-lookup",
        category: "dns",
        description: "Perform authoritative DNS record queries for A, AAAA, CNAME, MX, NS, TXT, SOA, CAA, SRV.",
        executionType: "server",
        icon: "search",
        keywords: ["dns", "lookup", "a", "aaaa", "cname", "mx", "txt", "ns", "soa", "domain"],
        featured: true,
        enabled: true,
        sortOrder: 8,
    },
    {
        id: "reverse-dns",
        name: "Reverse DNS",
        slug: "reverse-dns",
        category: "dns",
        description: "Perform PTR reverse DNS queries to resolve IP addresses back to domain hostnames.",
        executionType: "server",
        icon: "search",
        keywords: ["ptr", "reverse", "dns", "rdns", "hostname", "ip"],
        featured: false,
        enabled: true,
        sortOrder: 9,
    },
    {
        id: "ping",
        name: "Ping Tool",
        slug: "ping",
        category: "connectivity",
        description: "Measure round-trip time, packet loss, jitter, and latency metrics for any host or IP.",
        executionType: "server",
        icon: "activity",
        keywords: ["ping", "icmp", "latency", "rtt", "jitter", "packet", "loss", "reachability"],
        featured: true,
        enabled: true,
        sortOrder: 10,
    },
    {
        id: "traceroute",
        name: "Traceroute",
        slug: "traceroute",
        category: "connectivity",
        description: "Trace network hop paths, intermediate routers, latency spikes, and packet routing.",
        executionType: "server",
        icon: "route",
        keywords: ["traceroute", "tracert", "hop", "route", "path", "latency", "router"],
        featured: false,
        enabled: true,
        sortOrder: 11,
    },
    {
        id: "http-checker",
        name: "HTTP / HTTPS Checker",
        slug: "http-checker",
        category: "web",
        description: "Test web endpoint HTTP status codes, response headers, redirects, and total latency.",
        executionType: "server",
        icon: "globe",
        keywords: ["http", "https", "status", "headers", "redirect", "url", "web", "response"],
        featured: false,
        enabled: true,
        sortOrder: 12,
    },
    {
        id: "ssl-checker",
        name: "SSL Certificate Checker",
        slug: "ssl-checker",
        category: "web",
        description: "Verify SSL/TLS certificate validity, expiration date, issuer chain, and hostname match.",
        executionType: "server",
        icon: "lock",
        keywords: ["ssl", "tls", "certificate", "https", "expiry", "issuer", "chain", "crypto"],
        featured: false,
        enabled: true,
        sortOrder: 13,
    },
    {
        id: "asn-lookup",
        name: "ASN Lookup",
        slug: "asn-lookup",
        category: "isp",
        description: "Inspect Autonomous System Numbers, BGP routing prefixes, ISP organization, and registry.",
        executionType: "provider",
        icon: "building",
        keywords: ["asn", "bgp", "autonomous", "system", "isp", "prefixes", "registry", "network"],
        featured: false,
        enabled: true,
        sortOrder: 14,
    },
    {
        id: "bandwidth-calculator",
        name: "Bandwidth Calculator",
        slug: "bandwidth-calculator",
        category: "calculators",
        description: "Calculate aggregate network bandwidth, oversubscription ratios, and uplink requirements.",
        executionType: "local",
        icon: "calculator",
        keywords: ["bandwidth", "oversubscription", "capacity", "isp", "uplink", "peak", "users"],
        featured: false,
        enabled: true,
        sortOrder: 15,
    },
];

class ToolRegistry {
    /**
     * Get all registered tool categories
     * @returns {Array} Categories array
     */
    static getCategories() {
        return TOOL_CATEGORIES;
    }

    /**
     * Get all enabled tools in registry
     * @returns {Array} Tools array
     */
    static getTools() {
        return TOOL_REGISTRY.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Get a specific tool by ID or slug
     * @param {string} slug Tool slug or ID
     * @returns {object|null} Tool definition or null
     */
    static getToolBySlug(slug) {
        if (!slug) {
            return null;
        }
        return TOOL_REGISTRY.find((t) => t.slug === slug || t.id === slug) || null;
    }

    /**
     * Search registered tools by keyword query
     * @param {string} query Search term
     * @returns {Array} Matching tools array
     */
    static searchTools(query) {
        if (!query || !query.trim()) {
            return this.getTools();
        }
        const q = query.toLowerCase().trim();
        return this.getTools().filter((t) => {
            const nameMatch = t.name.toLowerCase().includes(q);
            const descMatch = t.description.toLowerCase().includes(q);
            const catMatch = t.category.toLowerCase().includes(q);
            const keywordMatch = t.keywords.some((k) => k.toLowerCase().includes(q));
            return nameMatch || descMatch || catMatch || keywordMatch;
        });
    }
}

module.exports = {
    ToolRegistry,
    TOOL_CATEGORIES,
    TOOL_REGISTRY,
};
