let express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const {
    allowDevAllOrigin,
    allowAllOrigin,
    percentageToColor,
    filterAndJoin,
    sendHttpError,
} = require("../util-server");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING, flipStatus, log, badgeConstants } = require("../../src/util");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { makeBadge } = require("badge-maker");
const { Prometheus } = require("../prometheus");
const Database = require("../database");
const { UptimeCalculator } = require("../uptime-calculator");
const { Settings } = require("../settings");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

router.get("/api/entry-page", async (request, response) => {
    allowDevAllOrigin(response);

    let result = {};
    let hostname = request.hostname;
    if ((await Settings.get("trustProxy")) && request.headers["x-forwarded-host"]) {
        hostname = request.headers["x-forwarded-host"];
    }

    if (hostname in StatusPage.domainMappingList) {
        result.type = "statusPageMatchedDomain";
        result.statusPageSlug = StatusPage.domainMappingList[hostname];
    } else {
        result.type = "entryPage";
        result.entryPage = server.entryPage;
    }
    response.json(result);
});

router.all("/api/push/:pushToken", async (request, response) => {
    try {
        let pushToken = request.params.pushToken;
        let msg = request.query.msg || "OK";
        let ping = parseFloat(request.query.ping) || null;
        let statusString = request.query.status || "up";
        const statusFromParam = statusString === "up" ? UP : DOWN;

        // Validate ping value - max 100 billion ms (~3.17 years)
        // Fits safely in both BIGINT and FLOAT(20,2)
        const MAX_PING_MS = 100000000000;
        if (ping !== null && (ping < 0 || ping > MAX_PING_MS)) {
            throw new Error(`Invalid ping value. Must be between 0 and ${MAX_PING_MS} ms.`);
        }

        let monitor = await R.findOne("monitor", " push_token = ? AND active = 1 ", [pushToken]);

        if (!monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await Monitor.getPreviousHeartbeat(monitor.id);

        let isFirstBeat = true;

        let bean = R.dispense("heartbeat");
        bean.time = R.isoDateTimeMillis(dayjs.utc());
        bean.monitor_id = monitor.id;
        bean.ping = ping;
        bean.msg = msg;
        bean.downCount = previousHeartbeat?.downCount || 0;

        if (previousHeartbeat) {
            isFirstBeat = false;
            bean.duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

        if (await Monitor.isUnderMaintenance(monitor.id)) {
            msg = "Monitor under maintenance";
            bean.status = MAINTENANCE;
        } else {
            determineStatus(statusFromParam, previousHeartbeat, monitor.maxretries, monitor.isUpsideDown(), bean);
        }

        // Calculate uptime
        let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitor.id);
        let endTimeDayjs = await uptimeCalculator.update(bean.status, parseFloat(bean.ping));
        bean.end_time = R.isoDateTimeMillis(endTimeDayjs);

        log.debug("router", `/api/push/ called at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`);
        log.debug("router", "PreviousStatus: " + previousHeartbeat?.status);
        log.debug("router", "Current Status: " + bean.status);

        bean.important = Monitor.isImportantBeat(isFirstBeat, previousHeartbeat?.status, bean.status);

        if (Monitor.isImportantForNotification(isFirstBeat, previousHeartbeat?.status, bean.status)) {
            // Reset down count
            bean.downCount = 0;

            log.debug("monitor", `[${monitor.name}] sendNotification`);
            await Monitor.sendNotification(isFirstBeat, monitor, bean);
        } else {
            if (bean.status === DOWN && monitor.resendInterval > 0) {
                ++bean.downCount;
                if (bean.downCount >= monitor.resendInterval) {
                    // Send notification again, because we are still DOWN
                    log.debug(
                        "monitor",
                        `[${monitor.name}] sendNotification again: Down Count: ${bean.downCount} | Resend Interval: ${monitor.resendInterval}`
                    );
                    await Monitor.sendNotification(isFirstBeat, monitor, bean);

                    // Reset down count
                    bean.downCount = 0;
                }
            }
        }

        await R.store(bean);

        io.to(monitor.user_id).emit("heartbeat", bean.toJSON());

        Monitor.sendStats(io, monitor.id, monitor.user_id);

        try {
            new Prometheus(monitor, await monitor.getTags()).update(bean, undefined);
        } catch (e) {
            log.error("prometheus", "Please submit an issue to our GitHub repo. Prometheus update error: ", e.message);
        }

        response.json({
            ok: true,
        });
    } catch (e) {
        response.status(404).json({
            ok: false,
            msg: e.message,
        });
    }
});

router.get("/api/badge/:id/status", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        upLabel = "Up",
        downLabel = "Down",
        pendingLabel = "Pending",
        maintenanceLabel = "Maintenance",
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        pendingColor = badgeConstants.defaultPendingColor,
        maintenanceColor = badgeConstants.defaultMaintenanceColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }
        const overrideValue = value !== undefined ? parseInt(value) : undefined;
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(requestedMonitorId);
            const state = overrideValue !== undefined ? overrideValue : heartbeat.status;

            if (label === undefined) {
                badgeValues.label = "Status";
            } else {
                badgeValues.label = label;
            }
            switch (state) {
                case DOWN:
                    badgeValues.color = downColor;
                    badgeValues.message = downLabel;
                    break;
                case UP:
                    badgeValues.color = upColor;
                    badgeValues.message = upLabel;
                    break;
                case PENDING:
                    badgeValues.color = pendingColor;
                    badgeValues.message = pendingLabel;
                    break;
                case MAINTENANCE:
                    badgeValues.color = maintenanceColor;
                    badgeValues.message = maintenanceLabel;
                    break;
                default:
                    badgeValues.color = badgeConstants.naColor;
                    badgeValues.message = "N/A";
            }
        }

        // build the svg based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/uptime/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultUptimeLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultUptimeValueSuffix,
        color,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }
        // if no duration is given, set value to 24 (h)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
            const uptime = overrideValue ?? uptimeCalculator.getDataByDuration(requestedDuration).uptime;

            // limit the displayed uptime percentage to four (two, when displayed as percent) decimal digits
            const cleanUptime = (uptime * 100).toPrecision(4);

            // use a given, custom color or calculate one based on the uptime value
            badgeValues.color = color ?? percentageToColor(uptime);
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Uptime (${requestedDuration.slice(0, -1)}${labelSuffix})`,
            ]);
            badgeValues.message = filterAndJoin([prefix, cleanUptime, suffix]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/ping/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultPingLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        // Check if monitor is public
        const publicMonitor = await isMonitorPublic(requestedMonitorId);

        const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
        const avgPing = uptimeCalculator.getDataByDuration(requestedDuration).avgPing;

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPingValue = parseInt(overrideValue ?? avgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a lable string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Ping (${requestedDuration.slice(0, -1)}${labelSuffix})`,
            ]);
            badgeValues.message = filterAndJoin([prefix, avgPingValue, suffix]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/avg-response/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        const requestedDuration = Math.min(request.params.duration ? parseInt(request.params.duration, 10) : 24, 720);
        const overrideValue = value && parseFloat(value);

        const sqlHourOffset = Database.sqlHourOffset();

        const publicAvgPing = parseInt(
            await R.getCell(
                `
            SELECT AVG(ping) FROM monitor_group, \`group\`, heartbeat
            WHERE monitor_group.group_id = \`group\`.id
            AND heartbeat.time > ${sqlHourOffset}
            AND heartbeat.ping IS NOT NULL
            AND public = 1
            AND heartbeat.monitor_id = ?
            `,
                [-requestedDuration, requestedMonitorId]
            )
        );

        const badgeValues = { style };

        if (!publicAvgPing) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPing = parseInt(overrideValue ?? publicAvgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Response (${requestedDuration}h)`,
                labelSuffix,
            ]);
            badgeValues.message = filterAndJoin([prefix, avgPing, suffix]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/cert-exp", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const date = request.query.date;

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = date ? "" : badgeConstants.defaultCertExpValueSuffix,
        upColor = badgeConstants.defaultUpColor,
        warnColor = badgeConstants.defaultWarnColor,
        downColor = badgeConstants.defaultDownColor,
        warnDays = badgeConstants.defaultCertExpireWarnDays,
        downDays = badgeConstants.defaultCertExpireDownDays,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        const overrideValue = value && parseFloat(value);
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [requestedMonitorId]);

            if (!tlsInfoBean) {
                // return a "No/Bad Cert" badge in naColor (grey), if no cert saved (does not save bad certs?)
                badgeValues.message = "No/Bad Cert";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const tlsInfo = JSON.parse(tlsInfoBean.info_json);

                if (!tlsInfo.valid) {
                    // return a "Bad Cert" badge in naColor (grey), when cert is not valid
                    badgeValues.message = "Bad Cert";
                    badgeValues.color = downColor;
                } else {
                    const daysRemaining = parseInt(overrideValue ?? tlsInfo.certInfo.daysRemaining);

                    if (daysRemaining > warnDays) {
                        badgeValues.color = upColor;
                    } else if (daysRemaining > downDays) {
                        badgeValues.color = warnColor;
                    } else {
                        badgeValues.color = downColor;
                    }
                    // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                    badgeValues.labelColor = labelColor ?? "";
                    // build a label string. If a custom label is given, override the default one
                    badgeValues.label = filterAndJoin([labelPrefix, label ?? "Cert Exp.", labelSuffix]);
                    badgeValues.message = filterAndJoin([
                        prefix,
                        date ? tlsInfo.certInfo.validTo : daysRemaining,
                        suffix,
                    ]);
                }
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/response", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        const overrideValue = value && parseFloat(value);
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(requestedMonitorId);

            if (!heartbeat.ping) {
                // return a "N/A" badge in naColor (grey), if previous heartbeat has no ping

                badgeValues.message = "N/A";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const ping = parseInt(overrideValue ?? heartbeat.ping);

                badgeValues.color = color;
                // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                badgeValues.labelColor = labelColor ?? "";
                // build a label string. If a custom label is given, override the default one
                badgeValues.label = filterAndJoin([labelPrefix, label ?? "Response", labelSuffix]);
                badgeValues.message = filterAndJoin([prefix, ping, suffix]);
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

/**
 * Determines the status of the next beat in the push route handling.
 * @param {string} status - The reported new status.
 * @param {object} previousHeartbeat - The previous heartbeat object.
 * @param {number} maxretries - The maximum number of retries allowed.
 * @param {boolean} isUpsideDown - Indicates if the monitor is upside down.
 * @param {object} bean - The new heartbeat object.
 * @returns {void}
 */
function determineStatus(status, previousHeartbeat, maxretries, isUpsideDown, bean) {
    if (isUpsideDown) {
        status = flipStatus(status);
    }

    if (previousHeartbeat) {
        if (previousHeartbeat.status === UP && status === DOWN) {
            // Going Down
            if (maxretries > 0 && previousHeartbeat.retries < maxretries) {
                // Retries available
                bean.retries = previousHeartbeat.retries + 1;
                bean.status = PENDING;
            } else {
                // No more retries
                bean.retries = 0;
                bean.status = DOWN;
            }
        } else if (previousHeartbeat.status === PENDING && status === DOWN && previousHeartbeat.retries < maxretries) {
            // Retries available
            bean.retries = previousHeartbeat.retries + 1;
            bean.status = PENDING;
        } else {
            // No more retries or not pending
            if (status === DOWN) {
                bean.retries = previousHeartbeat.retries + 1;
                bean.status = status;
            } else {
                bean.retries = 0;
                bean.status = status;
            }
        }
    } else {
        // First beat?
        if (status === DOWN && maxretries > 0) {
            // Retries available
            bean.retries = 1;
            bean.status = PENDING;
        } else {
            // Retires not enabled
            bean.retries = 0;
            bean.status = status;
        }
    }
}

/**
 * Check whether a monitor is publc
 * @param {number} monitorID - Monitor id
 * @returns {Promise<boolean>} true if the monitor is public, otherwise false
 */
async function isMonitorPublic(monitorID) {
    let publicMonitor = await R.getRow(
        `
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND monitor_group.monitor_id = ?
            AND public = 1
        `,
        [monitorID]
    );
    return !!publicMonitor;
}
/**
 * Authenticated Platform Backup Archive Download Endpoint
 * GET /api/platform/backups/:fileName/download
 */
router.get("/api/platform/backups/:fileName/download", async (request, response) => {
    try {
        const disableAuth = await Settings.get("disableAuth");
        if (!disableAuth) {
            let token = request.query.token || request.headers.authorization;
            if (token && token.startsWith("Bearer ")) {
                token = token.slice(7);
            }

            if (!token) {
                return response.status(401).json({ ok: false, msg: "Authentication token required." });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, server.jwtSecret);
            } catch (_) {
                return response.status(401).json({ ok: false, msg: "Invalid or expired token." });
            }

            const user = await R.findOne("user", " username = ? AND active = 1 ", [decoded.username]);
            if (!user) {
                return response.status(401).json({ ok: false, msg: "User account not active." });
            }

            const SuperAdmin = require("../model/super-admin");
            const isSuper = await SuperAdmin.isSuperAdmin(user.id);
            if (!isSuper) {
                return response.status(403).json({ ok: false, msg: "Access denied. Only Super Admin can download platform backups." });
            }
        }

        const fileName = request.params.fileName;
        const BackupEngine = require("../backup");
        const filePath = BackupEngine.getSanitizedFilePath(fileName);

        if (!fs.existsSync(filePath)) {
            return response.status(404).json({ ok: false, msg: "Backup file not found." });
        }

        const stats = await fs.promises.stat(filePath);
        const downloadName = BackupEngine.getDownloadFileName(fileName, stats.mtime);

        response.setHeader("Content-Type", "application/octet-stream");
        response.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        response.setHeader("Content-Length", stats.size);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(response);
    } catch (error) {
        log.error("backup-engine", `Download endpoint error: ${error.message}`);
        response.status(500).json({ ok: false, msg: error.message });
    }
});

// ==========================================
// InfiniNOC Remote Distributed Probes REST API
// ==========================================
const Probe = require("../model/probe");

/**
 * Probe Registration: Exchange one-time token for persistent API key
 */
router.post("/api/probe/register", async (request, response) => {
    allowAllOrigin(response);
    try {
        const { probeId, registrationToken, version, os_info, region } = request.body || {};
        if (!probeId || !registrationToken) {
            return response.status(400).json({ ok: false, msg: "probeId and registrationToken are required." });
        }
        const ipAddress = request.headers["x-forwarded-for"] || request.socket.remoteAddress || "127.0.0.1";
        const result = await Probe.registerProbe(probeId, registrationToken, ipAddress, version || "1.0.0", {
            os_info,
            region,
        });
        response.json({ ok: true, ...result });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

/**
 * Probe Heartbeat: Ingest system telemetry (CPU, RAM, Disk, Latency)
 */
router.post("/api/probe/heartbeat", async (request, response) => {
    allowAllOrigin(response);
    try {
        const probeId = request.headers["x-probe-id"] || request.body?.probeId;
        const apiKey = request.headers["x-api-key"] || request.body?.apiKey;
        if (!probeId || !apiKey) {
            return response.status(401).json({ ok: false, msg: "Probe ID and API key are required." });
        }
        const ipAddress = request.headers["x-forwarded-for"] || request.socket.remoteAddress || undefined;
        const telemetry = {
            ...(request.body || {}),
            ip_address: ipAddress,
        };
        const result = await Probe.recordHeartbeat(probeId, apiKey, telemetry);
        response.json({ ok: true, ...result });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

/**
 * Probe Tasks: Get assigned monitors for this probe
 */
router.get("/api/probe/tasks", async (request, response) => {
    allowAllOrigin(response);
    try {
        const probeId = request.headers["x-probe-id"] || request.query?.probeId;
        const apiKey = request.headers["x-api-key"] || request.query?.apiKey;
        if (!probeId || !apiKey) {
            return response.status(401).json({ ok: false, msg: "Probe ID and API key are required." });
        }
        const tasks = await Probe.getAssignedTasks(probeId, apiKey);
        response.json({ ok: true, tasks });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

/**
 * Probe Results: Ingest monitoring check execution result
 */
router.post("/api/probe/results", async (request, response) => {
    allowAllOrigin(response);
    try {
        const probeId = request.headers["x-probe-id"] || request.body?.probeId;
        const apiKey = request.headers["x-api-key"] || request.body?.apiKey;
        if (!probeId || !apiKey) {
            return response.status(401).json({ ok: false, msg: "Probe ID and API key are required." });
        }
        const payload = request.body?.payload || request.body;
        const result = await Probe.submitTaskResult(probeId, apiKey, payload);
        response.json({ ok: true, ...result });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

/**
 * Download Agent Executable JavaScript File
 */
router.get("/api/probe/download/agent.js", async (request, response) => {
    allowAllOrigin(response);
    const agentPath = path.join(__dirname, "..", "..", "agent", "infininoc-probe-agent.js");
    if (!fs.existsSync(agentPath)) {
        return response.status(404).send("// Agent file not found");
    }

    const probeId = request.headers["x-probe-id"] || request.query?.probeId;
    const token = request.headers["x-probe-token"] || request.query?.token;

    if (probeId && token) {
        try {
            await Probe.validateToken(Number(probeId), String(token));
        } catch (err) {
            return response.status(403).json({ ok: false, msg: err.message });
        }
    }

    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="infininoc-probe-agent.js"');
    response.send(fs.readFileSync(agentPath, "utf8"));
});

/**
 * Download Windows PowerShell Installer with pre-configured parameters
 */
router.get("/api/probe/download/install.ps1", async (request, response) => {
    allowAllOrigin(response);
    const ps1Path = path.join(__dirname, "..", "..", "agent", "windows", "install.ps1");
    if (fs.existsSync(ps1Path)) {
        let content = fs.readFileSync(ps1Path, "utf8");
        const hostUrl = `${request.protocol}://${request.get("host")}`;
        const probeId = request.query.probeId ? Number(request.query.probeId) : 0;
        const token = request.query.token ? String(request.query.token).replace(/[^a-zA-Z0-9_-]/g, "") : "";

        // If probeId and token are provided, validate the token before serving installer
        if (probeId && token) {
            try {
                await Probe.validateToken(probeId, token);
            } catch (err) {
                return response.status(403).send(`# Error: ${err.message}`);
            }
        }

        // If invoked with query parameters, prefill parameter defaults using regex
        if (probeId || token) {
            content = content.replace(
                /\[string\]\$Server\s*=\s*"[^"]*"/,
                `[string]$Server = "${hostUrl}"`
            ).replace(
                /\[int\]\$ProbeId\s*=\s*\d+/,
                `[int]$ProbeId = ${probeId}`
            ).replace(
                /\[string\]\$Token\s*=\s*"[^"]*"/,
                `[string]$Token = "${token}"`
            );
        }

        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.setHeader("Content-Disposition", 'inline; filename="install.ps1"');
        response.send(content);
    } else {
        response.status(404).send("# PowerShell installer not found");
    }
});

/**
 * Download auxiliary Windows PowerShell probe scripts
 */
router.get("/api/probe/download/windows/:file", (request, response) => {
    allowAllOrigin(response);
    const allowedFiles = ["configure.ps1", "start.ps1", "stop.ps1", "uninstall.ps1", "health-check.ps1", "update.ps1"];
    const file = request.params.file;
    if (!allowedFiles.includes(file)) {
        return response.status(404).send("# Script not found");
    }
    const filePath = path.join(__dirname, "..", "..", "agent", "windows", file);
    if (fs.existsSync(filePath)) {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.setHeader("Content-Disposition", `inline; filename="${file}"`);
        response.send(fs.readFileSync(filePath, "utf8"));
    } else {
        response.status(404).send("# Script not found");
    }
});

/**
 * Download Linux Bash Installer with pre-configured parameters
 */
router.get("/api/probe/download/install.sh", (request, response) => {
    allowAllOrigin(response);
    const shPath = path.join(__dirname, "..", "..", "agent", "linux", "install.sh");
    if (fs.existsSync(shPath)) {
        let content = fs.readFileSync(shPath, "utf8");
        const hostUrl = `${request.protocol}://${request.get("host")}`;
        const probeId = request.query.probeId ? Number(request.query.probeId) : 0;
        const token = request.query.token ? String(request.query.token).replace(/[^a-zA-Z0-9_-]/g, "") : "";

        if (probeId || token) {
            content = content.replace(
                'SERVER="http://127.0.0.1:3001"',
                `SERVER="${hostUrl}"`
            ).replace(
                'PROBE_ID=""',
                `PROBE_ID="${probeId}"`
            ).replace(
                'TOKEN=""',
                `TOKEN="${token}"`
            );
        }

        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.setHeader("Content-Disposition", 'inline; filename="install.sh"');
        response.send(content);
    } else {
        response.status(404).send("# Linux installer not found");
    }
});

/**
 * Download Docker Compose Manifest
 */
router.get("/api/probe/download/docker-compose.yml", (request, response) => {
    allowAllOrigin(response);
    const composePath = path.join(__dirname, "..", "..", "agent", "docker", "docker-compose.yml");
    if (fs.existsSync(composePath)) {
        response.setHeader("Content-Type", "text/yaml; charset=utf-8");
        response.setHeader("Content-Disposition", 'attachment; filename="docker-compose.yml"');
        response.send(fs.readFileSync(composePath, "utf8"));
    } else {
        response.status(404).send("# Docker compose not found");
    }
});

// ==========================================
// InfiniNOC Fiber NOC & GPON REST API
// ==========================================
const Device = require("../model/device");
const DependencyCorrelation = require("../model/dependency-correlation");
const FiberNoc = require("../model/fiber-noc");
const FiberFaultEngine = require("../model/fiber-fault-engine");
const FiberInfrastructure = require("../model/fiber-infrastructure");

router.get("/api/fiber-noc/overview", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const overview = await FiberNoc.getFiberNocOverview(orgId);
        response.json({ ok: true, overview });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/fiber-noc/faults", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const faults = await FiberFaultEngine.getActiveFiberFaults(orgId);
        response.json({ ok: true, faults });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/fiber-noc/pon-ports", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const oltDeviceId = request.query.oltDeviceId ? Number(request.query.oltDeviceId) : null;
        const ports = await FiberNoc.getPonPortList(orgId, oltDeviceId);
        response.json({ ok: true, ports });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/fiber-noc/onus", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const filters = {
            olt_device_id: request.query.oltDeviceId,
            pon_port: request.query.ponPort,
            status: request.query.status,
            search: request.query.search,
        };
        const onus = await FiberNoc.getOnuList(orgId, filters);
        response.json({ ok: true, onus });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// FTTH Physical Infrastructure Endpoints
router.get("/api/ftth/splitters", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const splitters = await FiberInfrastructure.getSplitters(orgId, request.query || {});
        response.json({ ok: true, splitters });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/ftth/cables", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const cables = await FiberInfrastructure.getCables(orgId, request.query || {});
        response.json({ ok: true, cables });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/ftth/closures", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const closures = await FiberInfrastructure.getClosures(orgId);
        response.json({ ok: true, closures });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

router.get("/api/ftth/loss-budget", async (request, response) => {
    allowAllOrigin(response);
    try {
        const calculation = FiberInfrastructure.calculateOpticalLossBudget(request.query || {});
        response.json({ ok: true, calculation });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// GET /api/topology/snapshot - Centralized authoritative topology snapshot
router.get("/api/topology/snapshot", async (request, response) => {
    allowAllOrigin(response);
    try {
        const orgId = Number(request.query.organizationId) || 1;
        const devices = await Device.getDeviceList(orgId);
        const links = await DependencyCorrelation.getAllDependencies(orgId);
        const splitters = await FiberInfrastructure.getSplitters(orgId);
        const cables = await FiberInfrastructure.getCables(orgId);
        const closures = await FiberInfrastructure.getClosures(orgId);
        const faults = await FiberFaultEngine.getActiveFiberFaults(orgId);
        const probes = await Probe.getProbeList(orgId);

        const onlineCount = devices.filter((d) => d.status === "UP").length;
        const downCount = devices.filter((d) => d.status === "DOWN").length;
        const warningCount = devices.filter((d) => d.status === "WARNING" || d.status === "PENDING").length;
        const maintCount = devices.filter((d) => d.status === "MAINTENANCE" || d.status === "PAUSED").length;
        const unknownCount = devices.filter((d) => !["UP", "DOWN", "WARNING", "PENDING", "MAINTENANCE", "PAUSED"].includes(d.status)).length;

        const downLinksCount = links.filter((l) => {
            const p = devices.find((d) => d.id === l.parent_device_id);
            const c = devices.find((d) => d.id === l.child_device_id);
            return (p && p.status === "DOWN") || (c && c.status === "DOWN") || l.status === "down";
        }).length;

        const { toSqlDatetime } = require("../util-server");

        response.json({
            ok: true,
            devices,
            links,
            splitters,
            cables,
            closures,
            faults,
            probes,
            summary: {
                totalNodes: devices.length,
                online: onlineCount,
                down: downCount,
                warning: warningCount,
                maintenance: maintCount,
                unknown: unknownCount,
                totalLinks: links.length,
                downLinks: downLinksCount,
                activeFaults: faults.length,
                onlineProbes: probes.filter((p) => p.status === "online").length,
                offlineProbes: probes.filter((p) => p.status === "offline").length,
            },
            timestamp: toSqlDatetime(),
        });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// --- DIAGNOSTIC TOOLS REST APIS ---

// Get all diagnostic tools & categories
router.get("/api/diagnostics/tools", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const { ToolRegistry } = require("../tools/tool-registry");
        response.json({
            ok: true,
            categories: ToolRegistry.getCategories(),
            tools: ToolRegistry.getTools(),
        });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// Execute a diagnostic tool
router.post("/api/diagnostics/execute", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const { slug, params } = request.body || {};
        if (!slug) {
            return response.status(400).json({ ok: false, msg: "Tool slug is required." });
        }
        const { ToolService } = require("../tools/tool-service");
        const orgId = request.organizationID || request.body.organizationId || 1;
        const userId = request.userID || request.body.userId || null;

        const result = await ToolService.execute(slug, params || {}, { organizationId: orgId, userId });
        response.json({ ok: true, result });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// Query diagnostic execution history
router.get("/api/diagnostics/history", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const { DiagnosticHistory } = require("../model/diagnostic-history");
        const orgId = request.organizationID || request.query.organizationId || 1;
        const records = await DiagnosticHistory.getHistory({
            organizationId: orgId,
            toolId: request.query.toolId,
            category: request.query.category,
            target: request.query.target,
            status: request.query.status,
            limit: request.query.limit || 50,
        });
        response.json({ ok: true, records });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// Clear diagnostic execution history
router.delete("/api/diagnostics/history", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const { DiagnosticHistory } = require("../model/diagnostic-history");
        const orgId = request.organizationID || request.query.organizationId || 1;
        const success = await DiagnosticHistory.clearHistory({
            organizationId: orgId,
            toolId: request.query.toolId,
        });
        response.json({ ok: success });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

// Monitor execution diagnostics endpoint (Section 9)
router.get("/api/monitor/:id/diagnostics", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const monitorId = parseInt(request.params.id, 10);
        if (isNaN(monitorId)) {
            return response.status(400).json({ ok: false, msg: "Invalid monitor ID." });
        }
        const orgId = request.organizationID || (request.query.organizationId ? parseInt(request.query.organizationId, 10) : 1);
        const diag = await Monitor.getDiagnostics(monitorId, orgId);
        response.json({ ok: true, diagnostics: diag });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
// Authoritative NOC unified aggregation endpoint (Priority 7)
router.get("/api/noc/stats", async (request, response) => {
    try {
        allowDevAllOrigin(response);
        const orgId = request.organizationID || (request.query.organizationId ? parseInt(request.query.organizationId, 10) : 1);
        const stats = await Monitor.getNocAggregatedStats(orgId);
        response.json({ ok: true, stats });
    } catch (error) {
        response.status(400).json({ ok: false, msg: error.message });
    }
});

module.exports = router;
