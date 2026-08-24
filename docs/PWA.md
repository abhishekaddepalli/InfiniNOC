# InfiniNOC Progressive Web App (PWA) Documentation

**Date**: August 19, 2026  
**Company**: Infiniforge Technologies  
**Product**: InfiniNOC 1.0.0  
**Document**: `docs/PWA.md`  

---

## Overview
InfiniNOC is built as a Progressive Web App (PWA) supporting standalone mobile and desktop installation.

---

## Service Worker Caching Rules
- **Cache Key**: `infininoc-static-v1.0.0`
- **Cached Static Shell**: HTML, CSS, JavaScript bundles, brand SVG icons, and web fonts.
- **Dynamic Safety Policy**: Service worker explicitly BYPASSES caching for dynamic `/api/`, WebSocket `/socket.io/`, authentication state, and live telemetry data to prevent stale monitoring metrics.

---

## Offline Behavior
When device network status changes to offline:
- Sticky top warning banner displays: `"You are currently offline. Live telemetry monitoring data may be unavailable."`
- Banner automatically dismisses upon network reconnection.
