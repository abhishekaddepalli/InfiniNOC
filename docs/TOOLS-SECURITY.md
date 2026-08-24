# InfiniNOC — Network Tools Security & Protection Policy

## 1. Overview
Because InfiniNOC is a multi-tenant enterprise SaaS platform, network tools that perform active network requests (Ping, Port Check, HTTP Check, Traceroute, DNS) must enforce strict security controls to prevent abuse, Server-Side Request Forgery (SSRF), internal scanning, and resource exhaustion.

---

## 2. SSRF & Destination Validation

All destination hosts, IP addresses, domain names, and URLs passed to server-side tools undergo strict validation before socket creation:

1. **Blocked IP Ranges**:
   - `127.0.0.0/8` (Loopback / Localhost)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918 Private Networks)
   - `169.254.0.0/16` (Link-Local & Cloud Metadata Endpoints e.g., `169.254.169.254`)
   - `0.0.0.0/8` (Current Network)
   - `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 Loopback / Unique Local / Link-Local)

2. **Domain Resolution Pre-Check**:
   - Domains are resolved prior to execution. If a target domain resolves to a blocked private IP range, the request is rejected immediately with `ERR_SSRF_BLOCKED`.

---

## 3. Command Execution Safety
- **No Arbitrary Shell Execution**: Tools NEVER pass raw user strings into system shell execution (`child_process.exec`).
- Native Node.js networking libraries (`net`, `dns`, `http`, `https`, `tls`, `dgram`) are used exclusively.

---

## 4. Rate Limiting & Quotas
- **Per-User Rate Limits**: Sliding window rate limits per user account.
- **Per-Organization Quotas**: Monthly execution quotas tied to subscription plan limits (Starter, Business, Professional, Enterprise).
- **Execution Timeouts**: Hard socket timeouts (e.g. 5 seconds for Port Check, 10 seconds for HTTP Check) to prevent thread locking.

---

## 5. Audit Logging
Security-sensitive tools (`Port Checker`, `Traceroute`, `HTTP Checker`, `IP Reputation`) log audit records containing:
- `timestamp`
- `user_id`
- `organization_id`
- `tool_id`
- `sanitized_target`
- `execution_status`
