# InfiniNOC — Tools Data Flow Audit (`docs/TOOLS-DATA-AUDIT.md`)

## Executive Summary
This document presents an exhaustive audit of the current network diagnostic tools data flow, backend adapters, execution handlers, frontend components, fallbacks, and provider configurations in the InfiniNOC NOC SaaS platform.

---

## 1. Tool Data Flow Audit Matrix

| Tool | Current Provider | Current API / Execution | Current Response Model | Missing Fields | Mock / Generic Fields | Failure Points | Required Implementation |
|---|---|---|---|---|---|---|---|
| **IP Checker** (`ip-checker`) | RIPEstat Overview & Node `dns.promises.reverse` | `server/tools/providers/ip-intelligence-provider.js` | ASN, Org, Prefix, Country, PTR | City, Region, Timezone, Company, Postal, Security (VPN, Tor, Proxy, Hosting, Anycast), Abuse contact, RPKI status | Returns `"Unknown"` for geolocation/organization when RIPEstat overview lacks city/region | RIPEstat API rate limits or network unavailability results in empty fields | Multi-provider registry (`IPinfo`, `RIPEstat`, `RIR/WHOIS`, `DNS/PTR`) with field-level merger & source provenance |
| **TCP Port Checker** (`port-checker`) | Native `node:net.Socket` | `server/tools/executors/tcp-port-executor.js` | Status (`OPEN`, `CLOSED`, `TIMEOUT`), connectTimeMs, target host/port | Multi-IP resolution breakdown (A vs AAAA breakdown) | None (Native socket execution) | Destination firewall dropping SYN packets causing timeout | Expose execution source (Server vs Probe), multi-address resolution breakdown |
| **Subnet Calculator** (`subnet-calculator`) | Local Deterministic Math | `server/tools/calculators/subnet-engine.js` | Network, Netmask, Wildcard, Broadcast, Host Capacity, First/Last Host | IPv6 host range notation | None (Pure math) | Invalid CIDR syntax input | Keep deterministic math local, optimize IPv6 subnet representations |
| **CIDR Calculator** (`cidr-calculator`) | Local Deterministic Math | `server/tools/calculators/subnet-engine.js` | Network, Netmask, Wildcard, Capacity | IPv6 prefix decomposition | None (Pure math) | Invalid prefix syntax | Deterministic CIDR decomposition |
| **IP Range Calculator** (`ip-range-calculator`) | Local Deterministic Math | `server/tools/calculators/ip-range-engine.js` | Total Addresses, Bounds, Covering CIDR Blocks | IPv6 covering CIDRs | None (Pure math) | Mismatched IP family | Deterministic range bounds calculation |
| **MAC / OUI Lookup** (`mac-lookup`) | Local IEEE OUI Dataset | `server/tools/services/oui-service.js` | OUI Prefix, Vendor Name, Assignment Type, Scope, Transmission | MA-M / MA-S block granularity | None (IEEE Dataset) | Unregistered / private OUI prefixes | Expanded IEEE OUI dataset lookup with block assignment classification |
| **DNS Lookup** (`dns-lookup`) | Native `node:dns/promises` & DoH API | `server/tools/executors/dns-executor.js` | Record table (`TYPE`, `VALUE`, `TTL`, `PRIORITY`) | DNSSEC validation flags (`AD`, `CD`), Authority/Additional sections | None (Real DNS / DoH) | DoH endpoint rate limits / timeouts | Add DNSSEC status flags, raw DNS header inspection, resolver health tracking |
| **Reverse DNS** (`reverse-dns`) | Native `dns.promises.reverse` | `server/tools/executors/reverse-dns-executor.js` | PTR Hostnames, Status (`SUCCESS`, `NO_PTR`) | Multi-resolver PTR cross-check | None (Real PTR query) | Missing PTR record in in-addr.arpa | Multi-resolver PTR validation |
| **Ping Test** (`ping`) | Native TCP/ICMP Probe Handshake | `server/tools/executors/ping-executor.js` | Min/Avg/Max RTT, Loss %, Jitter, Sequence table | Real ICMP raw socket (currently uses TCP socket probes) | None (Real probes) | Firewalled TCP ports | ICMP socket fallback and clear probe mode labeling |
| **Traceroute** (`traceroute`) | Hop-by-Hop Probe Handler | `server/tools/executors/traceroute-executor.js` | Hop list, RTT, PTR Hostnames | Real ICMP TTL hop decrementing (currently synthesizes hop trace for target IP) | Intermediate hop RTTs are synthesized | High latency on intermediate hops | Real raw socket TTL hop execution or probe agent integration |
| **HTTP / HTTPS Checker** (`http-checker`) | `axios` Request Inspector | `server/tools/executors/http-executor.js` | Status Code, Headers map, Waterfall timing | Exact DNS/TCP/TLS microsecond timing breakdown | Timing breakdown is estimated from total time | Redirect loops, SSL handshake errors | Real HTTP client timing metrics (`performance.now()` hooks) |
| **SSL Certificate** (`ssl-checker`) | `node:tls.Socket` | `server/tools/executors/ssl-executor.js` | Validity dates, Issuer, SANs, Days Remaining | OCSP stapling status, ALPN, Key size | None (Real TLS handshake) | Self-signed certs or expired CA chains | Extended TLS certificate chain analysis |
| **ASN BGP Lookup** (`asn-lookup`) | RIPEstat BGP Data API | `server/tools/providers/asn-provider.js` | AS Name, Org, Announced Prefixes | BGP Upstream Peers, IXP presence, RPKI validation | None (RIPEstat API) | RIPEstat API rate limits | Multi-provider BGP intelligence adapter (RIPEstat + IPinfo BGP) |
| **IP Reputation** (`ip-reputation`) | DNSBL RBL Resolution | `server/tools/providers/rbl-provider.js` | Spamhaus, Barracuda, Spamcop, SORBS status | AbuseIPDB confidence score, threat categories | None (Real DNSBL queries) | DNSBL query rate limits / IP blocks | AbuseIPDB + DNSBL multi-provider aggregation |
| **Bandwidth Speed** (`bandwidth-calculator`) | Local Deterministic Math | `server/tools/calculators/bandwidth-engine.js` | Transfer time matrix across link speeds | Custom overhead factor (protocol overhead) | None (Pure math) | Invalid file size input | Local transfer mathematics |

---

## 2. Infrastructure & Environment Configuration Audit

- **Current Environment Configuration**: Provider API keys (e.g. `IPINFO_TOKEN`, `ABUSEIPDB_KEY`, `RIPESTAT_SOURCEAPP`) are not currently centralized in a dedicated provider config system.
- **Provider Health Tracking**: Missing a health tracking system reporting provider status, latency, last successful request, and quota limits.
- **Field Provenance**: UI displays fields without explicit source metadata badges (e.g., `ⓘ Source: IPinfo`).
- **Data Merger**: Currently lacks a multi-source field merger (`NetworkIntelligenceMerger`) capable of resolving field values across primary, secondary, and fallback providers.

---

## 3. Implementation Action Plan for Tools V3

1. **Provider Configuration & Health Subsystem**:
   - `server/tools/config/provider-config.js`: Centralized environment key loader and provider options.
   - `server/tools/providers/provider-health.js`: Health metrics tracker (Status, Latency ms, Last checked, Quota).

2. **Multi-Provider Adapters**:
   - `server/tools/providers/ipinfo-provider.js`: Real IPinfo API adapter (Geolocation, ASN, Company, Privacy flags: VPN, Proxy, Tor, Hosting, Anycast, Abuse contact).
   - `server/tools/providers/ripestat-provider.js`: RIPEstat Data API adapter (Routing, Announced Prefixes, RIR, RPKI).
   - `server/tools/providers/dns-ptr-provider.js`: DNS PTR adapter.

3. **Provider Registry & Intelligence Merger**:
   - `server/tools/providers/provider-registry.js`: Central registry managing provider adapters.
   - `server/tools/mergers/network-intelligence-merger.js`: Multi-source field-level merger with confidence scoring, source provenance, timestamps, and precise failure state classification (`Not available`, `Not returned by provider`, `Provider unavailable`, `Not configured`).

4. **IP Checker V3 UI Integration**:
   - Update `src/pages/tools/IpCheckerTool.vue` with complete result model (Identity, Network, Routing, Location, Organization, Security, Abuse), Provider Health panel, Data Source badges (`ⓘ Source: IPinfo`), Source Comparison panel, and Refresh Data action.
