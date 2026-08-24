const productConfig = require("../config/product");
console.log(`Welcome to ${productConfig.productName} by ${productConfig.companyName}`);
console.log(`Tagline: ${productConfig.tagline}`);

// As the log function need to use dayjs, it should be very top
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("./modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

// Load environment variables from `.env`
require("dotenv").config();

// Check Node.js Version
const nodeVersion = process.versions.node;

// Get the required Node.js version from package.json
const requiredNodeVersions = require("../package.json").engines.node;
const bannedNodeVersions = " < 18 || 20.0.* || 20.1.* || 20.2.* || 20.3.* ";
console.log(`Your Node.js version: ${nodeVersion}`);

const semver = require("semver");
const requiredNodeVersionsComma = requiredNodeVersions
    .split("||")
    .map((version) => version.trim())
    .join(", ");

// Exit Uptime Kuma immediately if the Node.js version is banned
if (semver.satisfies(nodeVersion, bannedNodeVersions)) {
    console.error(
        "\x1b[31m%s\x1b[0m",
        `Error: Your Node.js version: ${nodeVersion} is not supported, please upgrade your Node.js to ${requiredNodeVersionsComma}.`
    );
    process.exit(-1);
}

// Warning if the Node.js version is not in the support list, but it maybe still works
if (!semver.satisfies(nodeVersion, requiredNodeVersions)) {
    console.warn(
        "\x1b[31m%s\x1b[0m",
        `Warning: Your Node.js version: ${nodeVersion} is not officially supported, please upgrade your Node.js to ${requiredNodeVersionsComma}.`
    );
}

const args = require("args-parser")(process.argv);
const { sleep, log, getRandomInt, genSecret, isDev } = require("../src/util");
const config = require("./config");
const { RBAC } = require("./middleware/rbac");
const SuperAdmin = require("./model/super-admin");

process.title = "uptime-kuma";

log.debug("server", "Arguments");
log.debug("server", args);

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

if (!process.env.UPTIME_KUMA_WS_ORIGIN_CHECK) {
    process.env.UPTIME_KUMA_WS_ORIGIN_CHECK = "cors-like";
}

log.info("server", "Env: " + process.env.NODE_ENV);
log.debug("server", "Inside Container: " + (process.env.UPTIME_KUMA_IS_CONTAINER === "1"));

if (process.env.UPTIME_KUMA_WS_ORIGIN_CHECK === "bypass") {
    log.warn("server", "WebSocket Origin Check: " + process.env.UPTIME_KUMA_WS_ORIGIN_CHECK);
}

if (isDev || process.env.UPTIME_KUMA_DEBUG_INSPECTOR === "1") {
    const inspector = require("inspector");
    let inspectorHost = "127.0.0.1";

    log.warn("server", "Node.js Inspector is enabled. You can connect to it via Chrome DevTools or VSCode.");
    log.warn("server", "Node.js Inspector is listening on:", inspector.url());

    if (process.env.UPTIME_KUMA_IS_CONTAINER === "1") {
        log.warn(
            "server",
            "You need to expose the port 9229:9229 in your docker command or docker compose, and ssh tunneling in order to connect to it."
        );
        inspectorHost = "0.0.0.0";
    }

    inspector.open(9229, inspectorHost);
}

const checkVersion = require("./check-version");
log.info("server", "Uptime Kuma Version:", checkVersion.version);

log.info("server", "Loading modules");

log.debug("server", "Importing express");
const express = require("express");
const expressStaticGzip = require("express-static-gzip");
log.debug("server", "Importing redbean-node");
const { R } = require("redbean-node");
log.debug("server", "Importing jsonwebtoken");
const jwt = require("jsonwebtoken");
log.debug("server", "Importing http-graceful-shutdown");
const gracefulShutdown = require("http-graceful-shutdown");
log.debug("server", "Importing prometheus-api-metrics");
const prometheusAPIMetrics = require("prometheus-api-metrics");
const { passwordStrength } = require("check-password-strength");
const TranslatableError = require("./translatable-error");

log.debug("server", "Importing 2FA Modules");
const notp = require("notp");
const base32 = require("thirty-two");

const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = (module.exports.io = server.io);
const app = server.app;

log.debug("server", "Importing Organization, Site, Device & Probe models");
const Organization = require("./model/organization");
const Site = require("./model/site");
const Device = require("./model/device");
const Probe = require("./model/probe");
const SnmpMonitoring = require("./model/snmp-monitoring");
const AlertEngine = require("./model/alert-engine");
const Incident = require("./model/incident");
const DependencyCorrelation = require("./model/dependency-correlation");
const VendorCapabilityRegistry = require("./model/vendor-capability-registry");
const OltMonitoring = require("./model/olt-monitoring");
const OltAdapterRegistry = require("./model/olt-adapter-registry");
const NotificationRouter = require("./model/notification-router");
const SlaReporting = require("./model/sla-reporting");
const OrganizationBranding = require("./model/organization-branding");
const SaasSubscription = require("./model/saas-subscription");
const RazorpayBilling = require("./model/razorpay-billing");
const Monitor = require("./model/monitor");
const User = require("./model/user");

log.debug("server", "Importing Settings");
const {
    getSettings,
    setSettings,
    setting,
    initJWTSecret,
    checkLogin,
    doubleCheckPassword,
    shake256,
    SHAKE256_LENGTH,
    allowDevAllOrigin,
    printServerUrls,
} = require("./util-server");

log.debug("server", "Importing Notification");
const { Notification } = require("./notification");
Notification.init();
log.debug("server", "Importing Web-Push");
const webpush = require("web-push");

log.debug("server", "Importing Database");
const Database = require("./database");

log.debug("server", "Importing Background Jobs");
const { initBackgroundJobs, stopBackgroundJobs } = require("./jobs");
const { loginRateLimiter, twoFaRateLimiter } = require("./rate-limiter");

const { apiAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const { Prometheus } = require("./prometheus");
const { UptimeCalculator } = require("./uptime-calculator");

const hostname = config.hostname;

if (hostname) {
    log.info("server", "Custom hostname: " + hostname);
}

const port = config.port;

const disableFrameSameOrigin =
    !!process.env.UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN || args["disable-frame-sameorigin"] || false;
const cloudflaredToken = args["cloudflared-token"] || process.env.UPTIME_KUMA_CLOUDFLARED_TOKEN || undefined;

// 2FA / notp verification defaults
const twoFAVerifyOptions = {
    window: 1,
    time: 30,
};

/**
 * Run unit test after the server is ready
 * @type {boolean}
 */
const testMode = !!args["test"] || false;

// Must be after io instantiation
const {
    sendNotificationList,
    sendHeartbeatList,
    sendInfo,
    sendProxyList,
    sendDockerHostList,
    sendAPIKeyList,
    sendRemoteBrowserList,
    sendMonitorTypeList,
} = require("./client");
const { statusPageSocketHandler } = require("./socket-handlers/status-page-socket-handler");
const { databaseSocketHandler } = require("./socket-handlers/database-socket-handler");
const { backupSocketHandler } = require("./socket-handlers/backup-socket-handler");
const { toolsSocketHandler } = require("./socket-handlers/tools-socket-handler");
const { updateSocketHandler } = require("./socket-handlers/update-socket-handler");
const { remoteBrowserSocketHandler } = require("./socket-handlers/remote-browser-socket-handler");
const TwoFA = require("./2fa");
const StatusPage = require("./model/status_page");
const {
    cloudflaredSocketHandler,
    autoStart: cloudflaredAutoStart,
    stop: cloudflaredStop,
} = require("./socket-handlers/cloudflared-socket-handler");
const { proxySocketHandler } = require("./socket-handlers/proxy-socket-handler");
const { dockerSocketHandler } = require("./socket-handlers/docker-socket-handler");
const { maintenanceSocketHandler } = require("./socket-handlers/maintenance-socket-handler");
const { apiKeySocketHandler } = require("./socket-handlers/api-key-socket-handler");
const { generalSocketHandler } = require("./socket-handlers/general-socket-handler");
const { Settings } = require("./settings");
const apicache = require("./modules/apicache");
const { resetChrome } = require("./monitor-types/real-browser-monitor-type");
const { EmbeddedMariaDB } = require("./embedded-mariadb");
const { SetupDatabase } = require("./setup-database");
const { chartSocketHandler } = require("./socket-handlers/chart-socket-handler");

app.use(express.json());

// Global Middleware
app.use(function (req, res, next) {
    if (!disableFrameSameOrigin) {
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    res.removeHeader("X-Powered-By");
    next();
});

/**
 * Show Setup Page
 * @type {boolean}
 */
let needSetup = false;

(async () => {
    // Create a data directory
    Database.initDataDir(args);

    // Check if is chosen a database type
    let setupDatabase = new SetupDatabase(args, server);
    if (setupDatabase.isNeedSetup()) {
        // Hold here and start a special setup page until user choose a database type
        await setupDatabase.start(hostname, port);
    }

    // Connect to database
    try {
        await initDatabase(testMode);
    } catch (e) {
        log.error("server", "Failed to prepare your database: " + e.message);
        process.exit(1);
    }

    // Database should be ready now
    await server.initAfterDatabaseReady();

    // Auto-grant Super Admin privileges to User #1 (First User)
    try {
        await R.exec("UPDATE user SET is_super_admin = 1 WHERE id = 1");
    } catch (e) {
        log.error("server", "Failed to auto-grant Super Admin to User #1: " + e.message);
    }

    server.entryPage = await Settings.get("entryPage");
    await StatusPage.loadDomainMappingList();

    log.debug("server", "Initializing Prometheus");
    await Prometheus.init();

    log.debug("server", "Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Entry Page
    app.get("/", async (request, response) => {
        let hostname = request.hostname;
        if (await setting("trustProxy")) {
            const proxy = request.headers["x-forwarded-host"];
            if (proxy) {
                hostname = proxy;
            }
        }

        log.debug("entry", `Request Domain: ${hostname}`);

        const uptimeKumaEntryPage = server.entryPage;
        if (hostname in StatusPage.domainMappingList) {
            log.debug("entry", "This is a status page domain");

            let slug = StatusPage.domainMappingList[hostname];
            await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);
        } else if (uptimeKumaEntryPage && uptimeKumaEntryPage.startsWith("statusPage-")) {
            response.redirect("/status/" + uptimeKumaEntryPage.replace("statusPage-", ""));
        } else {
            response.redirect("/dashboard");
        }
    });

    app.get("/setup-database-info", (request, response) => {
        allowDevAllOrigin(response);
        response.json({
            runningSetup: false,
            needSetup: false,
        });
    });

    if (isDev) {
        app.use(express.urlencoded({ extended: true }));
        app.post("/test-webhook", async (request, response) => {
            log.debug("test", request.headers);
            log.debug("test", request.body);
            response.send("OK");
        });

        app.post("/test-x-www-form-urlencoded", async (request, response) => {
            log.debug("test", request.headers);
            log.debug("test", request.body);
            response.send("OK");
        });

        const fs = require("fs");

        app.get("/_e2e/take-sqlite-snapshot", async (request, response) => {
            await Database.close();
            try {
                fs.cpSync(Database.sqlitePath, `${Database.sqlitePath}.e2e-snapshot`);
            } catch (err) {
                throw new Error("Unable to copy SQLite DB.");
            }
            await Database.connect();

            response.send("Snapshot taken.");
        });

        app.get("/_e2e/restore-sqlite-snapshot", async (request, response) => {
            if (!fs.existsSync(`${Database.sqlitePath}.e2e-snapshot`)) {
                throw new Error("Snapshot doesn't exist.");
            }

            await Database.close();
            try {
                fs.cpSync(`${Database.sqlitePath}.e2e-snapshot`, Database.sqlitePath);
            } catch (err) {
                throw new Error("Unable to copy snapshot file.");
            }
            await Database.connect();

            response.send("Snapshot restored.");
        });
    }

    // Robots.txt
    app.get("/robots.txt", async (_request, response) => {
        let txt = "User-agent: *\nDisallow:";
        if (!(await setting("searchEngineIndex"))) {
            txt += " /";
        }
        response.setHeader("Content-Type", "text/plain");
        response.send(txt);
    });

    // Basic Auth Router here

    // Prometheus API metrics  /metrics
    // With Basic Auth using the first user's username/password
    app.get("/metrics", apiAuth, prometheusAPIMetrics());

    app.use(
        "/",
        expressStaticGzip("dist", {
            enableBrotli: true,
        })
    );

    // ./data/upload
    app.use("/upload", express.static(Database.uploadDir));

    app.get("/.well-known/change-password", async (_, response) => {
        response.redirect("https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI");
    });

    // API Router
    const apiRouter = require("./routers/api-router");
    app.use(apiRouter);

    // Status Page Router
    const statusPageRouter = require("./routers/status-page-router");
    app.use(statusPageRouter);

    // Universal Route Handler, must be at the end of all express routes.
    app.get("*", async (_request, response) => {
        if (_request.originalUrl.startsWith("/upload/") || _request.originalUrl.startsWith("/assets/")) {
            response.status(404).send("File not found.");
        } else {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.send(server.indexHTML);
        }
    });

    log.debug("server", "Adding socket handler");
    io.on("connection", async (socket) => {
        await sendInfo(socket, true);

        if (needSetup) {
            log.info("server", "Redirect to setup page");
            socket.emit("setup");
        }

        toolsSocketHandler(socket);

        // ***************************
        // Public Socket API
        // ***************************

        socket.on("loginByToken", async (token, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by token. IP=${clientIP}`);

            try {
                let decoded = jwt.verify(token, server.jwtSecret);

                log.info("auth", "Username from JWT: " + decoded.username);

                let user = await R.findOne("user", " username = ? AND active = 1 ", [decoded.username]);

                if (user) {
                    // Check if the password changed
                    if (decoded.h !== shake256(user.password, SHAKE256_LENGTH)) {
                        throw new Error("The token is invalid due to password change or old token");
                    }

                    log.debug("auth", "afterLogin");
                    await afterLogin(socket, user);
                    log.debug("auth", "afterLogin ok");

                    log.info("auth", `Successfully logged in user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                    });
                } else {
                    log.info("auth", `Inactive or deleted user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: false,
                        msg: "authUserInactiveOrDeleted",
                        msgi18n: true,
                    });
                }
            } catch (error) {
                log.error("auth", `Invalid token. IP=${clientIP}`);
                if (error.message) {
                    log.error("auth", error.message, `IP=${clientIP}`);
                }
                callback({
                    ok: false,
                    msg: "authInvalidToken",
                    msgi18n: true,
                });
            }
        });

        socket.on("login", async (data, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by username + password. IP=${clientIP}`);

            // Checking
            if (typeof callback !== "function") {
                return;
            }

            if (!data) {
                return;
            }

            // Login Rate Limit
            if (!(await loginRateLimiter.pass(callback))) {
                log.info("auth", `Too many failed requests for user ${data.username}. IP=${clientIP}`);
                return;
            }

            let user = await login(data.username, data.password);

            if (user) {
                if (user.twofa_status === 0) {
                    await afterLogin(socket, user);

                    log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                        token: User.createJWT(user, server.jwtSecret),
                    });
                }

                if (user.twofa_status === 1 && !data.token) {
                    log.info("auth", `2FA token required for user ${data.username}. IP=${clientIP}`);

                    callback({
                        tokenRequired: true,
                    });
                }

                if (data.token) {
                    let verify = notp.totp.verify(data.token, user.twofa_secret, twoFAVerifyOptions);

                    if (user.twofa_last_token !== data.token && verify) {
                        await afterLogin(socket, user);

                        await R.exec("UPDATE `user` SET twofa_last_token = ? WHERE id = ? ", [
                            data.token,
                            socket.userID,
                        ]);

                        log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: true,
                            token: User.createJWT(user, server.jwtSecret),
                        });
                    } else {
                        log.warn("auth", `Invalid token provided for user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: false,
                            msg: "authInvalidToken",
                            msgi18n: true,
                        });
                    }
                }
            } else {
                log.warn("auth", `Incorrect username or password for user ${data.username}. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: "authIncorrectCreds",
                    msgi18n: true,
                });
            }
        });

        socket.on("logout", async (callback) => {
            // Rate Limit
            if (!(await loginRateLimiter.pass(callback))) {
                return;
            }

            socket.leave(socket.userID);
            socket.userID = null;

            if (typeof callback === "function") {
                callback();
            }
        });

        socket.on("prepare2FA", async (currentPassword, callback) => {
            try {
                if (!(await twoFaRateLimiter.pass(callback))) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [socket.userID]);

                if (user.twofa_status === 0) {
                    let newSecret = genSecret();
                    let encodedSecret = base32.encode(newSecret);

                    // Google authenticator doesn't like equal signs
                    // The fix is found at https://github.com/guyht/notp
                    // Related issue: https://github.com/louislam/uptime-kuma/issues/486
                    encodedSecret = encodedSecret.toString().replace(/=/g, "");

                    let uri = `otpauth://totp/Uptime%20Kuma:${user.username}?secret=${encodedSecret}`;

                    await R.exec("UPDATE `user` SET twofa_secret = ? WHERE id = ? ", [newSecret, socket.userID]);

                    callback({
                        ok: true,
                        uri: uri,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "2faAlreadyEnabled",
                        msgi18n: true,
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("save2FA", async (currentPassword, callback) => {
            const clientIP = await server.getClientIP(socket);

            try {
                if (!(await twoFaRateLimiter.pass(callback))) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [socket.userID]);

                log.info("auth", `Saved 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2faEnabled",
                    msgi18n: true,
                });
            } catch (error) {
                log.error("auth", `Error changing 2FA token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("disable2FA", async (currentPassword, callback) => {
            const clientIP = await server.getClientIP(socket);

            try {
                if (!(await twoFaRateLimiter.pass(callback))) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);
                await TwoFA.disable2FA(socket.userID);

                log.info("auth", `Disabled 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2faDisabled",
                    msgi18n: true,
                });
            } catch (error) {
                log.error("auth", `Error disabling 2FA token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("verifyToken", async (token, currentPassword, callback) => {
            try {
                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [socket.userID]);

                let verify = notp.totp.verify(token, user.twofa_secret, twoFAVerifyOptions);

                if (user.twofa_last_token !== token && verify) {
                    callback({
                        ok: true,
                        valid: true,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "authInvalidToken",
                        msgi18n: true,
                        valid: false,
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("twoFAStatus", async (callback) => {
            try {
                checkLogin(socket);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [socket.userID]);

                if (user.twofa_status === 1) {
                    callback({
                        ok: true,
                        status: true,
                    });
                } else {
                    callback({
                        ok: true,
                        status: false,
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("needSetup", async (callback) => {
            callback(needSetup);
        });

        socket.on("setup", async (username, password, callback) => {
            try {
                if (passwordStrength(password).value === "Too weak") {
                    throw new TranslatableError("passwordTooWeak");
                }

                if ((await R.knex("user").count("id as count").first()).count !== 0) {
                    throw new Error(
                        "Uptime Kuma has been initialized. If you want to run setup again, please delete the database."
                    );
                }

                let user = R.dispense("user");
                user.username = username;
                user.password = await passwordHash.generate(password);
                await R.store(user);

                needSetup = false;

                callback({
                    ok: true,
                    msg: "successAdded",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                    msgi18n: !!e.msgi18n,
                });
            }
        });

        // ***************************
        // Auth Only API
        // ***************************

        // Add a new monitor
        socket.on("add", async (monitor, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "monitor.create");

                // Enforce SaaS Quota Limit for Monitors
                const org = await R.getRow("SELECT max_monitors, plan FROM organization WHERE id = ?", [ activeOrgId ]);
                const currentMonitors = await R.getCell("SELECT COUNT(*) FROM monitor WHERE organization_id = ?", [ activeOrgId ]) || 0;
                const maxMonitors = org ? (org.max_monitors || 10) : 10;
                if (currentMonitors >= maxMonitors) {
                    throw new Error(`SaaS Quota Limit Reached: Your current ${org?.plan ? org.plan.toUpperCase() : 'STARTER'} plan limit of ${maxMonitors} monitors has been reached. Please upgrade your subscription on the Billing page.`);
                }

                let bean = R.dispense("monitor");

                let notificationIDList = monitor.notificationIDList;
                delete monitor.notificationIDList;

                // Ensure status code ranges are strings
                if (!monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                    throw new Error("Accepted status codes are not all strings");
                }
                monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                delete monitor.accepted_statuscodes;

                monitor.kafkaProducerBrokers = JSON.stringify(monitor.kafkaProducerBrokers);
                monitor.kafkaProducerSaslOptions = JSON.stringify(monitor.kafkaProducerSaslOptions);

                monitor.conditions = JSON.stringify(monitor.conditions);

                monitor.rabbitmqNodes = JSON.stringify(monitor.rabbitmqNodes);

                /*
                 * List of frontend-only properties that should not be saved to the database.
                 * Should clean up before saving to the database.
                 */
                const frontendOnlyProperties = [
                    "humanReadableInterval",
                    "globalpingdnsresolvetypeoptions",
                    "responsecheck",
                ];
                for (const prop of frontendOnlyProperties) {
                    if (prop in monitor) {
                        delete monitor[prop];
                    }
                }

                bean.import(monitor);
                // Map camelCase frontend property to snake_case database column
                if (monitor.retryOnlyOnStatusCodeFailure !== undefined) {
                    bean.retry_only_on_status_code_failure = monitor.retryOnlyOnStatusCodeFailure;
                }
                bean.user_id = socket.userID;
                bean.organization_id = socket.activeOrganizationId || 1;

                bean.validate();

                await R.store(bean);

                await updateMonitorNotification(bean.id, notificationIDList);

                await server.sendUpdateMonitorIntoList(socket, bean.id);

                if (monitor.active !== false) {
                    await startMonitor(socket.userID, bean.id);
                }

                log.info("monitor", `Added Monitor: ${bean.id} User ID: ${socket.userID}`);

                callback({
                    ok: true,
                    msg: "successAdded",
                    msgi18n: true,
                    monitorID: bean.id,
                });
            } catch (e) {
                log.error("monitor", `Error adding Monitor: ${monitor.id} User ID: ${socket.userID}`);

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Edit a monitor
        socket.on("editMonitor", async (monitor, callback) => {
            try {
                let removeGroupChildren = false;
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [monitor.id]);

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.");
                }

                // Check if Parent is Descendant (would cause endless loop)
                if (monitor.parent !== null) {
                    const childIDs = await Monitor.getAllChildrenIDs(monitor.id);
                    if (childIDs.includes(monitor.parent)) {
                        throw new Error("Invalid Monitor Group");
                    }
                }

                // Remove children if monitor type has changed (from group to non-group)
                if (bean.type === "group" && monitor.type !== bean.type) {
                    removeGroupChildren = true;
                }

                // Ensure status code ranges are strings
                if (!monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                    throw new Error("Accepted status codes are not all strings");
                }

                bean.name = monitor.name;
                bean.description = monitor.description;
                bean.parent = monitor.parent;
                bean.type = monitor.type;
                bean.subtype = monitor.subtype;
                bean.url = monitor.url;
                bean.wsIgnoreSecWebsocketAcceptHeader = monitor.wsIgnoreSecWebsocketAcceptHeader;
                bean.wsSubprotocol = monitor.wsSubprotocol;
                bean.method = monitor.method;
                bean.body = monitor.body;
                bean.ipFamily = monitor.ipFamily;
                bean.headers = monitor.headers;
                bean.basic_auth_user = monitor.basic_auth_user;
                bean.basic_auth_pass = monitor.basic_auth_pass;
                bean.bearer_token = monitor.bearer_token;
                bean.timeout = monitor.timeout;
                bean.oauth_client_id = monitor.oauth_client_id;
                bean.oauth_client_secret = monitor.oauth_client_secret;
                bean.oauth_auth_method = monitor.oauth_auth_method;
                bean.oauth_token_url = monitor.oauth_token_url;
                bean.oauth_scopes = monitor.oauth_scopes;
                bean.oauth_audience = monitor.oauth_audience;
                bean.tlsCa = monitor.tlsCa;
                bean.tlsCert = monitor.tlsCert;
                bean.tlsKey = monitor.tlsKey;
                bean.interval = monitor.interval;
                bean.retryInterval = monitor.retryInterval;
                bean.resendInterval = monitor.resendInterval;
                bean.hostname = monitor.hostname;
                bean.game = monitor.game;
                bean.maxretries = monitor.maxretries;
                bean.port = parseInt(monitor.port);
                bean.location = monitor.location;
                bean.protocol = monitor.protocol;

                if (isNaN(bean.port)) {
                    bean.port = null;
                }

                bean.keyword = monitor.keyword;
                bean.invertKeyword = monitor.invertKeyword;
                bean.ignoreTls = monitor.ignoreTls;
                bean.expiryNotification = monitor.expiryNotification;
                bean.domainExpiryNotification = monitor.domainExpiryNotification;
                bean.upsideDown = monitor.upsideDown;
                bean.packetSize = monitor.packetSize;
                bean.maxredirects = monitor.maxredirects;
                bean.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                bean.save_response = monitor.saveResponse;
                bean.save_error_response = monitor.saveErrorResponse;
                bean.response_max_length = monitor.responseMaxLength;
                bean.dns_resolve_type = monitor.dns_resolve_type;
                bean.dns_resolve_server = monitor.dns_resolve_server;
                bean.pushToken = monitor.pushToken;
                bean.docker_container = monitor.docker_container;
                bean.docker_host = monitor.docker_host;
                bean.proxyId = Number.isInteger(monitor.proxyId) ? monitor.proxyId : null;
                bean.mqttUsername = monitor.mqttUsername;
                bean.mqttPassword = monitor.mqttPassword;
                bean.mqttTopic = monitor.mqttTopic;
                bean.mqttSuccessMessage = monitor.mqttSuccessMessage;
                bean.mqttCheckType = monitor.mqttCheckType;
                bean.mqttWebsocketPath = monitor.mqttWebsocketPath;
                bean.databaseConnectionString = monitor.databaseConnectionString;
                bean.databaseQuery = monitor.databaseQuery;
                bean.authMethod = monitor.authMethod;
                bean.authWorkstation = monitor.authWorkstation;
                bean.authDomain = monitor.authDomain;
                bean.grpcUrl = monitor.grpcUrl;
                bean.grpcProtobuf = monitor.grpcProtobuf;
                bean.grpcServiceName = monitor.grpcServiceName;
                bean.grpcMethod = monitor.grpcMethod;
                bean.grpcBody = monitor.grpcBody;
                bean.grpcMetadata = monitor.grpcMetadata;
                bean.grpcEnableTls = monitor.grpcEnableTls;
                bean.radiusUsername = monitor.radiusUsername;
                bean.radiusPassword = monitor.radiusPassword;
                bean.radiusCalledStationId = monitor.radiusCalledStationId;
                bean.radiusCallingStationId = monitor.radiusCallingStationId;
                bean.radiusSecret = monitor.radiusSecret;
                bean.httpBodyEncoding = monitor.httpBodyEncoding;
                bean.expectedValue = monitor.expectedValue;
                bean.jsonPath = monitor.jsonPath;
                bean.kafkaProducerTopic = monitor.kafkaProducerTopic;
                bean.kafkaProducerBrokers = JSON.stringify(monitor.kafkaProducerBrokers);
                bean.kafkaProducerAllowAutoTopicCreation = monitor.kafkaProducerAllowAutoTopicCreation;
                bean.kafkaProducerSaslOptions = JSON.stringify(monitor.kafkaProducerSaslOptions);
                bean.kafkaProducerMessage = monitor.kafkaProducerMessage;
                bean.cacheBust = monitor.cacheBust;
                bean.kafkaProducerSsl = monitor.kafkaProducerSsl;
                bean.kafkaProducerAllowAutoTopicCreation = monitor.kafkaProducerAllowAutoTopicCreation;
                bean.gamedigGivenPortOnly = monitor.gamedigGivenPortOnly;
                bean.gamedigToken = monitor.gamedigToken;
                bean.remote_browser = monitor.remote_browser;
                bean.screenshot_delay = monitor.screenshot_delay;
                bean.smtpSecurity = monitor.smtpSecurity;
                bean.snmpVersion = monitor.snmpVersion;
                bean.snmpOid = monitor.snmpOid;
                bean.jsonPathOperator = monitor.jsonPathOperator;
                bean.retry_only_on_status_code_failure = Boolean(monitor.retryOnlyOnStatusCodeFailure);
                bean.timeout = monitor.timeout;
                bean.rabbitmqNodes = JSON.stringify(monitor.rabbitmqNodes);
                bean.rabbitmqUsername = monitor.rabbitmqUsername;
                bean.rabbitmqPassword = monitor.rabbitmqPassword;
                bean.conditions = JSON.stringify(monitor.conditions);
                bean.manual_status = monitor.manual_status;
                bean.system_service_name = monitor.system_service_name;
                bean.expected_tls_alert = monitor.expectedTlsAlert;
                bean.ntp_stratum_threshold = monitor.ntpStratumThreshold;
                bean.ntp_time_offset_threshold = monitor.ntpTimeOffsetThreshold;
                bean.ntp_root_dispersion_threshold = monitor.ntpRootDispersionThreshold;

                // ping advanced options
                bean.ping_numeric = monitor.ping_numeric;
                bean.ping_count = monitor.ping_count;
                bean.ping_per_request_timeout = monitor.ping_per_request_timeout;

                bean.validate();

                await R.store(bean);

                if (removeGroupChildren) {
                    await Monitor.unlinkAllChildren(monitor.id);
                }

                await updateMonitorNotification(bean.id, monitor.notificationIDList);

                if (await Monitor.isActive(bean.id, bean.active)) {
                    await restartMonitor(socket.userID, bean.id);
                }

                await server.sendUpdateMonitorIntoList(socket, bean.id);

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
                    monitorID: bean.id,
                });
            } catch (e) {
                log.error("monitor", e);
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitorList", async (callback) => {
            try {
                checkLogin(socket);
                await server.sendMonitorList(socket);
                callback({
                    ok: true,
                });
            } catch (e) {
                log.error("monitor", e);
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                log.info("monitor", `Get Monitor: ${monitorID} User ID: ${socket.userID}`);

                let monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, socket.userID]);
                const monitorData = [{ id: monitor.id, active: monitor.active }];
                const preloadData = await Monitor.preparePreloadData(monitorData);
                callback({
                    ok: true,
                    monitor: monitor.toJSON(preloadData),
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // partial { type, url, hostname, grpcUrl }
        socket.on("checkDomain", async (partial, callback) => {
            try {
                checkLogin(socket);
                const DomainExpiry = require("./model/domain_expiry");
                const supportInfo = await DomainExpiry.checkSupport(partial);
                callback({
                    ok: true,
                    domain: supportInfo.domain,
                    tld: supportInfo.tld,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                    msgi18n: !!e.msgi18n,
                    meta: e.meta ?? {},
                });
            }
        });

        socket.on("getMonitorBeats", async (monitorID, period, callback) => {
            try {
                checkLogin(socket);

                log.info("monitor", `Get Monitor Beats: ${monitorID} User ID: ${socket.userID}`);

                if (period == null) {
                    throw new Error("Invalid period.");
                }

                const sqlHourOffset = Database.sqlHourOffset();

                let list = await R.getAll(
                    `
                    SELECT *
                    FROM heartbeat
                    WHERE monitor_id = ?
                      AND time > ${sqlHourOffset}
                    ORDER BY time ASC
                `,
                    [monitorID, -period]
                );

                callback({
                    ok: true,
                    data: list,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Start or Resume the monitor
        socket.on("resumeMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket);
                await startMonitor(socket.userID, monitorID);
                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successResumed",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("pauseMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket);
                await pauseMonitor(socket.userID, monitorID);
                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successPaused",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteMonitor", async (monitorID, deleteChildren, callback) => {
            try {
                // Backward compatibility: if deleteChildren is omitted, the second parameter is the callback
                if (typeof deleteChildren === "function") {
                    callback = deleteChildren;
                    deleteChildren = false;
                }

                checkLogin(socket);

                const startTime = Date.now();

                // Check if this is a group monitor
                const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, socket.userID]);

                // Log with context about deletion type
                if (monitor && monitor.type === "group") {
                    if (deleteChildren) {
                        log.info("manage", `Delete Group and Children: ${monitorID} User ID: ${socket.userID}`);
                    } else {
                        log.info("manage", `Delete Group (unlink children): ${monitorID} User ID: ${socket.userID}`);
                    }
                } else {
                    log.info("manage", `Delete Monitor: ${monitorID} User ID: ${socket.userID}`);
                }

                if (monitor && monitor.type === "group") {
                    // Get all children before processing
                    const children = await Monitor.getChildren(monitorID);

                    if (deleteChildren) {
                        // Delete all child monitors recursively
                        if (children && children.length > 0) {
                            for (const child of children) {
                                await Monitor.deleteMonitorRecursively(child.id, socket.userID);
                                await server.sendDeleteMonitorFromList(socket, child.id);
                            }
                        }
                    } else {
                        // Unlink all children from the group (set parent to null)
                        await Monitor.unlinkAllChildren(monitorID);

                        // Notify frontend to update each child monitor's parent to null
                        if (children && children.length > 0) {
                            for (const child of children) {
                                await server.sendUpdateMonitorIntoList(socket, child.id);
                            }
                        }
                    }
                }

                // Delete the monitor itself
                await Monitor.deleteMonitor(monitorID, socket.userID);

                // Fix #2880
                apicache.clear();

                const endTime = Date.now();

                // Log completion with context about children handling
                if (monitor && monitor.type === "group") {
                    if (deleteChildren) {
                        log.info(
                            "DB",
                            `Delete Monitor completed (group and children deleted) in: ${endTime - startTime} ms`
                        );
                    } else {
                        log.info(
                            "DB",
                            `Delete Monitor completed (group deleted, children unlinked) in: ${endTime - startTime} ms`
                        );
                    }
                } else {
                    log.info("DB", `Delete Monitor completed in: ${endTime - startTime} ms`);
                }

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });
                await server.sendDeleteMonitorFromList(socket, monitorID);
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getTags", async (callback) => {
            try {
                checkLogin(socket);

                const list = await R.findAll("tag");

                callback({
                    ok: true,
                    tags: list.map((bean) => bean.toJSON()),
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("addTag", async (tag, callback) => {
            try {
                checkLogin(socket);

                let bean = R.dispense("tag");
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);

                callback({
                    ok: true,
                    tag: await bean.toJSON(),
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("editTag", async (tag, callback) => {
            try {
                checkLogin(socket);

                let bean = await R.findOne("tag", " id = ? ", [tag.id]);
                if (bean == null) {
                    callback({
                        ok: false,
                        msg: "tagNotFound",
                        msgi18n: true,
                    });
                    return;
                }
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
                    tag: await bean.toJSON(),
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteTag", async (tagID, callback) => {
            try {
                checkLogin(socket);

                await R.exec("DELETE FROM tag WHERE id = ? ", [tagID]);

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("addMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket);

                await R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)", [
                    tagID,
                    monitorID,
                    value,
                ]);

                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successAdded",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("editMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket);

                await R.exec("UPDATE monitor_tag SET value = ? WHERE tag_id = ? AND monitor_id = ?", [
                    value,
                    tagID,
                    monitorID,
                ]);

                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successEdited",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket);

                await R.exec("DELETE FROM monitor_tag WHERE tag_id = ? AND monitor_id = ? AND value = ?", [
                    tagID,
                    monitorID,
                    value,
                ]);

                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("monitorImportantHeartbeatListCount", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                let count;
                if (monitorID == null) {
                    count = await R.count("heartbeat", "important = 1");
                } else {
                    count = await R.count("heartbeat", "monitor_id = ? AND important = 1", [monitorID]);
                }

                callback({
                    ok: true,
                    count: count,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("monitorImportantHeartbeatListPaged", async (monitorID, offset, count, callback) => {
            try {
                checkLogin(socket);

                let list;
                if (monitorID == null) {
                    list = await R.find(
                        "heartbeat",
                        `
                        important = 1
                        ORDER BY time DESC
                        LIMIT ?
                        OFFSET ?
                    `,
                        [count, offset]
                    );
                } else {
                    list = await R.find(
                        "heartbeat",
                        `
                        monitor_id = ?
                        AND important = 1
                        ORDER BY time DESC
                        LIMIT ?
                        OFFSET ?
                    `,
                        [monitorID, count, offset]
                    );
                }

                callback({
                    ok: true,
                    data: list,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("changePassword", async (password, callback) => {
            try {
                checkLogin(socket);

                if (!password.newPassword) {
                    throw new Error("Invalid new password");
                }

                if (passwordStrength(password.newPassword).value === "Too weak") {
                    throw new TranslatableError("passwordTooWeak");
                }

                let user = await doubleCheckPassword(socket, password.currentPassword);
                await user.resetPassword(password.newPassword);

                server.disconnectAllSocketClients(user.id, socket.id);

                callback({
                    ok: true,
                    token: User.createJWT(user, server.jwtSecret),
                    msg: "successAuthChangePassword",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                    msgi18n: !!e.msgi18n,
                });
            }
        });

        socket.on("getSettings", async (callback) => {
            try {
                checkLogin(socket);
                const data = await getSettings("general");

                if (!data.serverTimezone) {
                    data.serverTimezone = await server.getTimezone();
                }

                callback({
                    ok: true,
                    data: data,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("setSettings", async (data, currentPassword, callback) => {
            try {
                checkLogin(socket);

                // If currently is disabled auth, don't need to check
                // Disabled Auth + Want to Disable Auth => No Check
                // Disabled Auth + Want to Enable Auth => No Check
                // Enabled Auth + Want to Disable Auth => Check!!
                // Enabled Auth + Want to Enable Auth => No Check
                const currentDisabledAuth = await setting("disableAuth");
                if (!currentDisabledAuth && data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
                }

                // Log out all clients if enabling auth
                // GHSA-23q2-5gf8-gjpp
                if (currentDisabledAuth && !data.disableAuth) {
                    server.disconnectAllSocketClients(socket.userID, socket.id);
                }

                const previousChromeExecutable = await Settings.get("chromeExecutable");
                const previousNSCDStatus = await Settings.get("nscd");

                await setSettings("general", data);
                server.entryPage = data.entryPage;

                // Also need to apply timezone globally
                if (data.serverTimezone) {
                    await server.setTimezone(data.serverTimezone);
                }

                // If Chrome Executable is changed, need to reset the browser
                if (previousChromeExecutable !== data.chromeExecutable) {
                    log.info("settings", "Chrome executable is changed. Resetting Chrome...");
                    await resetChrome();
                }

                // Update nscd status
                if (previousNSCDStatus !== data.nscd) {
                    if (data.nscd) {
                        await server.startNSCDServices();
                    } else {
                        await server.stopNSCDServices();
                    }
                }

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
                });

                await sendInfo(socket);
                await server.sendMaintenanceList(socket);
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Add or Edit
        socket.on("addNotification", async (notification, notificationID, callback) => {
            try {
                checkLogin(socket);

                let notificationBean = await Notification.save(notification, notificationID, socket.userID);
                await sendNotificationList(socket);

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
                    id: notificationBean.id,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteNotification", async (notificationID, callback) => {
            try {
                checkLogin(socket);

                await Notification.delete(notificationID, socket.userID);
                await sendNotificationList(socket);

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("testNotification", async (notification, callback) => {
            try {
                checkLogin(socket);

                let msg = await Notification.send(notification, notification.name + " Testing");

                callback({
                    ok: true,
                    msg,
                });
            } catch (e) {
                log.error("server", e);

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("checkApprise", async (callback) => {
            try {
                checkLogin(socket);
                callback(await Notification.checkApprise());
            } catch (e) {
                callback(false);
            }
        });

        socket.on("getWebpushVapidPublicKey", async (callback) => {
            try {
                let publicVapidKey = await Settings.get("webpushPublicVapidKey");

                if (!publicVapidKey) {
                    log.debug("webpush", "Generating new VAPID keys");
                    const vapidKeys = webpush.generateVAPIDKeys();

                    await Settings.set("webpushPublicVapidKey", vapidKeys.publicKey);
                    await Settings.set("webpushPrivateVapidKey", vapidKeys.privateKey);

                    publicVapidKey = vapidKeys.publicKey;
                }

                callback({
                    ok: true,
                    msg: publicVapidKey,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("clearEvents", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                log.info("manage", `Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`);

                await R.exec("UPDATE heartbeat SET msg = ?, important = ? WHERE monitor_id = ? ", ["", "0", monitorID]);

                callback({
                    ok: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("clearHeartbeats", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                log.info("manage", `Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`);

                await UptimeCalculator.clearStatistics(monitorID);

                if (monitorID in server.monitorList) {
                    const monitor = server.monitorList[monitorID];
                    if (monitor.active) {
                        await restartMonitor(socket.userID, monitorID);
                    }
                }

                await sendHeartbeatList(socket, monitorID, true, true);

                callback({
                    ok: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("clearStatistics", async (callback) => {
            try {
                checkLogin(socket);

                log.info("manage", `Clear Statistics User ID: ${socket.userID}`);

                await UptimeCalculator.clearAllStatistics();

                // Restart all monitors to reset the stats
                for (let monitorID in server.monitorList) {
                    const monitor = server.monitorList[monitorID];
                    if (monitor.active) {
                        await restartMonitor(socket.userID, monitorID);
                    }
                }

                callback({
                    ok: true,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Status Page Socket Handler for admin only
        statusPageSocketHandler(socket);
        cloudflaredSocketHandler(socket);
        databaseSocketHandler(socket);
        backupSocketHandler(socket);
        updateSocketHandler(socket);
        proxySocketHandler(socket);
        dockerSocketHandler(socket);
        maintenanceSocketHandler(socket);
        apiKeySocketHandler(socket);
        remoteBrowserSocketHandler(socket);
        // Organization Multi-Tenancy Socket Handlers
        socket.on("getOrganizationList", async (callback) => {
            try {
                checkLogin(socket);
                const orgs = await Organization.getUserOrganizations(socket.userID);
                if (typeof callback === "function") {
                    callback({
                        ok: true,
                        organizations: orgs,
                        activeOrganizationId: socket.activeOrganizationId || 1,
                    });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("switchOrganization", async (organizationId, callback) => {
            try {
                checkLogin(socket);
                const role = await Organization.getUserRoleInOrganization(socket.userID, organizationId);
                if (!role) {
                    throw new Error("You are not a member of this organization.");
                }
                socket.activeOrganizationId = Number(organizationId);
                await Organization.logAudit(organizationId, socket.userID, "organization_switched", { organizationId });
                const user = await R.findOne("user", " id = ? ", [socket.userID]);
                await afterLogin(socket, user);
                if (typeof callback === "function") {
                    callback({ ok: true, activeOrganizationId: socket.activeOrganizationId });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createOrganization", async (data, callback) => {
            try {
                checkLogin(socket);
                if (!data || !data.name || !data.slug) {
                    throw new Error("Organization name and slug are required.");
                }
                const userId = socket.userID || 1;
                const org = await Organization.createOrganization(data.name, data.slug, userId);
                socket.activeOrganizationId = org.id;
                const user = await R.findOne("user", " id = ? ", [userId]);
                if (user) {
                    await afterLogin(socket, user);
                } else {
                    socket.emit("organizationList", await Organization.getUserOrganizations(userId));
                    socket.emit("activeOrganizationId", socket.activeOrganizationId);
                    await server.sendMonitorList(socket);
                }
                if (typeof callback === "function") {
                    callback({ ok: true, organization: org });
                }
            } catch (e) {
                log.error("organization", "Error creating organization: " + e.message);
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Team Management & RBAC Socket Endpoints
        // ===================================
        socket.on("getTeamMembers", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.view");
                const members = await Organization.getTeamMembers(activeOrgId);
                const userRole = await Organization.getUserRoleInOrganization(socket.userID, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, members, userRole });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getPendingInvitations", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.view");
                const invitations = await Organization.getPendingInvitations(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, invitations });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("inviteTeamMember", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                if (!data || !data.email || !data.role) {
                    throw new Error("Email and role are required.");
                }
                const result = await Organization.inviteMember(activeOrgId, data.email, data.role, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true, invitation: result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("updateTeamMemberRole", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                if (!data || !data.userId || !data.role) {
                    throw new Error("User ID and role are required.");
                }
                await Organization.updateMemberRole(activeOrgId, data.userId, data.role, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("suspendTeamMember", async (targetUserId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.suspendMember(activeOrgId, targetUserId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("activateTeamMember", async (targetUserId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.activateMember(activeOrgId, targetUserId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("removeTeamMember", async (targetUserId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.removeMember(activeOrgId, targetUserId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("revokeTeamInvitation", async (invitationId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.revokeInvitation(invitationId, activeOrgId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getOrganizationAuditLogs", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.view");
                const logs = await Organization.getOrganizationAuditLogs(activeOrgId, 50);
                if (typeof callback === "function") {
                    callback({ ok: true, logs });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // Sub-Team Creation & Alert Routing Socket Endpoints
        // ===================================
        socket.on("getSubTeams", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.view");
                const subTeams = await Organization.getSubTeams(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, subTeams });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createSubTeam", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                if (!data || !data.name) {
                    throw new Error("Sub-team name is required.");
                }
                const subTeam = await Organization.createSubTeam(
                    activeOrgId,
                    data.name,
                    data.description || "",
                    data.leadUserId || null,
                    data.alertPolicy || "Default Escalation",
                    socket.userID
                );
                if (typeof callback === "function") {
                    callback({ ok: true, subTeam });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteSubTeam", async (subTeamId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.deleteSubTeam(activeOrgId, subTeamId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getTeamAlerts", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.view");
                const alerts = await Organization.getTeamAlerts(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, alerts });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createTeamAlert", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                if (!data || !data.name || !data.channelType) {
                    throw new Error("Alert channel name and type are required.");
                }
                const alert = await Organization.createTeamAlert(
                    activeOrgId,
                    data.subTeamId || null,
                    data.name,
                    data.channelType,
                    data.config || {},
                    data.quietHours || "None",
                    socket.userID
                );
                if (typeof callback === "function") {
                    callback({ ok: true, alert });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteTeamAlert", async (alertId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "team.manage");
                await Organization.deleteTeamAlert(activeOrgId, alertId, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Super Admin Control Plane Socket Endpoints
        // ===================================
        socket.on("getSuperAdminOverview", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const overview = await SuperAdmin.getGlobalOverview();
                if (typeof callback === "function") {
                    callback({ ok: true, overview });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminOrganizations", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const organizations = await SuperAdmin.getAllOrganizations();
                if (typeof callback === "function") {
                    callback({ ok: true, organizations });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminUsers", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const users = await SuperAdmin.getAllUsers();
                if (typeof callback === "function") {
                    callback({ ok: true, users });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("updateSuperAdminOrgPlan", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                if (!data || !data.orgId || !data.plan) {
                    throw new Error("Organization ID and plan are required.");
                }
                await SuperAdmin.updateOrganizationPlan(data.orgId, data.plan, data.customLimits || {});
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createOrganizationWithAdmin", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const result = await SuperAdmin.createOrganizationWithAdmin(socket.userID, data);
                if (typeof callback === "function") {
                    callback({ ok: true, result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("toggleSuperAdminOrgStatus", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                if (!data || !data.orgId || !data.status) {
                    throw new Error("Organization ID and status are required.");
                }
                await SuperAdmin.toggleOrganizationStatus(data.orgId, data.status);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminAuditLogs", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const logs = await SuperAdmin.getSystemAuditLogs(100);
                if (typeof callback === "function") {
                    callback({ ok: true, logs });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("impersonateOrganization", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const orgId = typeof data === "object" ? data.orgId : data;
                const reason = data.reason || "Administrative Troubleshooting";
                const clientIP = await server.getClientIP(socket);
                const session = await SuperAdmin.impersonateOrganization(socket.userID, orgId, reason, clientIP);

                socket.activeOrganizationId = Number(orgId);
                const user = await R.findOne("user", " id = ? ", [socket.userID]);
                if (user) {
                    await afterLogin(socket, user);
                }

                if (typeof callback === "function") {
                    callback({ ok: true, session });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminOrgDetails", async (orgId, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const details = await SuperAdmin.getOrganizationDetails(orgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...details });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminPlans", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const plans = await SuperAdmin.getPlans();
                if (typeof callback === "function") {
                    callback({ ok: true, plans });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveSuperAdminPlan", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                await SuperAdmin.savePlan(data);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminSystemHealth", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const health = await SuperAdmin.getSystemHealth();
                if (typeof callback === "function") {
                    callback({ ok: true, health });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminCoupons", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const coupons = await SuperAdmin.getCoupons();
                if (typeof callback === "function") {
                    callback({ ok: true, coupons });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveSuperAdminCoupon", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                await SuperAdmin.saveCoupon(data);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminPaymentGateways", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const gateways = await SuperAdmin.getPaymentGateways();
                if (typeof callback === "function") {
                    callback({ ok: true, gateways });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveSuperAdminPaymentGateway", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                await SuperAdmin.savePaymentGateway(data);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminInvoices", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const invoices = await SuperAdmin.getInvoices();
                if (typeof callback === "function") {
                    callback({ ok: true, invoices });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("setSuperAdminOrgFeatureOverride", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                if (!data || !data.orgId || !data.featureKey) {
                    throw new Error("Org ID and featureKey are required.");
                }
                await SuperAdmin.setOrganizationFeatureOverride(data.orgId, data.featureKey, data.enabled, data.limitValue);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminSmtpSettings", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const smtp = await SuperAdmin.getSmtpSettings();
                if (typeof callback === "function") {
                    callback({ ok: true, smtp });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("testSnmpConnection", async (data, callback) => {
            try {
                checkLogin(socket);
                const SnmpMonitoring = require("./model/snmp-monitoring");
                const res = await SnmpMonitoring.testSnmpConnection(data || {});
                if (typeof callback === "function") {
                    callback(res);
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, status: "error", msg: e.message });
                }
            }
        });

        socket.on("saveSuperAdminSmtpSettings", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                await SuperAdmin.saveSmtpSettings(data);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSuperAdminPlatformSettings", async (callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                const settings = await SuperAdmin.getPlatformSettings();
                if (typeof callback === "function") {
                    callback({ ok: true, settings });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveSuperAdminPlatformSettings", async (data, callback) => {
            try {
                checkLogin(socket);
                await SuperAdmin.assertSuperAdmin(socket.userID);
                await SuperAdmin.savePlatformSettings(data);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC SaaS Billing & Razorpay Socket Endpoints
        // ===================================
        socket.on("getBillingSummary", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "billing.view");
                const summary = await RazorpayBilling.getBillingSummary(activeOrgId);
                const userRole = await Organization.getUserRoleInOrganization(socket.userID, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, summary, userRole });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createBillingOrder", async (targetPlan, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "billing.manage");
                const order = await RazorpayBilling.createOrder(activeOrgId, targetPlan, socket.userID);
                if (typeof callback === "function") {
                    callback({ ok: true, order });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("completeBillingPayment", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "billing.manage");
                if (!data || !data.orderId || !data.paymentId) {
                    throw new Error("Order ID and Payment ID are required.");
                }
                const result = await RazorpayBilling.verifyAndCompletePayment(
                    activeOrgId,
                    data.orderId,
                    data.paymentId,
                    data.signature || "",
                    socket.userID
                );
                if (typeof callback === "function") {
                    callback(result);
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Sites Socket Endpoints
        // ===================================
        socket.on("getSiteList", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const sites = await Site.getSiteList(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, sites });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSite", async (siteId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const site = await Site.getSite(siteId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("addSite", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const site = await Site.createSite(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("editSite", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.id) {
                    throw new Error("Site ID required.");
                }
                const site = await Site.updateSite(data.id, data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteSite", async (siteId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await Site.deleteSite(siteId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("assignMonitorsToSite", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.siteId) {
                    throw new Error("Site ID required.");
                }
                const site = await Site.assignMonitors(data.siteId, data.monitorIds, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("addDeviceToSite", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.siteId) {
                    throw new Error("Site ID required.");
                }
                const site = await Site.addDevice(data.siteId, data.device, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteDeviceFromSite", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.siteId || !data.deviceId) {
                    throw new Error("Site ID and Device ID required.");
                }
                const site = await Site.removeDevice(data.siteId, data.deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, site });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Device Inventory Socket Endpoints
        // ===================================
        socket.on("getDeviceList", async (siteId, deviceType, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                let sId = siteId;
                let dType = deviceType;
                if (typeof siteId === "function") {
                    callback = siteId;
                    sId = null;
                    dType = null;
                } else if (typeof deviceType === "function") {
                    callback = deviceType;
                    dType = null;
                }
                const devices = await Device.getDeviceList(activeOrgId, sId, dType);
                if (typeof callback === "function") {
                    callback({ ok: true, devices });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getDevice", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const device = await Device.getDevice(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("addDevice", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await RBAC.assertPermission(socket.userID, activeOrgId, "device.manage");

                // Enforce SaaS Quota Limit for Devices
                const org = await R.getRow("SELECT max_devices, plan FROM organization WHERE id = ?", [ activeOrgId ]);
                const currentDevices = await R.getCell("SELECT COUNT(*) FROM device WHERE organization_id = ?", [ activeOrgId ]) || 0;
                const maxDevices = org ? (org.max_devices || 10) : 10;
                if (currentDevices >= maxDevices) {
                    throw new Error(`SaaS Quota Limit Reached: Your current ${org?.plan ? org.plan.toUpperCase() : 'STARTER'} plan limit of ${maxDevices} devices has been reached. Please upgrade your subscription on the Billing page.`);
                }

                const device = await Device.createDevice(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("editDevice", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.id) {
                    throw new Error("Device ID required.");
                }
                const device = await Device.updateDevice(data.id, data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteDevice", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await Device.deleteDevice(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("addDeviceCredential", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.deviceId) {
                    throw new Error("Device ID required.");
                }
                const device = await Device.addCredential(data.deviceId, data.credential, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteDeviceCredential", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.deviceId || !data.credentialId) {
                    throw new Error("Device ID and Credential ID required.");
                }
                const device = await Device.deleteCredential(data.deviceId, data.credentialId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("assignMonitorsToDevice", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.deviceId) {
                    throw new Error("Device ID required.");
                }
                const device = await Device.assignMonitors(data.deviceId, data.monitorIds, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, device });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Remote Probe Socket Endpoints
        // ===================================
        socket.on("getProbeList", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const probes = await Probe.getProbeList(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, probes });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createProbeToken", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await Probe.createProbeRegistrationToken(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("registerProbe", async (data, callback) => {
            try {
                if (!data || !data.probeId || !data.registrationToken) {
                    throw new Error("Probe ID and registration token required.");
                }
                const result = await Probe.registerProbe(data.probeId, data.registrationToken, data.ipAddress, data.version);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("probeHeartbeat", async (data, callback) => {
            try {
                if (!data || !data.probeId || !data.apiKey) {
                    throw new Error("Probe ID and API key required.");
                }
                const result = await Probe.recordHeartbeat(data.probeId, data.apiKey, data.telemetry);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("revokeProbe", async (probeId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const probe = await Probe.revokeProbe(probeId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, probe });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("rotateProbeToken", async (probeId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await Probe.rotateCredentials(probeId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteProbe", async (probeId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await Probe.deleteProbe(probeId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Real SNMP Monitoring Socket Endpoints
        // ===================================
        socket.on("getSnmpConfig", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const config = await SnmpMonitoring.getSnmpConfig(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, config });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveSnmpConfig", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.deviceId) {
                    throw new Error("Device ID required.");
                }
                const config = await SnmpMonitoring.saveSnmpConfig(data.deviceId, data.config, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, config });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getDeviceMetrics", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const metrics = await SnmpMonitoring.getDeviceMetrics(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, metrics });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("snmpMetricIngest", async (data, callback) => {
            try {
                if (!data || !data.deviceId) {
                    throw new Error("Device ID required.");
                }
                const activeOrgId = socket.activeOrganizationId || data.organizationId || 1;
                const result = await SnmpMonitoring.ingestMetrics(data.deviceId, data.metrics, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Enterprise Alert Engine Socket Endpoints
        // ===================================
        socket.on("getAlertRules", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const rules = await AlertEngine.getRules(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, rules });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveAlertRule", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const rule = await AlertEngine.createRule(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, rule });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteAlertRule", async (ruleId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await AlertEngine.deleteRule(ruleId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getActiveAlerts", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const alerts = await AlertEngine.getActiveAlerts(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, alerts });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("acknowledgeAlert", async (alertId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const alert = await AlertEngine.acknowledgeAlert(alertId, socket.userId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, alert });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("silenceAlert", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.alertId) {
                    throw new Error("Alert ID required.");
                }
                const alert = await AlertEngine.silenceAlert(data.alertId, data.silenceMinutes, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, alert });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getAlertHistory", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const history = await AlertEngine.getAlertHistory(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, history });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Incident Management Socket Endpoints
        // ===================================
        socket.on("getIncidents", async (filters, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const incidents = await Incident.getIncidents(activeOrgId, filters);
                if (typeof callback === "function") {
                    callback({ ok: true, incidents });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getIncidentDetails", async (incidentId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const incident = await Incident.getIncidentDetails(incidentId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createIncident", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const incident = await Incident.createIncident(data, activeOrgId, socket.userId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("assignIncidentEngineer", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.incidentId || !data.assignedUserId) {
                    throw new Error("Incident ID and Assigned User ID required.");
                }
                const incident = await Incident.assignEngineer(data.incidentId, data.assignedUserId, socket.userId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("addIncidentNote", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.incidentId || !data.note) {
                    throw new Error("Incident ID and note content required.");
                }
                await Incident.addNote(data.incidentId, data.note, socket.userId, activeOrgId);
                const incident = await Incident.getIncidentDetails(data.incidentId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("updateIncidentStatus", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.incidentId || !data.status) {
                    throw new Error("Incident ID and status required.");
                }
                const incident = await Incident.updateStatus(data.incidentId, data.status, socket.userId, data.extraData, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("reopenIncident", async (incidentId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const incident = await Incident.reopenIncident(incidentId, socket.userId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("linkIncidentEntities", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.incidentId || !data.links) {
                    throw new Error("Incident ID and links array required.");
                }
                await Incident.linkEntities(data.incidentId, data.links, activeOrgId);
                const incident = await Incident.getIncidentDetails(data.incidentId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, incident });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getIncidentDashboardStats", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const stats = await Incident.getIncidentDashboardStats(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, stats });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("resolveAllIncidents", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await Incident.resolveAllIncidents(socket.userID, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, count: result.count });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Dependency & Alert Correlation Endpoints
        // ===================================
        socket.on("addDeviceDependency", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.parentDeviceId || !data.childDeviceId) {
                    throw new Error("Parent Device ID and Child Device ID required.");
                }
                const dep = await DependencyCorrelation.addDependency(data.parentDeviceId, data.childDeviceId, data.dependencyType, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, dependency: dep });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteDeviceDependency", async (dependencyId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await DependencyCorrelation.deleteDependency(dependencyId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getDeviceDependencies", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const deps = await DependencyCorrelation.getDeviceDependencies(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...deps });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("processDeviceFailure", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await DependencyCorrelation.processDeviceFailure(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("processDeviceRecovery", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await DependencyCorrelation.processDeviceRecovery(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC MikroTik Monitoring & Vendor Capabilities
        // ===================================
        socket.on("getVendorCapabilities", async (vendorName, callback) => {
            try {
                checkLogin(socket);
                const caps = VendorCapabilityRegistry.getVendorCapabilities(vendorName);
                if (typeof callback === "function") {
                    callback({ ok: true, capabilities: caps });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getMikroTikDashboardData", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const devId = Number(deviceId);

                const dev = await Device.getDevice(devId, activeOrgId);
                if (!dev) {
                    throw new Error("Device not found or access denied.");
                }

                const MetricsStore = require("./model/metrics-store");
                const metrics = await MetricsStore.getLatestDeviceMetrics(devId, activeOrgId);
                const activeAlerts = await AlertEngine.getActiveAlerts(activeOrgId);
                const deviceAlerts = activeAlerts.filter((a) => a.entity_type === "device" && Number(a.entity_id) === devId);
                const capabilities = VendorCapabilityRegistry.getVendorCapabilities("MikroTik");

                if (typeof callback === "function") {
                    callback({
                        ok: true,
                        device: dev,
                        metrics,
                        activeAlerts: deviceAlerts,
                        capabilities,
                    });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC OLT Vendor Adapter Endpoints
        // ===================================
        socket.on("getOltAdapters", async (callback) => {
            try {
                checkLogin(socket);
                const adapters = OltAdapterRegistry.listAdapters();
                if (typeof callback === "function") {
                    callback({ ok: true, adapters });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getOltDashboardData", async (deviceId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const data = await OltMonitoring.getOltDashboardData(deviceId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...data });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("ingestOltTelemetry", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                if (!data || !data.deviceId) {
                    throw new Error("Device ID required.");
                }
                const result = await OltMonitoring.ingestOltTelemetry(data.deviceId, data.telemetry, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, telemetry: result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Notification Routing Endpoints
        // ===================================
        socket.on("getNotificationChannels", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const channels = await NotificationRouter.getChannels(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, channels });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveNotificationChannel", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const channel = await NotificationRouter.saveChannel(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, channel });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteNotificationChannel", async (channelId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await NotificationRouter.deleteChannel(channelId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("testNotificationChannel", async (channelId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await NotificationRouter.testChannel(channelId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getNotificationRoutingRules", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const rules = await NotificationRouter.getRoutingRules(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, rules });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveNotificationRoutingRule", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const rule = await NotificationRouter.saveRoutingRule(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, rule });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("deleteNotificationRoutingRule", async (ruleId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                await NotificationRouter.deleteRoutingRule(ruleId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getNotificationDeliveryLogs", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const logs = await NotificationRouter.getDeliveryLogs(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, logs });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC SLA & Availability Endpoints
        // ===================================
        socket.on("generateSlaReport", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await SlaReporting.generateSlaReport(data || {}, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, report: result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSlaReportsList", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const reports = await SlaReporting.getReportsList(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, reports });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("getSlaReportDetails", async (reportId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const details = await SlaReporting.getReportDetails(reportId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...details });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("exportSlaReportCsv", async (reportId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const csv = await SlaReporting.exportCsv(reportId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, csv });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("exportSlaReportPdf", async (reportId, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const html = await SlaReporting.exportPdfHtml(reportId, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, html });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC Organization Branding Endpoints
        // ===================================
        socket.on("getOrganizationBranding", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const branding = await OrganizationBranding.getBranding(activeOrgId);
                const themeTokens = await OrganizationBranding.getThemeTokens(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, branding, themeTokens });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("saveOrganizationBranding", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const branding = await OrganizationBranding.saveBranding(data, activeOrgId);
                const themeTokens = await OrganizationBranding.getThemeTokens(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, branding, themeTokens });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("resolveBrandingByDomain", async (hostname, callback) => {
            try {
                const branding = await OrganizationBranding.resolveBrandingByDomain(hostname);
                if (typeof callback === "function") {
                    callback({ ok: true, branding });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        // ===================================
        // InfiniNOC SaaS Subscription & Billing Endpoints
        // ===================================
        socket.on("getSubscriptionOverview", async (callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const overview = await SaasSubscription.getSubscriptionOverview(activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...overview });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("createPaymentOrder", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const amountInr = data ? data.amountInr : 1999;
                const order = await RazorpayBilling.createOrder(amountInr, `rcpt_plan_${data.planCode}`, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, order });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("verifyPaymentSignature", async (data, callback) => {
            try {
                checkLogin(socket);
                const isValid = RazorpayBilling.verifyPaymentSignature(data.orderId, data.paymentId, data.signature);
                if (typeof callback === "function") {
                    callback({ ok: isValid });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        socket.on("upgradeSubscriptionPlan", async (data, callback) => {
            try {
                checkLogin(socket);
                const activeOrgId = socket.activeOrganizationId || 1;
                const result = await SaasSubscription.upgradePlan(data, activeOrgId);
                if (typeof callback === "function") {
                    callback({ ok: true, ...result });
                }
            } catch (e) {
                if (typeof callback === "function") {
                    callback({ ok: false, msg: e.message });
                }
            }
        });

        generalSocketHandler(socket, server);
        chartSocketHandler(socket);

        log.debug("server", "added all socket handlers");

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        log.debug("auth", "check auto login");
        if (await setting("disableAuth")) {
            log.info("auth", "Disabled Auth: auto login to admin");
            await afterLogin(socket, await R.findOne("user"));
            socket.emit("autoLogin");
        } else {
            socket.emit("loginRequired");
            log.debug("auth", "need auth");
        }
    });

    log.debug("server", "Init the server");

    server.httpServer.once("error", async (err) => {
        log.error("server", "Cannot listen: " + err.message);
        await shutdownFunction();
        process.exit(1);
    });

    await server.start();

    server.httpServer.listen(port, hostname, async () => {
        printServerUrls("server", port, hostname, config.isSSL);

        await startMonitors();

        // Put this here. Start background jobs after the db and server is ready to prevent clear up during db migration.
        await initBackgroundJobs();

        checkVersion.startInterval();
    });

    // Start cloudflared at the end if configured
    await cloudflaredAutoStart(cloudflaredToken);
})();

/**
 * Update notifications for a given monitor
 * @param {number} monitorID ID of monitor to update
 * @param {number[]} notificationIDList List of new notification
 * providers to add
 * @returns {Promise<void>}
 */
async function updateMonitorNotification(monitorID, notificationIDList) {
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [monitorID]);

    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

/**
 * Check if a given user owns a specific monitor
 * @param {number} userID ID of user to check
 * @param {number} monitorID ID of monitor to check
 * @returns {Promise<void>}
 * @throws {Error} The specified user does not own the monitor
 */
async function checkOwner(userID, monitorID) {
    let row = await R.getRow("SELECT id FROM monitor WHERE id = ? AND user_id = ? ", [monitorID, userID]);

    if (!row) {
        throw new Error("You do not own this monitor.");
    }
}

/**
 * Function called after user login
 * This function is used to send the heartbeat list of a monitor.
 * @param {Socket} socket Socket.io instance
 * @param {object} user User object
 * @returns {Promise<void>}
 */
async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id);

    // Initialize Organization Multi-Tenancy Session Context
    const userOrgs = await Organization.getUserOrganizations(user.id);
    socket.organizationList = userOrgs;
    if (!socket.activeOrganizationId || !userOrgs.some((o) => o.id === socket.activeOrganizationId)) {
        socket.activeOrganizationId = userOrgs.length > 0 ? userOrgs[0].id : 1;
    }
    socket.emit("organizationList", userOrgs);
    socket.emit("activeOrganizationId", socket.activeOrganizationId);
    socket.emit("userInfo", {
        id: user.id,
        username: user.username,
        is_super_admin: Boolean(user.is_super_admin),
    });

    let monitorList = await server.sendMonitorList(socket);
    await Promise.allSettled([
        sendInfo(socket),
        server.sendMaintenanceList(socket),
        sendNotificationList(socket),
        sendProxyList(socket),
        sendDockerHostList(socket),
        sendAPIKeyList(socket),
        sendRemoteBrowserList(socket),
        sendMonitorTypeList(socket),
    ]);

    await StatusPage.sendStatusPageList(io, socket);

    const monitorPromises = [];
    for (let monitorID in monitorList) {
        monitorPromises.push(sendHeartbeatList(socket, monitorID));
        monitorPromises.push(Monitor.sendStats(io, monitorID, user.id));
    }

    await Promise.all(monitorPromises);

    // Set server timezone from client browser if not set
    // It should be run once only
    if (!(await Settings.get("initServerTimezone"))) {
        log.debug("server", "emit initServerTimezone");
        socket.emit("initServerTimezone");
    }
}

/**
 * Initialize the database
 * @param {boolean} testMode Should the connection be
 * started in test mode?
 * @returns {Promise<void>}
 */
async function initDatabase(testMode = false) {
    log.debug("server", "Connecting to the database");
    await Database.connect(testMode);
    log.info("server", "Connected to the database");

    // Patch the database
    await Database.patch(port, hostname);

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", ["jwtSecret"]);

    if (!jwtSecretBean) {
        log.info("server", "JWT secret is not found, generate one.");
        jwtSecretBean = await initJWTSecret();
        log.info("server", "Stored JWT secret into database");
    } else {
        log.debug("server", "Load JWT secret from database.");
    }

    // If there is no record in user table, it is a new Uptime Kuma instance, need to setup
    if ((await R.knex("user").count("id as count").first()).count === 0) {
        log.info("server", "No user, need setup");
        needSetup = true;
    }

    server.jwtSecret = jwtSecretBean.value;
}

/**
 * Start the specified monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function startMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log.info("manage", `Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [monitorID, userID]);

    let monitor = await R.findOne("monitor", " id = ? ", [monitorID]);

    if (monitor.id in server.monitorList) {
        await server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    await monitor.start(io);
}

/**
 * Restart a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID);
}

/**
 * Pause a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function pauseMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log.info("manage", `Pause Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 0 WHERE id = ? AND user_id = ? ", [monitorID, userID]);

    if (monitorID in server.monitorList) {
        await server.monitorList[monitorID].stop();
        server.monitorList[monitorID].active = 0;
    }
}

/**
 * Resume active monitors
 * @returns {Promise<void>}
 */
async function startMonitors() {
    let list = await R.find("monitor", " active = 1 ");

    for (let monitor of list) {
        server.monitorList[monitor.id] = monitor;
    }

    for (let monitor of list) {
        try {
            await monitor.start(io);
        } catch (e) {
            log.error("monitor", e);
        }
        // Give some delays, so all monitors won't make request at the same moment when just start the server.
        await sleep(getRandomInt(300, 1000));
    }
}

/**
 * Shutdown the application
 * Stops all monitors and closes the database connection.
 * @param {string} signal The signal that triggered this function to be called.
 * @returns {Promise<void>}
 */
async function shutdownFunction(signal) {
    log.info("server", "Shutdown requested");
    log.info("server", "Called signal: " + signal);

    await server.stop();

    log.info("server", "Stopping all monitors");
    for (let id in server.monitorList) {
        let monitor = server.monitorList[id];
        await monitor.stop();
    }
    await sleep(2000);
    await Database.close();

    if (EmbeddedMariaDB.hasInstance()) {
        EmbeddedMariaDB.getInstance().stop();
    }

    stopBackgroundJobs();
    await cloudflaredStop();
    Settings.stopCacheCleaner();
}

/**
 * Final function called before application exits
 * @returns {void}
 */
function finalFunction() {
    log.info("server", "Graceful shutdown successful!");
}

gracefulShutdown(server.httpServer, {
    signals: "SIGINT SIGTERM",
    timeout: 30000, // timeout: 30 secs
    development: false, // not in dev mode
    forceExit: true, // triggers process.exit() at the end of shutdown process
    onShutdown: shutdownFunction, // shutdown function (async) - e.g. for cleanup DB, ...
    finally: finalFunction, // finally function (sync) - e.g. for logging
});

// Catch unexpected errors here
let unexpectedErrorHandler = (error, promise) => {
    console.trace(error);
    UptimeKumaServer.errorLog(error, false);
    console.error("If you keep encountering errors, please report to https://github.com/louislam/uptime-kuma/issues");
};
process.addListener("unhandledRejection", unexpectedErrorHandler);
process.addListener("uncaughtException", unexpectedErrorHandler);
