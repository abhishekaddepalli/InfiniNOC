const { io } = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const net = require("net");
const dns = require("dns");

const CLOUD_URL = process.env.PROBE_CLOUD_URL || "http://localhost:3000";
const PROBE_ID = process.env.PROBE_ID ? Number(process.env.PROBE_ID) : null;
const REGISTRATION_TOKEN = process.env.PROBE_REGISTRATION_TOKEN || null;
const CREDENTIALS_FILE = process.env.PROBE_CREDENTIALS_FILE || path.join(__dirname, ".probe-credentials.json");
const PROBE_VERSION = "1.0.0";

let apiKey = process.env.PROBE_API_KEY || null;

console.log("=========================================");
console.log("⚡ InfiniNOC Remote Distributed Probe v" + PROBE_VERSION);
console.log("=========================================");

if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
        const stored = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
        if (stored.apiKey) {
            apiKey = stored.apiKey;
            console.log("🔑 Loaded persistent probe API key from storage.");
        }
    } catch (e) {
        console.warn("⚠️ Could not read stored probe credentials:", e.message);
    }
}

if (!PROBE_ID) {
    console.error("❌ ERROR: PROBE_ID environment variable is required.");
    process.exit(1);
}

if (!apiKey && !REGISTRATION_TOKEN) {
    console.error("❌ ERROR: Either PROBE_API_KEY or PROBE_REGISTRATION_TOKEN environment variable is required.");
    process.exit(1);
}

console.log("🌐 Connecting outbound TLS WebSocket to InfiniNOC Cloud: " + CLOUD_URL);

const socket = io(CLOUD_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 3000,
});

let heartbeatTimer = null;

/**
 * Send real-time heartbeat telemetry to InfiniNOC Cloud
 */
function sendHeartbeat() {
    if (!socket.connected || !apiKey) {
        return;
    }

    const start = Date.now();
    const telemetry = {
        version: PROBE_VERSION,
        latency_ms: 0,
        timestamp: new Date().toISOString(),
    };

    socket.emit("probeHeartbeat", {
        probeId: PROBE_ID,
        apiKey: apiKey,
        telemetry: telemetry,
    }, (res) => {
        if (res && res.ok) {
            const rtt = Date.now() - start;
            telemetry.latency_ms = rtt;
            console.log(`💓 Heartbeat acknowledged by Cloud (RTT: ${rtt}ms)`);
        } else {
            console.warn("⚠️ Heartbeat rejected:", res ? res.msg : "Unknown error");
        }
    });
}

/**
 * Start periodic 15-second heartbeat loop
 */
function startHeartbeatLoop() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
    }

    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, 15000);
}

socket.on("connect", async () => {
    console.log("✅ Outbound connection established to InfiniNOC Cloud.");

    if (!apiKey && REGISTRATION_TOKEN) {
        console.log("🔒 Exchanging one-time registration token for persistent API credentials...");
        socket.emit("registerProbe", {
            probeId: PROBE_ID,
            registrationToken: REGISTRATION_TOKEN,
            version: PROBE_VERSION,
        }, (res) => {
            if (res && res.ok && res.apiKey) {
                apiKey = res.apiKey;
                console.log("🎉 Registration successful! Persistent API Key acquired.");
                try {
                    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({ apiKey: res.apiKey, probeId: PROBE_ID }));
                } catch (e) {
                    console.warn("Could not save credentials to file:", e.message);
                }
                startHeartbeatLoop();
            } else {
                console.error("❌ Registration failed:", res ? res.msg : "Unknown error");
            }
        });
    } else if (apiKey) {
        startHeartbeatLoop();
    }
});

socket.on("disconnect", () => {
    console.warn("⚠️ Disconnected from InfiniNOC Cloud. Attempting auto-reconnect...");
});

/**
 * Check HTTP / HTTPS target endpoint
 * @param {string} url Target URL
 * @returns {Promise<object>} Result
 */
async function checkHttp(url) {
    const start = Date.now();
    return new Promise((resolve) => {
        const client = url.startsWith("https") ? https : http;
        const req = client.get(url, { timeout: 5000 }, (res) => {
            resolve({ ok: res.statusCode < 400, statusCode: res.statusCode, responseTime: Date.now() - start });
        });
        req.on("error", (err) => {
            resolve({ ok: false, msg: err.message, responseTime: Date.now() - start });
        });
        req.on("timeout", () => {
            req.destroy();
            resolve({ ok: false, msg: "Timeout", responseTime: 5000 });
        });
    });
}

/**
 * Check TCP port connectivity
 * @param {string} host Target hostname or IP
 * @param {number} port Target port
 * @returns {Promise<object>} Result
 */
async function checkTcp(host, port) {
    const start = Date.now();
    return new Promise((resolve) => {
        const conn = new net.Socket();
        conn.setTimeout(5000);
        conn.connect(port, host, () => {
            conn.destroy();
            resolve({ ok: true, responseTime: Date.now() - start });
        });
        conn.on("error", (err) => {
            resolve({ ok: false, msg: err.message, responseTime: Date.now() - start });
        });
        conn.on("timeout", () => {
            conn.destroy();
            resolve({ ok: false, msg: "Timeout", responseTime: 5000 });
        });
    });
}

/**
 * Perform DNS resolution lookup
 * @param {string} hostname Target hostname
 * @returns {Promise<object>} Result
 */
async function checkDns(hostname) {
    const start = Date.now();
    return new Promise((resolve) => {
        dns.lookup(hostname, (err, address) => {
            if (err) {
                resolve({ ok: false, msg: err.message, responseTime: Date.now() - start });
            } else {
                resolve({ ok: true, address: address, responseTime: Date.now() - start });
            }
        });
    });
}

module.exports = {
    checkHttp,
    checkTcp,
    checkDns,
};
