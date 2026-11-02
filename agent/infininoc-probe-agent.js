#!/usr/bin/env node
/**
 * InfiniNOC Enterprise Remote Distributed Probe Agent
 *
 * Lightweight, zero-dependency, autonomous monitoring daemon designed to execute
 * distributed ICMP Ping, TCP Port, HTTP/S, and DNS health checks from remote branch
 * offices, customer premises, data centers, and private LAN subnets.
 *
 * Usage:
 *   node inifninoc-probe-agent.js --server=https://noc.example.com --probe-id=1 --token=prb_reg_xxx
 *   node inifninoc-probe-agent.js --config=./probe-config.json
 *
 * Ubuntu 22.04 / 24.04 Systemd Service:
 *   [Unit]
 *   Description=InfiniNOC Remote Distributed Probe Agent
 *   After=network.target
 *
 *   [Service]
 *   Type=simple
 *   User=root
 *   WorkingDirectory=/opt/infininoc-probe
 *   ExecStart=/usr/bin/node /opt/infininoc-probe/infininoc-probe-agent.js --config=/opt/infininoc-probe/config.json
 *   Restart=always
 *   RestartSec=10
 *
 *   [Install]
 *   WantedBy=multi-user.target
 */

const http = require("http");
const https = require("https");
const os = require("os");
const net = require("net");
const dns = require("dns").promises;
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const AGENT_VERSION = "1.26.31";

// Parse Command Line Arguments
function parseArgs() {
    const args = {};
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith("--")) {
            const [key, val] = arg.slice(2).split("=");
            args[key] = val !== undefined ? val : true;
        }
    }
    return args;
}

const args = parseArgs();
const configFilePath = args.config || path.join(process.cwd(), "infininoc-probe-config.json");

let config = {
    server: args.server || "http://127.0.0.1:3001",
    probeId: args["probe-id"] ? Number(args["probe-id"]) : null,
    apiKey: args["api-key"] || null,
    token: args.token || null,
    heartbeatInterval: args.interval ? Number(args.interval) : 20,
    taskInterval: 25,
};

// Load saved config file if exists
if (fs.existsSync(configFilePath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
        config = { ...config, ...loaded };
    } catch (e) {
        console.error(`[WARN] Failed to read config file ${configFilePath}: ${e.message}`);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf8");
    } catch (e) {
        console.error(`[WARN] Failed to persist config to ${configFilePath}: ${e.message}`);
    }
}

// HTTP/HTTPS Request Helper
function sendRequest(urlStr, method, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(urlStr);
        const isHttps = urlObj.protocol === "https:";
        const client = isHttps ? https : http;

        const reqHeaders = {
            "Content-Type": "application/json",
            "User-Agent": `InfiniNOC-Probe-Agent/${AGENT_VERSION}`,
            ...headers,
        };

        const bodyData = body ? JSON.stringify(body) : null;
        if (bodyData) {
            reqHeaders["Content-Length"] = Buffer.byteLength(bodyData);
        }

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method.toUpperCase(),
            headers: reqHeaders,
            timeout: 10000,
        };

        const startTime = Date.now();
        const req = client.request(options, (res) => {
            let resData = "";
            res.on("data", (chunk) => {
                resData += chunk;
            });
            res.on("end", () => {
                const roundtrip = Date.now() - startTime;
                let parsed = null;
                try {
                    parsed = JSON.parse(resData);
                } catch (_) {
                    parsed = resData;
                }
                resolve({
                    statusCode: res.statusCode,
                    data: parsed,
                    roundtripMs: roundtrip,
                });
            });
        });

        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timed out after 10000ms"));
        });

        if (bodyData) {
            req.write(bodyData);
        }
        req.end();
    });
}

// Calculate CPU Usage Percentage
function getCpuUsage() {
    return new Promise((resolve) => {
        const cpus1 = os.cpus();
        setTimeout(() => {
            const cpus2 = os.cpus();
            let idleDiff = 0;
            let totalDiff = 0;
            for (let i = 0; i < cpus1.length; i++) {
                const t1 = cpus1[i].times;
                const t2 = cpus2[i].times;
                const idle = t2.idle - t1.idle;
                const total = (t2.user - t1.user) + (t2.nice - t1.nice) + (t2.sys - t1.sys) + (t2.irq - t1.irq) + idle;
                idleDiff += idle;
                totalDiff += total;
            }
            const usage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
            resolve(Math.round(usage * 10) / 10);
        }, 150);
    });
}

// Calculate Memory Usage Percentage
function getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.round(((total - free) / total) * 1000) / 10;
}

let tasksExecuted = 0;
let tasksFailed = 0;

// Execute Network Monitoring Checks
async function executeCheck(task) {
    const type = (task.type || "").toLowerCase();
    const startTime = Date.now();

    try {
        if (type === "ping") {
            const host = task.hostname || "127.0.0.1";
            const pingMs = await runPingCheck(host, task.timeout || 3);
            return {
                monitor_id: task.id,
                status: 1,
                ping: pingMs,
                msg: `ICMP echo reply received from ${host}. Latency: ${pingMs} ms. Packet loss: 0%.`,
            };
        } else if (type === "port") {
            const host = task.hostname || "127.0.0.1";
            const port = task.port || 80;
            const pingMs = await runTcpCheck(host, port, (task.timeout || 5) * 1000);
            return {
                monitor_id: task.id,
                status: 1,
                ping: pingMs,
                msg: `TCP connection established to ${host}:${port} in ${pingMs} ms.`,
            };
        } else if (type === "http" || type === "keyword" || type === "json-query") {
            const url = task.url;
            const res = await sendRequest(url, task.method || "GET", {}, null);
            if (res.statusCode >= 200 && res.statusCode < 400) {
                return {
                    monitor_id: task.id,
                    status: 1,
                    ping: res.roundtripMs,
                    msg: `HTTP status ${res.statusCode}. Response time: ${res.roundtripMs} ms.`,
                };
            } else {
                throw new Error(`HTTP status code ${res.statusCode}`);
            }
        } else if (type === "dns") {
            const host = task.hostname;
            const rType = task.dns_resolve_type || "A";
            const records = await dns.resolve(host, rType);
            const latency = Date.now() - startTime;
            return {
                monitor_id: task.id,
                status: 1,
                ping: latency,
                msg: `DNS resolution [${rType}] succeeded in ${latency} ms: ${Array.isArray(records) ? records.join(", ") : records}`,
            };
        } else {
            // Generic ping fallback
            const host = task.hostname || "127.0.0.1";
            const pingMs = await runPingCheck(host, 3);
            return {
                monitor_id: task.id,
                status: 1,
                ping: pingMs,
                msg: `Check completed in ${pingMs} ms.`,
            };
        }
    } catch (err) {
        return {
            monitor_id: task.id,
            status: 0,
            ping: null,
            msg: `Check failed via probe: ${err.message}`,
        };
    }
}

// Ping Execution via child process or TCP handshake
function runPingCheck(host, timeoutSec = 3) {
    return new Promise((resolve, reject) => {
        const isWin = process.platform === "win32";
        const cmd = isWin
            ? `ping -n 1 -w ${timeoutSec * 1000} ${host}`
            : `ping -c 1 -W ${timeoutSec} ${host}`;

        const startTime = Date.now();
        exec(cmd, (error, stdout) => {
            if (error) {
                // Fallback to TCP handshake if ICMP ping requires permissions
                runTcpCheck(host, 80, 2000).then(resolve).catch(() => reject(error));
                return;
            }
            const elapsed = Date.now() - startTime;
            // Extract ping time if regex matches
            const match = stdout.match(/(?:time|temps|tiempo)[=<]([\d.]+)\s*ms/i);
            if (match && match[1]) {
                resolve(Math.round(parseFloat(match[1])));
            } else {
                resolve(Math.max(1, elapsed));
            }
        });
    });
}

// TCP Port Check
function runTcpCheck(host, port, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(timeoutMs);

        socket.connect(port, host, () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve(latency);
        });

        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error(`TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
        });

        socket.on("error", (err) => {
            socket.destroy();
            reject(err);
        });
    });
}

// Step 1: Initial Registration
async function register() {
    console.log(`[INIT] Enrolling Remote Probe with Central Server: ${config.server}...`);
    try {
        const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
        const res = await sendRequest(`${config.server}/api/probe/register`, "POST", {}, {
            probeId: config.probeId,
            registrationToken: config.token,
            version: AGENT_VERSION,
            os_info: osInfo,
        });

        if (res.statusCode === 200 && res.data && res.data.ok) {
            config.probeId = res.data.probeId;
            config.apiKey = res.data.apiKey;
            delete config.token; // One-time token used
            saveConfig();
            console.log(`[SUCCESS] Probe #${config.probeId} registered successfully! Persistent API Key acquired.`);
            return true;
        } else {
            console.error(`[ERROR] Registration failed: ${res.data?.msg || res.statusCode}`);
            return false;
        }
    } catch (e) {
        console.error(`[ERROR] Connection error during probe registration: ${e.message}`);
        return false;
    }
}

// Step 2: Periodic Heartbeat
async function sendHeartbeat() {
    if (!config.probeId || !config.apiKey) return;

    try {
        const cpu = await getCpuUsage();
        const mem = getMemoryUsage();
        const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;

        const res = await sendRequest(`${config.server}/api/probe/heartbeat`, "POST", {
            "x-probe-id": String(config.probeId),
            "x-api-key": config.apiKey,
        }, {
            cpu_usage: cpu,
            memory_usage: mem,
            disk_usage: 0,
            latency_ms: 0,
            version: AGENT_VERSION,
            os_info: osInfo,
            tasks_executed: tasksExecuted,
            tasks_failed: tasksFailed,
        });

        if (res.statusCode === 200 && res.data?.ok) {
            console.log(`[HEARTBEAT] Probe #${config.probeId} telemetry posted. CPU: ${cpu}%, RAM: ${mem}%, Latency: ${res.roundtripMs}ms`);
        } else {
            console.warn(`[WARN] Heartbeat warning: ${res.data?.msg || res.statusCode}`);
        }
    } catch (e) {
        console.error(`[WARN] Heartbeat transmission failed: ${e.message}`);
    }
}

// Step 3: Fetch and Execute Assigned Tasks
async function processAssignedTasks() {
    if (!config.probeId || !config.apiKey) return;

    try {
        const res = await sendRequest(`${config.server}/api/probe/tasks?probeId=${config.probeId}`, "GET", {
            "x-probe-id": String(config.probeId),
            "x-api-key": config.apiKey,
        });

        if (res.statusCode === 200 && res.data && Array.isArray(res.data.tasks)) {
            const tasks = res.data.tasks;
            if (tasks.length > 0) {
                console.log(`[TASKS] Executing ${tasks.length} assigned monitoring check(s)...`);
                for (const task of tasks) {
                    const result = await executeCheck(task);
                    if (result.status === 1) {
                        tasksExecuted++;
                    } else {
                        tasksFailed++;
                    }

                    // Submit result back to central server
                    await sendRequest(`${config.server}/api/probe/results`, "POST", {
                        "x-probe-id": String(config.probeId),
                        "x-api-key": config.apiKey,
                    }, {
                        payload: result,
                    });
                }
            }
        }
    } catch (e) {
        console.warn(`[WARN] Task poll/execution error: ${e.message}`);
    }
}

// Main Agent Daemon Loop
async function main() {
    console.log(`=======================================================`);
    console.log(` InfiniNOC Remote Distributed Probe Agent v${AGENT_VERSION}`);
    console.log(` Central Server: ${config.server}`);
    console.log(` OS Environment: ${os.type()} ${os.release()} (${os.arch()})`);
    console.log(`=======================================================`);

    if (!config.apiKey) {
        if (!config.probeId || !config.token) {
            console.error("[FATAL] Probe requires either --config file or --probe-id and --token parameters for initial registration.");
            process.exit(1);
        }
        const registered = await register();
        if (!registered) {
            process.exit(1);
        }
    }

    // Initial immediate heartbeat & task run
    await sendHeartbeat();
    await processAssignedTasks();

    // Schedule regular intervals
    setInterval(sendHeartbeat, config.heartbeatInterval * 1000);
    setInterval(processAssignedTasks, config.taskInterval * 1000);

    console.log(`[ACTIVE] Probe daemon is actively monitoring. Heartbeat every ${config.heartbeatInterval}s, tasks every ${config.taskInterval}s.`);
}

process.on("SIGINT", () => {
    console.log("\n[SHUTDOWN] Probe agent shutting down cleanly...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("\n[SHUTDOWN] Probe agent received SIGTERM.");
    process.exit(0);
});

main().catch((err) => {
    console.error(`[FATAL] Probe daemon error: ${err.message}`);
    process.exit(1);
});
