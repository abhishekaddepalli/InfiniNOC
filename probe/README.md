# InfiniNOC Remote Distributed Monitoring Probe

Lightweight, standalone monitoring probe for customer & ISP environments. Performs remote monitoring from inside customer networks and communicates back to InfiniNOC Cloud over **outbound-only TLS WebSocket connections**.

## Architecture & Security

- **Outbound-Only TLS**: Establishes outbound HTTPS/WSS connections (`wss://noc.yourdomain.com`). No inbound ports or firewall rules required on customer networks.
- **One-Time Token Exchange**: Initial deployment uses a single-use registration token (`PROBE_REGISTRATION_TOKEN`), which is immediately rotated into a persistent hashed API key saved securely in local volume storage (`/app/data/.probe-credentials.json`).
- **Real Telemetry & Heartbeat**: Sends real-time heartbeats every 15s containing round-trip latency, public IP, and software version.
- **Capabilities**: ICMP Ping, TCP Port Check, HTTP/HTTPS Request, and DNS Resolution.

---

## Deployment Instructions

### Option 1: Docker CLI Quickstart

```bash
docker run -d \
  --name infininoc-probe \
  --restart always \
  -e PROBE_CLOUD_URL="https://noc.yourdomain.com" \
  -e PROBE_ID="YOUR_PROBE_ID" \
  -e PROBE_REGISTRATION_TOKEN="prb_reg_x1y2z3..." \
  -v probe-data:/app/data \
  infininoc/probe:latest
```

### Option 2: Docker Compose

```yaml
version: '3.8'

services:
  infininoc-probe:
    image: infininoc/probe:latest
    container_name: infininoc-probe
    restart: always
    environment:
      - PROBE_CLOUD_URL=https://noc.yourdomain.com
      - PROBE_ID=1
      - PROBE_REGISTRATION_TOKEN=prb_reg_x1y2z3...
    volumes:
      - probe-data:/app/data

volumes:
  probe-data:
```

Run command:
```bash
docker-compose up -d
```
