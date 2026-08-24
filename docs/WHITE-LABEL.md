# InfiniNOC Source-Level White-Label Specification

**Product Name**: InfiniNOC  
**Company Name**: Infiniforge Technologies  
**Primary Tagline**: *Know Your Network. Before Your Customers Do.*  
**Primary Brand Accent**: Saffron (`#ff9933`)  

---

## 1. Centralized Product Configuration Architecture

InfiniNOC uses a single, centralized source-of-truth configuration object located at [`config/product.json`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/config/product.json):

```json
{
    "productName": "InfiniNOC",
    "companyName": "Infiniforge Technologies",
    "tagline": "Know Your Network. Before Your Customers Do.",
    "website": "https://infiniforge.com",
    "supportEmail": "support@infiniforge.com",
    "logo": "/icon.svg",
    "favicon": "/favicon.ico",
    "copyright": "© Infiniforge Technologies. Derived from open-source components.",
    "version": "1.0.0"
}
```

This configuration module is exported by [`config/product.js`](file:///c:/Users/THALA/Desktop/InfNocmonitor/uptime-kuma-master/config/product.js) and imported across both server and client layers to prevent hardcoded product string drift.

---

## 2. Brand Asset Guidelines

All customer-facing identity graphics are stored in `public/`:

- `public/icon.svg`: Master high-resolution brand vector graphic.
- `public/icon.png`: 512x512 PNG application logo.
- `public/favicon.ico`: Browser tab icon.
- `public/apple-touch-icon.png`: iOS PWA home screen icon.
- `public/icon-192x192.png`: Android PWA manifest icon.
- `public/icon-512x512.png`: High-resolution PWA manifest icon.

---

## 3. Product Naming Standards

1. **Browser Tab Titles**: `InfiniNOC`, `InfiniNOC — Dashboard`, `InfiniNOC — Incidents`.
2. **Notification Headers**: `[InfiniNOC] Outage Alert: <Target Name> is DOWN`.
3. **HTTP User-Agent Header**: `InfiniNOC/1.0.0`.
4. **Header & Sidebar**: Displays official InfiniNOC 2.0 brand identity and organization workspace badge.
