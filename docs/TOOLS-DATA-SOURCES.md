# InfiniNOC — Network Tools Data Sources & Licensing Policy

## 1. Overview
InfiniNOC Network Tools Center uses real-time network diagnostics, standards-based public DNS/IP query interfaces, and licensed intelligence adapters. This document outlines the data sources, licensing terms, rate limits, attribution requirements, and fallback policies for tools in InfiniNOC.

---

## 2. Data Source Inventory

| Tool | Primary Data Source | Provider License / Terms | Rate Limits | Attribution Requirement | Commercial Use Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IP Checker** | RIPEstat Data API & Node DNS (PTR) | RIPE NCC Terms of Service | 100 req/min per IP | Yes: *"Data provided by RIPEstat"* | Commercial licensing review per deployment |
| **Port Checker** | Direct TCP Sockets (`node:net`) | Open Standard (RFC 793) | Rate-limited by InfiniNOC Guard | None | Fully permitted (native socket) |
| **DNS Lookup** | Node DNS Promises (`node:dns/promises`) & DoH | Open Standard (RFC 1035 / RFC 8484) | System / DoH Limits | None | Fully permitted (native resolver) |
| **Subnet Calculator** | Local Math (`net` & IP parsing) | Internal Deterministic Math | Unlimited | None | Fully permitted |

---

## 3. Provider Attribution Policy
When displaying results derived from external registries or intelligence providers, InfiniNOC explicitly displays provider attribution badges and query timestamps in the tool UI (e.g. `Data Source: RIPEstat · Checked at 11:37 AM`).

---

## 4. Provider Fallback Strategy
If a data provider is unreachable or returns a non-200 error code:
1. InfiniNOC attempts secondary fallback providers if configured.
2. If no fallback data is available, InfiniNOC displays `Data unavailable: [reason]` rather than generating simulated or mock data.
