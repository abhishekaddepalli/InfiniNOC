const { spawn } = require("child_process");
const os = require("os");
const { log } = require("../../../src/util");

/**
 * Real Server Route Table Diagnostic Executor
 * Retrieves and parses actual operating system routing table from central server.
 */
class RouteTableExecutor {
    /**
     * Inspect local host kernel routing table
     * @returns {Promise<object>} Parsed routing table
     */
    static async execute() {
        const isWin = os.platform() === "win32";
        const cmd = isWin ? "route" : "ip";
        const args = isWin ? ["print", "-4"] : ["route", "show"];

        return new Promise((resolve) => {
            let stdout = "";
            let stderr = "";

            const proc = spawn(cmd, args, { windowsHide: true, timeout: 5000 });
            proc.stdout.on("data", (d) => { stdout += d.toString(); });
            proc.stderr.on("data", (d) => { stderr += d.toString(); });

            proc.on("error", (err) => {
                log.error("route-table-executor", `Route command error: ${err.message}`);
                resolve({
                    ok: false,
                    status: "EXECUTION_ERROR",
                    error: `Failed to retrieve route table: ${err.message}`,
                    routes: [],
                    checkedAt: new Date().toISOString(),
                });
            });

            proc.on("close", () => {
                const routes = RouteTableExecutor.parseRoutes(stdout, isWin);
                resolve({
                    ok: routes.length > 0,
                    status: "SUCCESS",
                    os: os.platform(),
                    totalRoutes: routes.length,
                    routes,
                    checkedAt: new Date().toISOString(),
                });
            });
        });
    }

    /**
     * Parse system routing table
     */
    static parseRoutes(raw, isWin) {
        const routes = [];
        const lines = raw.split(/\r?\n/);

        if (isWin) {
            let inActiveRoutes = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (/Active Routes:/i.test(trimmed)) {
                    inActiveRoutes = true;
                    continue;
                }
                if (inActiveRoutes && (/Persistent Routes:/i.test(trimmed) || /IPv6 Route Table/i.test(trimmed))) {
                    break;
                }
                if (inActiveRoutes) {
                    // Columns: Network Destination   Netmask   Gateway   Interface   Metric
                    const tokens = trimmed.split(/\s+/);
                    if (tokens.length >= 5 && /^[\d.]+$/.test(tokens[0]) && /^[\d.]+$/.test(tokens[1])) {
                        routes.push({
                            destination: tokens[0],
                            netmask: tokens[1],
                            gateway: tokens[2],
                            interface: tokens[3],
                            metric: parseInt(tokens[4], 10) || 0,
                            type: tokens[0] === "0.0.0.0" ? "DEFAULT_GATEWAY" : "LOCAL_NETWORK",
                        });
                    }
                }
            }
        } else {
            // Linux "ip route show":
            // default via 192.168.1.1 dev eth0 proto dhcp metric 100
            // 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.50
            for (const line of lines) {
                const tokens = line.trim().split(/\s+/);
                if (tokens.length >= 3) {
                    const isDefault = tokens[0] === "default";
                    let gateway = "On-Link";
                    let iface = "eth0";
                    let metric = 0;

                    for (let i = 0; i < tokens.length; i++) {
                        if (tokens[i] === "via" && tokens[i + 1]) gateway = tokens[i + 1];
                        if (tokens[i] === "dev" && tokens[i + 1]) iface = tokens[i + 1];
                        if (tokens[i] === "metric" && tokens[i + 1]) metric = parseInt(tokens[i + 1], 10);
                    }

                    routes.push({
                        destination: isDefault ? "0.0.0.0" : tokens[0],
                        netmask: isDefault ? "0.0.0.0" : "CIDR",
                        gateway,
                        interface: iface,
                        metric,
                        type: isDefault ? "DEFAULT_GATEWAY" : "LOCAL_NETWORK",
                    });
                }
            }
        }

        return routes;
    }
}

module.exports = { RouteTableExecutor };
