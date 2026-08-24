# InfiniNOC — Network Tools Center Architecture

## 1. Overview
The InfiniNOC Network Tools Center is a modular, enterprise-grade diagnostic framework integrated into the InfiniNOC SaaS platform. It provides network engineers, NOC operators, and sysadmins with low-latency network diagnostic utilities.

---

## 2. Tool Classification & Execution Model

Tools are categorized by execution location into three distinct tiers:

```
                          ┌───────────────────────────┐
                          │   InfiniNOC Client / UI   │
                          └─────────────┬─────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
    │      LOCAL      │        │     SERVER      │        │    PROVIDER     │
    │ Client Math &   │        │ Server Execution│        │ External API    │
    │  Parsing Logic  │        │ Network Packets │        │ Abstraction     │
    └─────────────────┘        └─────────────────┘        └─────────────────┘
```

1. **LOCAL Execution**:
   - Math calculations, CIDR parsing, MAC address normalization, bandwidth formulas.
   - Performed directly in client browser for instant zero-latency feedback without backend overhead.
   - Examples: `Subnet Calculator`, `CIDR Calculator`, `IP Range Calculator`, `Bandwidth Calculator`, `MAC / OUI Lookup`.

2. **SERVER Execution**:
   - Diagnostic network operations requiring server-side sockets, ICMP, DNS, or TCP capabilities.
   - Executed via backend Node.js workers guarded by SSRF protection, rate limiting, and timeout rules.
   - Examples: `Ping`, `Traceroute`, `Port Checker`, `DNS Lookup`, `Reverse DNS`, `HTTP / HTTPS Checker`, `SSL Certificate Checker`.

3. **PROVIDER Execution**:
   - Intelligence lookups querying external threat feeds or BGP registries.
   - Abstracted through provider adapter interfaces to allow changing underlying data providers without modifying client code.
   - Examples: `IP Reputation Checker`, `ASN Lookup`.

---

## 3. Tool Registry Architecture

All tools are registered in a central registry (`server/tools/tool-registry.js`) with standardized metadata:

```javascript
{
    id: "subnet-calculator",
    name: "Subnet Calculator",
    slug: "subnet-calculator",
    category: "calculators",
    description: "Calculate network range, broadcast, netmask, and usable host range.",
    executionType: "local",
    icon: "calculator",
    keywords: ["subnet", "cidr", "netmask", "ip", "host", "broadcast"],
    featured: true,
    enabled: true
}
```

---

## 4. Run From Probe Architecture (Future Capability)
The system is designed with a probe abstraction interface (`ToolExecutor`). Future releases will support running server diagnostics from remote probes (e.g. `Mumbai POP Probe`, `Hyderabad Probe`, `Customer On-Premise Probe`).

```
[Tool Request] ──► [Tool Executor Router] ──► [InfiniNOC Central Server]
                                          └──► [Remote Probe Agent]
```

---

## 5. History & Audit Tracking
- **User History**: Performed tool inputs and results are logged per organization (`user_id`, `org_id`, `tool_slug`, `input_summary`, `status`, `timestamp`).
- **Data Privacy**: Passwords, API keys, credentials, or sensitive auth cookies are strictly excluded from history retention.
