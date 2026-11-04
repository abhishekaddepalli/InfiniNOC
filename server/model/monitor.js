const dayjs = require("dayjs");
const axios = require("axios");
const { setTimeout, clearTimeout } = require("unlimited-timeout");
const { Prometheus } = require("../prometheus");
const {
    log,
    UP,
    DOWN,
    PENDING,
    MAINTENANCE,
    flipStatus,
    MIN_INTERVAL_SECOND,
    SQL_DATETIME_FORMAT,
    evaluateJsonQuery,
    PING_PACKET_SIZE_MIN,
    PING_PACKET_SIZE_MAX,
    PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_MIN,
    PING_GLOBAL_TIMEOUT_MAX,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_MIN,
    PING_COUNT_MAX,
    PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_MIN,
    PING_PER_REQUEST_TIMEOUT_MAX,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
    RESPONSE_BODY_LENGTH_DEFAULT,
    RESPONSE_BODY_LENGTH_MAX,
} = require("../../src/util");
const {
    ping,
    checkCertificate,
    checkStatusCode,
    getTotalClientInRoom,
    httpNtlm,
    radius,
    kafkaProducerAsync,
    getOidcTokenClientCredentials,
    rootCertificatesFingerprints,
    axiosAbortSignal,
    checkCertificateHostname,
    encodeBase64,
    checkCertExpiryNotifications,
    toSqlDatetime,
} = require("../util-server");
const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const { Notification } = require("../notification");
const { Proxy } = require("../proxy");
const { demoMode } = require("../config");
const version = require("../../package.json").version;
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { DockerHost } = require("../docker");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { UptimeCalculator } = require("../uptime-calculator");
const { CookieJar } = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const https = require("https");
const http = require("http");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const brotliCompress = promisify(zlib.brotliCompress);
const DomainExpiry = require("./domain_expiry");
const Incident = require("./incident");
const AlertEngine = require("./alert-engine");

const rootCertificates = rootCertificatesFingerprints();

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 *      3 = MAINTENANCE
 */
class Monitor extends BeanModel {
    /**
     * Return an object that ready to parse to JSON for public Only show
     * necessary data to public
     * @param {boolean} showTags Include tags in JSON
     * @param {boolean} certExpiry Include certificate expiry info in
     * JSON
     * @returns {Promise<object>} Object ready to parse
     */
    async toPublicJSON(showTags = false, certExpiry = false) {
        let obj = {
            id: this.id,
            name: this.name,
            sendUrl: this.sendUrl,
            type: this.type,
        };

        if (this.sendUrl) {
            obj.url = this.customUrl ?? this.url;
        }

        if (showTags) {
            obj.tags = await this.getTags();
        }

        if (certExpiry) {
            const { certExpiryDaysRemaining, validCert } = await this.getCertExpiry(this.id);
            obj.certExpiryDaysRemaining = certExpiryDaysRemaining;
            obj.validCert = validCert;
        }

        return obj;
    }

    /**
     * Return an object that ready to parse to JSON
     * @param {object} preloadData to prevent n+1 problems, we query the data in a batch outside of this function
     * @param {boolean} includeSensitiveData Include sensitive data in
     * JSON
     * @returns {object} Object ready to parse
     */
    toJSON(preloadData = {}, includeSensitiveData = true) {
        let screenshot = null;

        if (this.type === "real-browser") {
            screenshot = "/screenshots/" + jwt.sign(this.id, UptimeKumaServer.getInstance().jwtSecret) + ".png";
        }

        const path = preloadData.paths.get(this.id) || [];
        const pathName = path.join(" / ");

        let data = {
            id: this.id,
            name: this.name,
            description: this.description,
            path,
            pathName,
            parent: this.parent,
            childrenIDs: preloadData.childrenIDs.get(this.id) || [],
            url: this.url,
            wsIgnoreSecWebsocketAcceptHeader: this.getWsIgnoreSecWebsocketAcceptHeader(),
            wsSubprotocol: this.wsSubprotocol,
            method: this.method,
            hostname: this.hostname,
            port: this.port,
            location: this.location,
            protocol: this.protocol,
            maxretries: this.maxretries,
            weight: this.weight,
            active: preloadData.activeStatus.get(this.id),
            forceInactive: preloadData.forceInactive.get(this.id),
            type: this.type,
            subtype: this.subtype,
            timeout: this.timeout,
            interval: this.interval,
            retryInterval: this.retryInterval,
            retryOnlyOnStatusCodeFailure: Boolean(this.retry_only_on_status_code_failure),
            resendInterval: this.resendInterval,
            keyword: this.keyword,
            invertKeyword: this.isInvertKeyword(),
            expiryNotification: this.isEnabledExpiryNotification(),
            domainExpiryNotification: Boolean(this.domainExpiryNotification),
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            packetSize: this.packetSize,
            maxredirects: this.maxredirects,
            accepted_statuscodes: this.getAcceptedStatuscodes(),
            dns_resolve_type: this.dns_resolve_type,
            dns_resolve_server: this.dns_resolve_server,
            dns_last_result: this.dns_last_result,
            docker_container: this.docker_container,
            docker_host: this.docker_host,
            proxyId: this.proxy_id,
            probeId: this.probe_id || null,
            probe_id: this.probe_id || null,
            execution_location: this.probe_id ? `Remote Probe #${this.probe_id}` : "Central Monitoring Server",
            execution_source: this.probe_id ? "probe" : "central",
            notificationIDList: preloadData.notifications.get(this.id) || {},
            tags: preloadData.tags.get(this.id) || [],
            maintenance: preloadData.maintenanceStatus.get(this.id),
            mqttTopic: this.mqttTopic,
            mqttSuccessMessage: this.mqttSuccessMessage,
            mqttCheckType: this.mqttCheckType,
            databaseQuery: this.databaseQuery,
            authMethod: this.authMethod,
            grpcUrl: this.grpcUrl,
            grpcProtobuf: this.grpcProtobuf,
            grpcMethod: this.grpcMethod,
            grpcServiceName: this.grpcServiceName,
            grpcEnableTls: this.getGrpcEnableTls(),
            radiusCalledStationId: this.radiusCalledStationId,
            radiusCallingStationId: this.radiusCallingStationId,
            game: this.game,
            gamedigGivenPortOnly: this.getGameDigGivenPortOnly(),
            httpBodyEncoding: this.httpBodyEncoding,
            jsonPath: this.jsonPath,
            expectedValue: this.expectedValue,
            system_service_name: this.system_service_name,
            kafkaProducerTopic: this.kafkaProducerTopic,
            kafkaProducerBrokers: JSON.parse(this.kafkaProducerBrokers),
            kafkaProducerSsl: this.getKafkaProducerSsl(),
            kafkaProducerAllowAutoTopicCreation: this.getKafkaProducerAllowAutoTopicCreation(),
            kafkaProducerMessage: this.kafkaProducerMessage,
            screenshot,
            cacheBust: this.getCacheBust(),
            remote_browser: this.remote_browser,
            screenshot_delay: this.screenshot_delay,
            snmpOid: this.snmpOid,
            jsonPathOperator: this.jsonPathOperator,
            snmpVersion: this.snmpVersion,
            smtpSecurity: this.smtpSecurity,
            rabbitmqNodes: JSON.parse(this.rabbitmqNodes),
            conditions: JSON.parse(this.conditions),
            ntpStratumThreshold: this.ntp_stratum_threshold,
            ntpTimeOffsetThreshold: this.ntp_time_offset_threshold,
            ntpRootDispersionThreshold: this.ntp_root_dispersion_threshold,
            ipFamily: this.ipFamily,
            expectedTlsAlert: this.expected_tls_alert,

            // ping advanced options
            ping_numeric: this.isPingNumeric(),
            ping_count: this.ping_count,
            ping_per_request_timeout: this.ping_per_request_timeout,

            // response saving options
            saveResponse: this.getSaveResponse(),
            saveErrorResponse: this.getSaveErrorResponse(),
            responseMaxLength: this.response_max_length ?? RESPONSE_BODY_LENGTH_DEFAULT,
        };

        if (includeSensitiveData) {
            data = {
                ...data,
                headers: this.headers,
                body: this.body,
                grpcBody: this.grpcBody,
                grpcMetadata: this.grpcMetadata,
                basic_auth_user: this.basic_auth_user,
                basic_auth_pass: this.basic_auth_pass,
                oauth_client_id: this.oauth_client_id,
                oauth_client_secret: this.oauth_client_secret,
                oauth_token_url: this.oauth_token_url,
                oauth_scopes: this.oauth_scopes,
                oauth_audience: this.oauth_audience,
                oauth_auth_method: this.oauth_auth_method,
                bearer_token: this.bearer_token,
                gamedigToken: this.gamedigToken,
                pushToken: this.pushToken,
                databaseConnectionString: this.databaseConnectionString,
                radiusUsername: this.radiusUsername,
                radiusPassword: this.radiusPassword,
                radiusSecret: this.radiusSecret,
                mqttUsername: this.mqttUsername,
                mqttPassword: this.mqttPassword,
                mqttWebsocketPath: this.mqttWebsocketPath,
                authWorkstation: this.authWorkstation,
                authDomain: this.authDomain,
                tlsCa: this.tlsCa,
                tlsCert: this.tlsCert,
                tlsKey: this.tlsKey,
                kafkaProducerSaslOptions: JSON.parse(this.kafkaProducerSaslOptions),
                rabbitmqUsername: this.rabbitmqUsername,
                rabbitmqPassword: this.rabbitmqPassword,
            };
        }

        data.includeSensitiveData = includeSensitiveData;
        return data;
    }

    /**
     * Get all tags applied to this monitor
     * @returns {Promise<LooseObject<any>[]>} List of tags on the
     * monitor
     */
    async getTags() {
        return await R.getAll(
            "SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ? ORDER BY tag.name",
            [this.id]
        );
    }

    /**
     * Gets certificate expiry for this monitor
     * @param {number} monitorID ID of monitor to send
     * @returns {Promise<LooseObject<any>>} Certificate expiry info for
     * monitor
     */
    async getCertExpiry(monitorID) {
        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [monitorID]);
        let tlsInfo;
        if (tlsInfoBean) {
            tlsInfo = JSON.parse(tlsInfoBean?.info_json);
            if (tlsInfo?.valid && tlsInfo?.certInfo?.daysRemaining) {
                return {
                    certExpiryDaysRemaining: tlsInfo.certInfo.daysRemaining,
                    validCert: true,
                };
            }
        }
        return {
            certExpiryDaysRemaining: "",
            validCert: false,
        };
    }

    /**
     * Is the TLS expiry notification enabled?
     * @returns {boolean} Enabled?
     */
    isEnabledExpiryNotification() {
        return Boolean(this.expiryNotification);
    }

    /**
     * Check if ping should use numeric output only
     * @returns {boolean} True if IP addresses will be output instead of symbolic hostnames
     */
    isPingNumeric() {
        return Boolean(this.ping_numeric);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should TLS errors be ignored?
     */
    getIgnoreTls() {
        return Boolean(this.ignoreTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should WS headers be ignored?
     */
    getWsIgnoreSecWebsocketAcceptHeader() {
        return Boolean(this.wsIgnoreSecWebsocketAcceptHeader);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Is the monitor in upside down mode?
     */
    isUpsideDown() {
        return Boolean(this.upsideDown);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Invert keyword match?
     */
    isInvertKeyword() {
        return Boolean(this.invertKeyword);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Enable TLS for gRPC?
     */
    getGrpcEnableTls() {
        return Boolean(this.grpcEnableTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} if cachebusting is enabled
     */
    getCacheBust() {
        return Boolean(this.cacheBust);
    }

    /**
     * Get accepted status codes
     * @returns {object} Accepted status codes
     */
    getAcceptedStatuscodes() {
        return JSON.parse(this.accepted_statuscodes_json);
    }

    /**
     * Get if game dig should only use the port which was provided
     * @returns {boolean} gamedig should only use the provided port
     */
    getGameDigGivenPortOnly() {
        return Boolean(this.gamedigGivenPortOnly);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Ssl enabled?
     */
    getKafkaProducerSsl() {
        return Boolean(this.kafkaProducerSsl);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Allow Auto Topic Creation Enabled?
     */
    getKafkaProducerAllowAutoTopicCreation() {
        return Boolean(this.kafkaProducerAllowAutoTopicCreation);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should save response data on success?
     */
    getSaveResponse() {
        return Boolean(this.save_response);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should save response data on error?
     */
    getSaveErrorResponse() {
        return Boolean(this.save_error_response);
    }

    /**
     * Start monitor
     * @param {Server} io Socket server instance
     * @returns {Promise<void>}
     */
    async start(io) {
        let previousBeat = null;
        let retries = 0;

        this.rootCertificates = rootCertificates;

        try {
            this.prometheus = new Prometheus(this, await this.getTags());
        } catch (e) {
            log.error("prometheus", "Please submit an issue to our GitHub repo. Prometheus update error: ", e.message);
        }

        const beat = async () => {
            let beatInterval = this.interval;

            if (!beatInterval) {
                beatInterval = 1;
            }

            if (demoMode) {
                if (beatInterval < 20) {
                    console.log("beat interval too low, reset to 20s");
                    beatInterval = 20;
                }
            }

            // Expose here for prometheus update
            // undefined if not https
            let tlsInfo = undefined;

            if (!previousBeat || this.type === "push") {
                previousBeat = await R.findOne("heartbeat", " monitor_id = ? ORDER BY time DESC", [this.id]);
                if (previousBeat) {
                    retries = previousBeat.retries;
                }
            }

            const isFirstBeat = !previousBeat;

            let bean = R.dispense("heartbeat");
            bean.monitor_id = this.id;
            bean.time = R.isoDateTimeMillis(dayjs.utc());
            bean.status = DOWN;
            bean.downCount = previousBeat?.downCount || 0;

            if (this.isUpsideDown()) {
                bean.status = flipStatus(bean.status);
            }

            // Runtime patch timeout if it is 0 (keep in seconds)
            // See https://github.com/louislam/uptime-kuma/pull/3961#issuecomment-1804149144
            if (!this.timeout || this.timeout <= 0) {
                this.timeout = Math.max(1, Math.round((this.interval || 60) * 0.8));
            }

            try {
                if (await Monitor.isUnderMaintenance(this.id)) {
                    bean.msg = "Monitor under maintenance";
                    bean.status = MAINTENANCE;
                } else if (this.probe_id || (await R.getCell("SELECT probe_id FROM monitor_probe WHERE monitor_id = ? LIMIT 1", [this.id]))) {
                    const assignedProbeId = this.probe_id || (await R.getCell("SELECT probe_id FROM monitor_probe WHERE monitor_id = ? LIMIT 1", [this.id]));
                    // Delegated to remote distributed probe agent
                    const probe = await R.getRow("SELECT id, name, status, last_heartbeat FROM probe WHERE id = ?", [assignedProbeId]);
                    if (!probe || probe.status !== "online") {
                        bean.status = PENDING;
                        bean.msg = `Assigned Remote Probe #${assignedProbeId} (${probe?.name || "Unknown"}) is OFFLINE - Target State Unknown`;
                        bean.ping = null;
                    } else {
                        // Remote probe is online and actively executing checks
                        // Central server skips direct check to prevent false DOWN errors on private LAN targets
                        if (!this.isStop) {
                            this.heartbeatInterval = setTimeout(safeBeat, beatInterval * 1000);
                        }
                        return;
                    }
                } else if (this.type === "http" || this.type === "keyword" || this.type === "json-query") {
                    // Do not do any queries/high loading things before the "bean.ping"
                    let startTime = dayjs().valueOf();

                    // HTTP basic auth
                    let basicAuthHeader = {};
                    if (this.auth_method === "basic") {
                        basicAuthHeader = {
                            Authorization: "Basic " + encodeBase64(this.basic_auth_user, this.basic_auth_pass),
                        };
                    }

                    // Bearer token auth
                    let bearerAuthHeader = {};
                    if (this.auth_method === "bearer") {
                        bearerAuthHeader = {
                            Authorization: "Bearer " + this.bearer_token,
                        };
                    }

                    // OIDC: Basic client credential flow.
                    // Additional grants might be implemented in the future
                    let oauth2AuthHeader = {};
                    if (this.auth_method === "oauth2-cc") {
                        try {
                            if (
                                this.oauthAccessToken === undefined ||
                                new Date(this.oauthAccessToken.expires_at * 1000) <= new Date()
                            ) {
                                this.oauthAccessToken = await this.makeOidcTokenClientCredentialsRequest();
                            }
                            oauth2AuthHeader = {
                                Authorization:
                                    this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                            };
                        } catch (e) {
                            throw new Error("The oauth config is invalid. " + e.message);
                        }
                    }

                    let agentFamily = undefined;
                    if (this.ipFamily === "ipv4") {
                        agentFamily = 4;
                    }
                    if (this.ipFamily === "ipv6") {
                        agentFamily = 6;
                    }

                    const httpsAgentOptions = {
                        maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                        rejectUnauthorized: !this.getIgnoreTls(),
                        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {}),
                    };

                    const httpAgentOptions = {
                        maxCachedSessions: 0,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {}),
                    };

                    log.debug("monitor", `[${this.name}] Prepare Options for axios`);

                    let contentType = null;
                    let bodyValue = null;

                    if (this.body && typeof this.body === "string" && this.body.trim().length > 0) {
                        if (!this.httpBodyEncoding || this.httpBodyEncoding === "json") {
                            try {
                                bodyValue = JSON.parse(this.body);
                                contentType = "application/json";
                            } catch (e) {
                                throw new Error("Your JSON body is invalid. " + e.message);
                            }
                        } else if (this.httpBodyEncoding === "form") {
                            bodyValue = this.body;
                            contentType = "application/x-www-form-urlencoded";
                        } else if (this.httpBodyEncoding === "xml") {
                            bodyValue = this.body;
                            contentType = "text/xml; charset=utf-8";
                        }
                    }

                    // Axios Options
                    const options = {
                        url: this.url,
                        method: (this.method || "get").toLowerCase(),
                        timeout: this.timeout * 1000,
                        headers: {
                            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            ...(contentType ? { "Content-Type": contentType } : {}),
                            ...basicAuthHeader,
                            ...bearerAuthHeader,
                            ...oauth2AuthHeader,
                            ...(this.headers ? JSON.parse(this.headers) : {}),
                        },
                        maxRedirects: this.maxredirects,
                        validateStatus: (status) => {
                            return checkStatusCode(status, this.getAcceptedStatuscodes());
                        },
                        signal: axiosAbortSignal((this.timeout + 10) * 1000),
                    };

                    if (bodyValue) {
                        options.data = bodyValue;
                    }

                    if (this.cacheBust) {
                        const randomFloatString = Math.random().toString(36);
                        const cacheBust = randomFloatString.substring(2);
                        options.params = {
                            uptime_kuma_cachebuster: cacheBust,
                        };
                    }

                    if (this.proxy_id) {
                        const proxy = await R.load("proxy", this.proxy_id);

                        if (proxy && proxy.active) {
                            const { httpAgent, httpsAgent } = Proxy.createAgents(proxy, {
                                httpsAgentOptions: httpsAgentOptions,
                                httpAgentOptions: httpAgentOptions,
                            });

                            options.proxy = false;
                            options.httpAgent = httpAgent;
                            options.httpsAgent = httpsAgent;
                        }
                    }

                    if (!options.httpAgent) {
                        options.httpAgent = new http.Agent(httpAgentOptions);
                    }

                    if (!options.httpsAgent) {
                        let jar = new CookieJar();
                        let httpsCookieAgentOptions = {
                            ...httpsAgentOptions,
                            cookies: { jar },
                        };
                        options.httpsAgent = new HttpsCookieAgent(httpsCookieAgentOptions);
                    }

                    if (this.auth_method === "mtls") {
                        if (this.tlsCert !== null && this.tlsCert !== "") {
                            options.httpsAgent.options.cert = Buffer.from(this.tlsCert);
                        }
                        if (this.tlsCa !== null && this.tlsCa !== "") {
                            options.httpsAgent.options.ca = Buffer.from(this.tlsCa);
                        }
                        if (this.tlsKey !== null && this.tlsKey !== "") {
                            options.httpsAgent.options.key = Buffer.from(this.tlsKey);
                        }
                    }

                    let tlsInfo = {};
                    // Store tlsInfo when secureConnect event is emitted
                    // The keylog event listener is a workaround to access the tlsSocket
                    options.httpsAgent.once("keylog", async (line, tlsSocket) => {
                        tlsSocket.once("secureConnect", async () => {
                            tlsInfo = checkCertificate(tlsSocket);
                            tlsInfo.valid = tlsSocket.authorized || false;
                            tlsInfo.hostnameMatchMonitorUrl = checkCertificateHostname(
                                tlsInfo.certInfo.raw,
                                this.getUrl()?.hostname
                            );

                            await this.handleTlsInfo(tlsInfo);
                        });
                    });

                    log.debug("monitor", `[${this.name}] Axios Options: ${JSON.stringify(options)}`);
                    log.debug("monitor", `[${this.name}] Axios Request`);

                    // Make Request
                    let res = await this.makeAxiosRequest(options);

                    bean.msg = `${res.status} - ${res.statusText}`;
                    bean.ping = dayjs().valueOf() - startTime;

                    // in the frontend, the save response is only shown if the saveErrorResponse is set
                    if (this.getSaveResponse() && this.getSaveErrorResponse()) {
                        await this.saveResponseData(bean, res.data);
                    }

                    // fallback for if kelog event is not emitted, but we may still have tlsInfo,
                    // e.g. if the connection is made through a proxy
                    if (this.getUrl()?.protocol === "https:" && tlsInfo.valid === undefined) {
                        const tlsSocket = res.request.res.socket;

                        if (tlsSocket) {
                            tlsInfo = checkCertificate(tlsSocket);
                            tlsInfo.valid = tlsSocket.authorized || false;
                            tlsInfo.hostnameMatchMonitorUrl = checkCertificateHostname(
                                tlsInfo.certInfo.raw,
                                this.getUrl()?.hostname
                            );

                            await this.handleTlsInfo(tlsInfo);
                        }
                    }

                    // eslint-disable-next-line eqeqeq
                    if (process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID == this.id) {
                        log.info("monitor", res.data);
                    }

                    if (this.type === "http") {
                        bean.status = UP;
                    } else if (this.type === "keyword") {
                        let data = res.data;

                        // Convert to string for object/array
                        if (typeof data !== "string") {
                            data = JSON.stringify(data);
                        }

                        let keywordFound = data.includes(this.keyword);
                        if (keywordFound === !this.isInvertKeyword()) {
                            bean.msg += ", keyword " + (keywordFound ? "is" : "not") + " found";
                            bean.status = UP;
                        } else {
                            data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
                            if (data.length > 50) {
                                data = data.substring(0, 47) + "...";
                            }
                            throw new Error(
                                bean.msg +
                                    ", but keyword is " +
                                    (keywordFound ? "present" : "not") +
                                    " in [" +
                                    data +
                                    "]"
                            );
                        }
                    } else if (this.type === "json-query") {
                        let data = res.data;

                        const { status, response } = await evaluateJsonQuery(
                            data,
                            this.jsonPath,
                            this.jsonPathOperator,
                            this.expectedValue
                        );

                        if (status) {
                            bean.status = UP;
                            bean.msg = `JSON query passes (comparing ${response} ${this.jsonPathOperator} ${this.expectedValue})`;
                        } else {
                            throw new Error(
                                `JSON query does not pass (comparing ${response} ${this.jsonPathOperator} ${this.expectedValue})`
                            );
                        }
                    }
                } else if (this.type === "ping") {
                    const pingTimeout = Math.min(Math.max(1, Number(this.timeout) || 3), 30);
                    const pingRes = await ping(
                        this.hostname,
                        this.ping_count || 1,
                        "",
                        this.ping_numeric !== undefined ? this.ping_numeric : true,
                        this.packetSize || 32,
                        pingTimeout,
                        this.ping_per_request_timeout || 2
                    );

                    const pingMs = typeof pingRes === "object" ? pingRes.time : pingRes;
                    const isDegraded = typeof pingRes === "object" && Boolean(pingRes.degraded);
                    const packetLoss = typeof pingRes === "object" && pingRes.packetLoss !== undefined ? pingRes.packetLoss : 0;

                    bean.ping = pingMs;
                    if (isDegraded) {
                        bean.status = PENDING; // WARNING / DEGRADED
                        bean.msg = pingRes.msg || `Degraded ICMP connectivity to ${this.hostname || "target"}. Latency: ${pingMs} ms. Packet loss: ${packetLoss}%.`;
                    } else {
                        bean.status = UP;
                        bean.msg = `ICMP echo response received from ${this.hostname || "target"}. Latency: ${pingMs} ms. Packet loss: 0%.`;
                    }
                } else if (this.type === "push") {
                    // Type: Push
                    log.debug(
                        "monitor",
                        `[${this.name}] Checking monitor at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`
                    );
                    const bufferTime = 1000; // 1s buffer to accommodate clock differences

                    if (previousBeat) {
                        const msSinceLastBeat = dayjs.utc().valueOf() - dayjs.utc(previousBeat.time).valueOf();

                        log.debug("monitor", `[${this.name}] msSinceLastBeat = ${msSinceLastBeat}`);

                        // If the previous beat was down or pending we use the regular
                        // beatInterval/retryInterval in the setTimeout further below
                        if (
                            previousBeat.status !== (this.isUpsideDown() ? DOWN : UP) ||
                            msSinceLastBeat > beatInterval * 1000 + bufferTime
                        ) {
                            bean.duration = Math.round(msSinceLastBeat / 1000);
                            throw new Error("No heartbeat in the time window");
                        } else {
                            let timeout = beatInterval * 1000 - msSinceLastBeat;
                            if (timeout < 0) {
                                timeout = bufferTime;
                            } else {
                                timeout += bufferTime;
                            }
                            // No need to insert successful heartbeat for push type, so end here
                            retries = 0;
                            log.debug("monitor", `[${this.name}] timeout = ${timeout}`);
                            this.heartbeatInterval = setTimeout(safeBeat, timeout);
                            return;
                        }
                    } else {
                        bean.duration = beatInterval;
                        throw new Error("No heartbeat in the time window");
                    }
                } else if (this.type === "docker") {
                    log.debug("monitor", `[${this.name}] Prepare Options for Axios`);

                    const options = {
                        url: `/containers/${this.docker_container}/json`,
                        timeout: this.interval * 1000 * 0.8,
                        headers: {
                            Accept: "*/*",
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
                            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        }),
                        httpAgent: new http.Agent({
                            maxCachedSessions: 0,
                        }),
                    };

                    const dockerHost = await R.load("docker_host", this.docker_host);

                    if (!dockerHost) {
                        throw new Error("Failed to load docker host config");
                    }

                    if (dockerHost._dockerType === "socket") {
                        options.socketPath = dockerHost._dockerDaemon;
                    } else if (dockerHost._dockerType === "tcp") {
                        options.baseURL = DockerHost.patchDockerURL(dockerHost._dockerDaemon);
                        options.httpsAgent = new https.Agent(
                            await DockerHost.getHttpsAgentOptions(dockerHost._dockerType, options.baseURL)
                        );
                    }

                    log.debug("monitor", `[${this.name}] Axios Request`);
                    let res = await axios.request(options);

                    if (!res.data.State) {
                        throw Error("Container state is not available");
                    }
                    if (!res.data.State.Running) {
                        throw Error("Container State is " + res.data.State.Status);
                    }
                    if (res.data.State.Paused) {
                        throw Error("Container is in a paused state");
                    }
                    if (res.data.State.Restarting) {
                        bean.status = PENDING;
                        bean.msg = "Container is reporting it is currently restarting";
                    } else if (res.data.State.Health && res.data.State.Health.Status !== "none") {
                        // if healthchecks are disabled (?), Health MAY not be present
                        if (res.data.State.Health.Status === "healthy") {
                            bean.status = UP;
                            bean.msg = "healthy";
                        } else if (res.data.State.Health.Status === "unhealthy") {
                            throw Error("Container State is unhealthy according to its healthcheck");
                        } else {
                            bean.status = PENDING;
                            bean.msg = res.data.State.Health.Status;
                        }
                    } else {
                        bean.status = UP;
                        bean.msg = `Container has not reported health and is currently ${res.data.State.Status}. As it is running, it is considered UP. Consider adding a health check for better service visibility`;
                    }
                } else if (this.type === "radius") {
                    let startTime = dayjs().valueOf();

                    // Handle monitors that were created before the
                    // update and as such don't have a value for
                    // this.port.
                    let port;
                    if (this.port == null) {
                        port = 1812;
                    } else {
                        port = this.port;
                    }

                    const resp = await radius(
                        this.hostname,
                        this.radiusUsername,
                        this.radiusPassword,
                        this.radiusCalledStationId,
                        this.radiusCallingStationId,
                        this.radiusSecret,
                        port,
                        this.interval * 1000 * 0.4
                    );

                    bean.msg = resp.code;
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type in UptimeKumaServer.monitorTypeList) {
                    let startTime = dayjs().valueOf();
                    const monitorType = UptimeKumaServer.monitorTypeList[this.type];
                    await monitorType.check(this, bean, UptimeKumaServer.getInstance());

                    if (!monitorType.allowCustomStatus && bean.status !== UP) {
                        throw new Error(
                            "The monitor implementation is incorrect, non-UP error must throw error inside check()"
                        );
                    }

                    if (bean.ping === undefined || bean.ping === null) {
                        bean.ping = dayjs().valueOf() - startTime;
                    }
                } else if (this.type === "kafka-producer") {
                    let startTime = dayjs().valueOf();

                    bean.msg = await kafkaProducerAsync(
                        JSON.parse(this.kafkaProducerBrokers),
                        this.kafkaProducerTopic,
                        this.kafkaProducerMessage,
                        {
                            allowAutoTopicCreation: this.kafkaProducerAllowAutoTopicCreation,
                            ssl: this.kafkaProducerSsl,
                            clientId: `Uptime-Kuma/${version}`,
                            interval: this.interval,
                            connectionTimeout: this.timeout,
                        },
                        JSON.parse(this.kafkaProducerSaslOptions)
                    );
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else {
                    throw new Error("Unknown Monitor Type");
                }

                if (this.isUpsideDown()) {
                    bean.status = flipStatus(bean.status);

                    if (bean.status === DOWN) {
                        throw new Error("Flip UP to DOWN");
                    }
                }

                retries = 0;
            } catch (error) {
                const errMsg = error ? (error.message || String(error)) : "Unknown check failure";
                const isExecFailure = error?.isExecutionFailure ||
                    errMsg.includes("permission denied") ||
                    errMsg.includes("Operation not permitted") ||
                    errMsg.includes("execution error");
                const isDnsFailure = error?.isDnsFailure ||
                    errMsg.includes("DNS resolution failed") ||
                    errMsg.includes("could not find host") ||
                    errMsg.includes("Name or service not known");

                if (error?.name === "CanceledError") {
                    bean.msg = `Request timed out after ${this.timeout}s`;
                } else if (isExecFailure) {
                    bean.msg = errMsg;
                } else if (isDnsFailure) {
                    bean.msg = errMsg;
                } else if (this.type === "ping") {
                    bean.msg = errMsg.includes("ICMP") ? errMsg : `ICMP request timed out for ${this.hostname || "target"}. No reply received.`;
                } else if (this.type === "port") {
                    bean.msg = `TCP connection failed to ${this.hostname}:${this.port}. ${errMsg}`;
                } else if (this.type === "http" || this.type === "keyword" || this.type === "json-query") {
                    bean.msg = `HTTP check failed: ${errMsg}`;
                } else {
                    bean.msg = errMsg;
                }

                if (this.getSaveErrorResponse() && error?.response?.data !== undefined) {
                    await this.saveResponseData(bean, error.response.data);
                }

                // If UP come in here, it must be upside down mode
                // Just reset the retries
                if (this.isUpsideDown() && bean.status === UP) {
                    retries = 0;
                } else if (isExecFailure) {
                    // Execution worker / local infrastructure failure: target state is UNKNOWN / PENDING, not target DOWN
                    retries++;
                    bean.status = PENDING;
                } else if (this.type === "json-query" && this.retry_only_on_status_code_failure) {
                    const isJsonQueryError =
                        typeof errMsg === "string" && errMsg.includes("JSON query does not pass");

                    if (isJsonQueryError) {
                        retries = 0;
                    } else if (this.maxretries > 0 && retries < this.maxretries) {
                        retries++;
                        bean.status = PENDING;
                    } else {
                        retries++;
                    }
                } else {
                    // General retry logic for confirmed target failures
                    if (this.maxretries > 0 && retries < this.maxretries) {
                        retries++;
                        bean.status = PENDING;
                    } else {
                        retries++;
                    }
                }
            }

            bean.retries = retries;

            // Accurately track consecutive down count across state transitions
            if (bean.status === DOWN) {
                const prevDown = previousBeat ? (previousBeat.down_count !== undefined ? Number(previousBeat.down_count) : (previousBeat.downCount ? Number(previousBeat.downCount) : 0)) : 0;
                bean.down_count = prevDown + 1;
                bean.downCount = bean.down_count;
            } else if (bean.status === UP) {
                bean.down_count = 0;
                bean.downCount = 0;
            } else {
                const prevDown = previousBeat ? (previousBeat.down_count !== undefined ? Number(previousBeat.down_count) : (previousBeat.downCount ? Number(previousBeat.downCount) : 0)) : 0;
                bean.down_count = prevDown;
                bean.downCount = prevDown;
            }

            log.debug("monitor", `[${this.name}] Check isImportant`);
            let isImportant = Monitor.isImportantBeat(isFirstBeat, previousBeat?.status, bean.status);

            // Mark as important if status changed, ignore pending pings,
            // Don't notify if disrupted changes to up
            if (isImportant) {
                bean.important = true;

                if (Monitor.isImportantForNotification(isFirstBeat, previousBeat?.status, bean.status)) {
                    log.debug("monitor", `[${this.name}] sendNotification`);
                    await Monitor.sendNotification(isFirstBeat, this, bean);
                } else {
                    log.debug(
                        "monitor",
                        `[${this.name}] will not sendNotification because it is (or was) under maintenance`
                    );
                }

                // Clear Status Page Cache
                log.debug("monitor", `[${this.name}] apicache clear`);
                apicache.clear();

                await UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);
            } else {
                bean.important = false;

                if (bean.status === DOWN && this.resendInterval > 0) {
                    if (bean.down_count > 0 && (bean.down_count % this.resendInterval === 0)) {
                        // Send notification again, because we are still DOWN
                        log.debug(
                            "monitor",
                            `[${this.name}] sendNotification again: Down Count: ${bean.down_count} | Resend Interval: ${this.resendInterval}`
                        );
                        await Monitor.sendNotification(isFirstBeat, this, bean);
                    }
                }
            }

            // InfiniNOC Guaranteed State Machine Reconciliation: Always sync Active Alerts and Incidents to ground truth
            const orgId = this.organization_id || 1;
            const isoNow = toSqlDatetime();
            const monTarget = this.hostname || this.url || `Target #${this.id}`;
            const monType = (this.type || "TARGET").toUpperCase();

            if (bean.status === DOWN) {
                try {
                    const failureReason = bean.msg || `Target ${this.name} (${monTarget}) is DOWN`;

                    // 1. Ensure Active Incident exists for this outage
                    const existingInc = await R.getRow(
                        `SELECT incident.id FROM incident 
                        JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                        WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                        AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                        AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                        [orgId, this.id]
                    );

                    if (!existingInc) {
                        await Incident.createIncident(
                            {
                                title: `[OUTAGE] Monitor #${this.id} (${this.name}) is DOWN`,
                                description: `Automated NOC Outage Incident raised for ${this.name}. Target: ${monTarget}. Protocol: ${monType}. Failure Reason: ${failureReason}`,
                                failure_reason: failureReason,
                                severity: "P1",
                                links: [{ entity_type: "monitor", entity_id: this.id }],
                            },
                            orgId,
                            this.user_id
                        );
                        io.emit("updateIncidentStats");
                    }

                    // 2. Ensure Active Alert exists for this outage
                    const existingAlert = await R.getRow(
                        "SELECT id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                        [orgId, this.id]
                    );

                    if (!existingAlert) {
                        const alertMsg = `Monitor #${this.id} (${this.name}) is DOWN: ${failureReason}`;
                        await R.exec(
                            `INSERT INTO active_alert (
                                organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
                            ) VALUES (?, 0, 'monitor', ?, 'monitor_down', 'CRITICAL', 0, ?, ?, ?, ?, ?)`,
                            [orgId, this.id, alertMsg, isoNow, isoNow, isoNow, isoNow]
                        );
                        io.emit("updateActiveAlerts");
                    }
                } catch (e) {
                    log.error("monitor", "Auto incident & alert creation failed: " + e.message);
                }
            } else if (bean.status === UP) {
                try {
                    // 1. Auto-resolve ANY Open Incidents for this monitor
                    const openIncidents = await R.getAll(
                        `SELECT incident.id FROM incident 
                        JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                        WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                        AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                        AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                        [orgId, this.id]
                    );

                    for (const inc of openIncidents) {
                        await R.exec(
                            "UPDATE incident SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE id = ?",
                            [isoNow, isoNow, inc.id]
                        );
                        await R.exec(
                            "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'resolved', 'Auto resolved on monitor recovery (UP)', ?)",
                            [orgId, inc.id, null, isoNow]
                        );
                    }
                    if (openIncidents.length > 0) {
                        io.emit("updateIncidentStats");
                    }

                    // 2. Auto-resolve Active Alert for this monitor
                    const existingAlert = await R.getRow(
                        "SELECT * FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                        [orgId, this.id]
                    );
                    if (existingAlert) {
                        const recoveryMsg = `[RECOVERED] Monitor #${this.id} (${this.name}) returned to service (UP)`;
                        await R.exec(
                            "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, ?, 'RECOVERED', ?, ?)",
                            [orgId, existingAlert.id, existingAlert.rule_id || 0, recoveryMsg, isoNow]
                        );
                        await R.exec("DELETE FROM active_alert WHERE id = ?", [existingAlert.id]);
                        io.emit("updateActiveAlerts");
                    }
                } catch (e) {
                    log.error("monitor", "Auto incident & alert resolution failed: " + e.message);
                }
            }

            if (bean.status !== MAINTENANCE && Boolean(this.domainExpiryNotification)) {
                try {
                    const supportInfo = await DomainExpiry.checkSupport(this);
                    const domainExpiryDate = await DomainExpiry.checkExpiry(supportInfo.domain);
                    if (domainExpiryDate) {
                        DomainExpiry.sendNotifications(
                            supportInfo.domain,
                            (await Monitor.getNotificationList(this)) || []
                        );
                    } else {
                        log.debug("monitor", `Failed getting expiration date for domain ${supportInfo.domain}`);
                    }
                } catch (error) {
                    if (
                        error.message === "domain_expiry_unsupported_unsupported_tld_no_rdap_endpoint" &&
                        Boolean(this.domainExpiryNotification)
                    ) {
                        log.warn(
                            "domain_expiry",
                            `Domain expiry unsupported for '.${error.meta.publicSuffix}' because it lacks an RDAP endpoint in the IANA database. This isn’t an Uptime Kuma bug, a limitation of your registry. If an RDAP server exists, ask your registrar politely to submit it to IANA so expiry checks can work.`
                        );
                    }
                }
            }

            if (bean.status === UP) {
                log.debug(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Successful Response: ${bean.ping} ms | Interval: ${beatInterval} seconds | Type: ${this.type}`
                );
            } else if (bean.status === PENDING) {
                if (this.retryInterval > 0) {
                    beatInterval = this.retryInterval;
                }
                log.warn(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Pending: ${bean.msg} | Max retries: ${this.maxretries} | Retry: ${retries} | Retry Interval: ${beatInterval} seconds | Type: ${this.type}`
                );
            } else if (bean.status === MAINTENANCE) {
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Under Maintenance | Type: ${this.type}`);
            } else {
                log.error(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Failing: ${bean.msg} | Interval: ${beatInterval} seconds | Type: ${this.type} | Down Count: ${bean.down_count} | Resend Interval: ${this.resendInterval}`
                );
            }

            // Calculate uptime
            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(this.id);
            let endTimeDayjs = await uptimeCalculator.update(bean.status, parseFloat(bean.ping));
            bean.end_time = R.isoDateTimeMillis(endTimeDayjs);

            // Send to frontend
            log.debug("monitor", `[${this.name}] Send to socket`);
            io.to(this.user_id).emit("heartbeat", bean.toJSON());
            Monitor.sendStats(io, this.id, this.user_id);

            // Store to database
            log.debug("monitor", `[${this.name}] Store`);
            await R.store(bean);

            log.debug("monitor", `[${this.name}] prometheus.update`);
            const data24h = uptimeCalculator.get24Hour();
            const data30d = uptimeCalculator.get30Day();
            const data1y = uptimeCalculator.get1Year();
            this.prometheus?.update(bean, tlsInfo, { data24h, data30d, data1y });

            previousBeat = bean;

            if (!this.isStop) {
                log.debug("monitor", `[${this.name}] SetTimeout for next check.`);

                let intervalRemainingMs = Math.max(1, beatInterval * 1000 - dayjs().diff(dayjs.utc(bean.time)));

                log.debug("monitor", `[${this.name}] Next heartbeat in: ${intervalRemainingMs}ms`);

                this.heartbeatInterval = setTimeout(safeBeat, intervalRemainingMs);
            } else {
                log.info("monitor", `[${this.name}] isStop = true, no next check.`);
            }
        };

        /**
         * Get a heartbeat and handle errors7
         * @returns {void}
         */
        const safeBeat = async () => {
            try {
                await beat();
            } catch (e) {
                console.trace(e);
                UptimeKumaServer.errorLog(e, false);
                log.error("monitor", "Please report to https://github.com/louislam/uptime-kuma/issues");

                if (!this.isStop) {
                    log.info("monitor", "Try to restart the monitor");
                    this.heartbeatInterval = setTimeout(safeBeat, this.interval * 1000);
                }
            }
        };

        // Delay Push Type
        if (this.type === "push") {
            this.heartbeatInterval = setTimeout(() => {
                safeBeat();
            }, this.interval * 1000);
        } else {
            safeBeat();
        }
    }

    /**
     * Save response body to a heartbeat if response saving is enabled.
     * @param {import("redbean-node").Bean} bean Heartbeat bean to populate.
     * @param {unknown} data Response payload.
     * @returns {void}
     */
    async saveResponseData(bean, data) {
        if (data === undefined) {
            return;
        }

        let responseData = data;
        if (typeof responseData !== "string") {
            try {
                responseData = JSON.stringify(responseData);
            } catch (error) {
                responseData = String(responseData);
            }
        }

        const maxSize = this.response_max_length ?? RESPONSE_BODY_LENGTH_DEFAULT;
        if (responseData.length > maxSize) {
            responseData = responseData.substring(0, maxSize) + "... (truncated)";
        }

        // Offload brotli compression from main event loop to libuv thread pool
        bean.response = (await brotliCompress(Buffer.from(responseData, "utf8"))).toString("base64");
    }

    /**
     * Make a request using axios
     * @param {object} options Options for Axios
     * @param {boolean} finalCall Should this be the final call i.e
     * don't retry on failure
     * @returns {object} Axios response
     */
    async makeAxiosRequest(options, finalCall = false) {
        try {
            let res;
            if (this.auth_method === "ntlm") {
                options.httpsAgent.keepAlive = true;
                options.httpAgent.keepAlive = true;

                res = await httpNtlm(options, {
                    username: this.basic_auth_user,
                    password: this.basic_auth_pass,
                    domain: this.authDomain,
                    workstation: this.authWorkstation ? this.authWorkstation : undefined,
                });
            } else {
                res = await axios.request(options);
            }

            return res;
        } catch (error) {
            /**
             * Make a single attempt to obtain an new access token in the event that
             * the recent api request failed for authentication purposes
             */
            if (this.auth_method === "oauth2-cc" && error.response.status === 401 && !finalCall) {
                this.oauthAccessToken = await this.makeOidcTokenClientCredentialsRequest();
                let oauth2AuthHeader = {
                    Authorization: this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                };
                options.headers = { ...options.headers, ...oauth2AuthHeader };

                return this.makeAxiosRequest(options, true);
            }

            // Fix #2253
            // Read more: https://stackoverflow.com/questions/1759956/curl-error-18-transfer-closed-with-outstanding-read-data-remaining
            if (
                !finalCall &&
                typeof error.message === "string" &&
                error.message.includes("maxContentLength size of -1 exceeded")
            ) {
                log.debug("monitor", "makeAxiosRequest with gzip");
                options.headers["Accept-Encoding"] = "gzip, deflate";
                return this.makeAxiosRequest(options, true);
            } else {
                if (
                    typeof error.message === "string" &&
                    error.message.includes("maxContentLength size of -1 exceeded")
                ) {
                    error.message = "response timeout: incomplete response within a interval";
                }
                throw error;
            }
        }
    }

    /**
     * Stop monitor
     * @returns {Promise<void>}
     */
    async stop() {
        clearTimeout(this.heartbeatInterval);
        this.isStop = true;

        this.prometheus?.remove();
    }

    /**
     * Get prometheus instance
     * @returns {Prometheus|undefined} Current prometheus instance
     */
    getPrometheus() {
        return this.prometheus;
    }

    /**
     * Helper Method:
     * returns URL object for further usage
     * returns null if url is invalid
     * @returns {(null|URL)} Monitor URL
     */
    getUrl() {
        try {
            return new URL(this.url);
        } catch (_) {
            return null;
        }
    }

    /**
     * Example: http: or https:
     * @returns {(null|string)} URL's protocol
     */
    getURLProtocol() {
        const url = this.getUrl();
        if (url) {
            return this.getUrl().protocol;
        } else {
            return null;
        }
    }

    /**
     * Store TLS info to database
     * @param {object} checkCertificateResult Certificate to update
     * @returns {Promise<object>} Updated certificate
     */
    async updateTlsInfo(checkCertificateResult) {
        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [this.id]);

        if (tlsInfoBean == null) {
            tlsInfoBean = R.dispense("monitor_tls_info");
            tlsInfoBean.monitor_id = this.id;
        } else {
            // Clear sent history if the cert changed.
            try {
                let oldCertInfo = JSON.parse(tlsInfoBean.info_json);

                let isValidObjects =
                    oldCertInfo && oldCertInfo.certInfo && checkCertificateResult && checkCertificateResult.certInfo;

                if (isValidObjects) {
                    if (oldCertInfo.certInfo.fingerprint256 !== checkCertificateResult.certInfo.fingerprint256) {
                        log.debug("monitor", "Resetting sent_history");
                        await R.exec(
                            "DELETE FROM notification_sent_history WHERE type = 'certificate' AND monitor_id = ?",
                            [this.id]
                        );
                    } else {
                        log.debug("monitor", "No need to reset sent_history");
                        log.debug("monitor", oldCertInfo.certInfo.fingerprint256);
                        log.debug("monitor", checkCertificateResult.certInfo.fingerprint256);
                    }
                } else {
                    log.debug("monitor", "Not valid object");
                }
            } catch (e) {}
        }

        tlsInfoBean.info_json = JSON.stringify(checkCertificateResult);
        await R.store(tlsInfoBean);

        return checkCertificateResult;
    }

    /**
     * Checks if the monitor is active based on itself and its parents
     * @param {number} monitorID ID of monitor to send
     * @param {boolean} active is active
     * @returns {Promise<boolean>} Is the monitor active?
     */
    static async isActive(monitorID, active) {
        const parentActive = await Monitor.isParentActive(monitorID);

        return active === 1 && parentActive;
    }

    /**
     * Send statistics to clients
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendStats(io, monitorID, userID) {
        const hasClients = getTotalClientInRoom(io, userID) > 0;
        let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);

        if (hasClients) {
            // Send 24 hour average ping
            let data24h = await uptimeCalculator.get24Hour();
            io.to(userID).emit("avgPing", monitorID, data24h.avgPing ? Number(data24h.avgPing.toFixed(2)) : null);

            // Send 24 hour uptime
            io.to(userID).emit("uptime", monitorID, 24, data24h.uptime);

            // Send 30 day uptime
            let data30d = await uptimeCalculator.get30Day();
            io.to(userID).emit("uptime", monitorID, 720, data30d.uptime);

            // Send 1-year uptime
            let data1y = await uptimeCalculator.get1Year();
            io.to(userID).emit("uptime", monitorID, "1y", data1y.uptime);

            // Send Cert Info
            await Monitor.sendCertInfo(io, monitorID, userID);

            // Send domain info
            await Monitor.sendDomainInfo(io, monitorID, userID);
        } else {
            log.debug("monitor", "No clients in the room, no need to send stats");
        }
    }

    /**
     * Send certificate information to client
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendCertInfo(io, monitorID, userID) {
        let tlsInfo = await R.findOne("monitor_tls_info", "monitor_id = ?", [monitorID]);
        if (tlsInfo != null) {
            io.to(userID).emit("certInfo", monitorID, tlsInfo.info_json);
        }
    }

    /**
     * Send domain name information to client
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendDomainInfo(io, monitorID, userID) {
        const monitor = await R.findOne("monitor", "id = ?", [monitorID]);

        try {
            const supportInfo = await DomainExpiry.checkSupport(monitor);
            const domain = await DomainExpiry.findByDomainNameOrCreate(supportInfo.domain);
            if (domain?.expiry) {
                io.to(userID).emit("domainInfo", monitorID, domain.daysRemaining, new Date(domain.expiry));
            }
        } catch (e) {}
    }

    /**
     * Has status of monitor changed since last beat?
     * @param {boolean} isFirstBeat Is this the first beat of this monitor?
     * @param {const} previousBeatStatus Status of the previous beat
     * @param {const} currentBeatStatus Status of the current beat
     * @returns {boolean} True if is an important beat else false
     */
    static isImportantBeat(isFirstBeat, previousBeatStatus, currentBeatStatus) {
        // * ? -> ANY STATUS = important [isFirstBeat]
        // UP -> PENDING = not important
        // * UP -> DOWN = important
        // UP -> UP = not important
        // PENDING -> PENDING = not important
        // * PENDING -> DOWN = important
        // PENDING -> UP = not important
        // DOWN -> PENDING = this case not exists
        // DOWN -> DOWN = not important
        // * DOWN -> UP = important
        // MAINTENANCE -> MAINTENANCE = not important
        // * MAINTENANCE -> UP = important
        // * MAINTENANCE -> DOWN = important
        // * DOWN -> MAINTENANCE = important
        // * UP -> MAINTENANCE = important
        return (
            isFirstBeat ||
            (previousBeatStatus === DOWN && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === UP && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === UP) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN)
        );
    }

    /**
     * Is this beat important for notifications?
     * @param {boolean} isFirstBeat Is this the first beat of this monitor?
     * @param {const} previousBeatStatus Status of the previous beat
     * @param {const} currentBeatStatus Status of the current beat
     * @returns {boolean} True if is an important beat else false
     */
    static isImportantForNotification(isFirstBeat, previousBeatStatus, currentBeatStatus) {
        // * ? -> ANY STATUS = important [isFirstBeat]
        // UP -> PENDING = not important
        // * UP -> DOWN = important
        // UP -> UP = not important
        // PENDING -> PENDING = not important
        // * PENDING -> DOWN = important
        // PENDING -> UP = not important
        // DOWN -> PENDING = this case not exists
        // DOWN -> DOWN = not important
        // * DOWN -> UP = important
        // MAINTENANCE -> MAINTENANCE = not important
        // MAINTENANCE -> UP = not important
        // * MAINTENANCE -> DOWN = important
        // DOWN -> MAINTENANCE = not important
        // UP -> MAINTENANCE = not important
        return (
            isFirstBeat ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN)
        );
    }

    /**
     * Send a notification about a monitor
     * @param {boolean} isFirstBeat Is this beat the first of this monitor?
     * @param {Monitor} monitor The monitor to send a notification about
     * @param {import("./heartbeat")} bean Status information about monitor
     * @returns {Promise<void>}
     */
    static async sendNotification(isFirstBeat, monitor, bean) {
        if (!isFirstBeat || bean.status === DOWN) {
            const notificationList = await Monitor.getNotificationList(monitor);

            let text;
            if (bean.status === UP) {
                text = "✅ Up";
            } else {
                text = "🔴 Down";
            }

            let msg = `[${monitor.name}] [${text}] ${bean.msg}`;

            const heartbeatJSON = await bean.toJSONAsync({ decodeResponse: true });
            const monitorData = [{ id: monitor.id, active: monitor.active, name: monitor.name }];
            const preloadData = await Monitor.preparePreloadData(monitorData);
            // Prevent if the msg is undefined, notifications such as Discord cannot send out.
            if (!heartbeatJSON["msg"]) {
                heartbeatJSON["msg"] = "N/A";
            }

            // Also provide the time in server timezone
            heartbeatJSON["timezone"] = await UptimeKumaServer.getInstance().getTimezone();
            heartbeatJSON["timezoneOffset"] = UptimeKumaServer.getInstance().getTimezoneOffset();
            heartbeatJSON["localDateTime"] = dayjs
                .utc(heartbeatJSON["time"])
                .tz(heartbeatJSON["timezone"])
                .format(SQL_DATETIME_FORMAT);

            // Calculate downtime tracking information when service comes back up
            // This makes downtime information available to all notification providers
            if (bean.status === UP && monitor.id) {
                try {
                    // Filter by important = 1 to get the state transition heartbeat (e.g. UP→DOWN),
                    // not the most recent DOWN heartbeat which would be the last check before recovery.
                    const lastDownHeartbeat = await R.getRow(
                        "SELECT time FROM heartbeat WHERE monitor_id = ? AND status = ? AND important = 1 ORDER BY time DESC LIMIT 1",
                        [monitor.id, DOWN]
                    );

                    if (lastDownHeartbeat && lastDownHeartbeat.time) {
                        heartbeatJSON["lastDownTime"] = lastDownHeartbeat.time;
                    }
                } catch (error) {
                    // If we can't calculate downtime, just continue without it
                    // Silently fail to avoid disrupting notification sending
                    log.debug(
                        "monitor",
                        `[${monitor.name}] Could not calculate downtime information: ${error.message}`
                    );
                }
            }

            for (let notification of notificationList) {
                try {
                    await Notification.send(
                        JSON.parse(notification.config),
                        msg,
                        monitor.toJSON(preloadData, false),
                        heartbeatJSON
                    );
                } catch (e) {
                    log.error("monitor", "Cannot send notification to " + notification.name);
                    log.error("monitor", e);
                }
            }
        }
    }

    /**
     * Get list of notification providers for a given monitor
     * @param {Monitor} monitor Monitor to get notification providers for
     * @returns {Promise<LooseObject<any>[]>} List of notifications
     */
    static async getNotificationList(monitor) {
        let notificationList = await R.getAll(
            "SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id ",
            [monitor.id]
        );
        return notificationList;
    }

    /**
     * Send a certificate notification when certificate expires in less
     * than target days
     * @param {string} certCN  Common Name attribute from the certificate subject
     * @param {string} certType  certificate type
     * @param {number} daysRemaining Number of days remaining on certificate
     * @param {number} targetDays Number of days to alert after
     * @param {LooseObject<any>[]} notificationList List of notification providers
     * @returns {Promise<void>}
     */
    async sendCertNotificationByTargetDays(certCN, certType, daysRemaining, targetDays, notificationList) {
        let row = await R.getRow(
            "SELECT * FROM notification_sent_history WHERE type = ? AND monitor_id = ? AND days <= ?",
            ["certificate", this.id, targetDays]
        );

        // Sent already, no need to send again
        if (row) {
            log.debug("monitor", "Sent already, no need to send again");
            return;
        }

        let sent = false;
        log.debug("monitor", "Send certificate notification");

        for (let notification of notificationList) {
            try {
                log.debug("monitor", "Sending to " + notification.name);
                await Notification.send(
                    JSON.parse(notification.config),
                    `[${this.name}][${this.url}] ${certType} certificate ${certCN} will expire in ${daysRemaining} days`
                );
                sent = true;
            } catch (e) {
                log.error("monitor", "Cannot send cert notification to " + notification.name);
                log.error("monitor", e);
            }
        }

        if (sent) {
            await R.exec("INSERT INTO notification_sent_history (type, monitor_id, days) VALUES(?, ?, ?)", [
                "certificate",
                this.id,
                targetDays,
            ]);
        }
    }

    /**
     * Get the status of the previous heartbeat
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<LooseObject<any>>} Previous heartbeat
     */
    static async getPreviousHeartbeat(monitorID) {
        return await R.findOne("heartbeat", " id = (select MAX(id) from heartbeat where monitor_id = ?)", [monitorID]);
    }

    /**
     * Check if monitor is under maintenance
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<boolean>} Is the monitor under maintenance
     */
    static async isUnderMaintenance(monitorID) {
        const maintenanceIDList = await R.getCol(
            `
            SELECT maintenance_id FROM monitor_maintenance
            WHERE monitor_id = ?
        `,
            [monitorID]
        );

        for (const maintenanceID of maintenanceIDList) {
            const maintenance = await UptimeKumaServer.getInstance().getMaintenance(maintenanceID);
            if (maintenance && (await maintenance.isUnderMaintenance())) {
                return true;
            }
        }

        const parent = await Monitor.getParent(monitorID);
        if (parent != null) {
            return await Monitor.isUnderMaintenance(parent.id);
        }

        return false;
    }

    /**
     * Validate monitor configuration
     * @returns {void}
     * @throws {Error} If validation fails
     */
    validate() {
        if (this.interval < MIN_INTERVAL_SECOND) {
            throw new Error(`Interval cannot be less than ${MIN_INTERVAL_SECOND} seconds`);
        }

        if (this.retryInterval < MIN_INTERVAL_SECOND) {
            throw new Error(`Retry interval cannot be less than ${MIN_INTERVAL_SECOND} seconds`);
        }

        if (this.response_max_length !== undefined) {
            if (this.response_max_length < 0) {
                throw new Error(`Response max length cannot be less than 0`);
            }

            if (this.response_max_length > RESPONSE_BODY_LENGTH_MAX) {
                throw new Error(`Response max length cannot be more than ${RESPONSE_BODY_LENGTH_MAX} bytes`);
            }
        }

        // Validate JSON fields to prevent invalid JSON from being stored in database
        if (this.kafkaProducerBrokers) {
            try {
                JSON.parse(this.kafkaProducerBrokers);
            } catch (e) {
                throw new Error(`Kafka Producer Brokers must be valid JSON: ${e.message}`);
            }
        }

        if (this.kafkaProducerSaslOptions) {
            try {
                JSON.parse(this.kafkaProducerSaslOptions);
            } catch (e) {
                throw new Error(`Kafka Producer SASL Options must be valid JSON: ${e.message}`);
            }
        }

        if (this.rabbitmqNodes) {
            try {
                JSON.parse(this.rabbitmqNodes);
            } catch (e) {
                throw new Error(`RabbitMQ Nodes must be valid JSON: ${e.message}`);
            }
        }

        if (this.conditions) {
            try {
                JSON.parse(this.conditions);
            } catch (e) {
                throw new Error(`Conditions must be valid JSON: ${e.message}`);
            }
        }

        if (this.headers) {
            try {
                JSON.parse(this.headers);
            } catch (e) {
                throw new Error(`Headers must be valid JSON: ${e.message}`);
            }
        }

        if (this.accepted_statuscodes_json) {
            try {
                JSON.parse(this.accepted_statuscodes_json);
            } catch (e) {
                throw new Error(`Accepted status codes must be valid JSON: ${e.message}`);
            }
        }

        if (["system-service", "pm2"].includes(this.type)) {
            this.system_service_name = (this.system_service_name || "").trim();

            if (!this.system_service_name) {
                throw new Error(this.type === "pm2" ? "PM2 process name is required." : "Service Name is required.");
            }
        }

        if (this.type === "system-service" && !/^[a-zA-Z0-9._\-@]+$/.test(this.system_service_name)) {
            throw new Error("Invalid service name. Please use the internal Service Name (no spaces).");
        }

        if (this.type === "pm2" && /[\u0000-\u001F\u007F]/.test(this.system_service_name)) {
            throw new Error("Invalid PM2 process name.");
        }

        if (this.type === "ping") {
            // ping parameters validation
            if (this.packetSize && (this.packetSize < PING_PACKET_SIZE_MIN || this.packetSize > PING_PACKET_SIZE_MAX)) {
                throw new Error(
                    `Packet size must be between ${PING_PACKET_SIZE_MIN} and ${PING_PACKET_SIZE_MAX} (default: ${PING_PACKET_SIZE_DEFAULT})`
                );
            }

            if (
                this.ping_per_request_timeout &&
                (this.ping_per_request_timeout < PING_PER_REQUEST_TIMEOUT_MIN ||
                    this.ping_per_request_timeout > PING_PER_REQUEST_TIMEOUT_MAX)
            ) {
                throw new Error(
                    `Per-ping timeout must be between ${PING_PER_REQUEST_TIMEOUT_MIN} and ${PING_PER_REQUEST_TIMEOUT_MAX} seconds (default: ${PING_PER_REQUEST_TIMEOUT_DEFAULT})`
                );
            }

            if (this.ping_count && (this.ping_count < PING_COUNT_MIN || this.ping_count > PING_COUNT_MAX)) {
                throw new Error(
                    `Echo requests count must be between ${PING_COUNT_MIN} and ${PING_COUNT_MAX} (default: ${PING_COUNT_DEFAULT})`
                );
            }

            if (this.timeout) {
                const pingGlobalTimeout = Math.round(Number(this.timeout));

                if (
                    pingGlobalTimeout < this.ping_per_request_timeout ||
                    pingGlobalTimeout < PING_GLOBAL_TIMEOUT_MIN ||
                    pingGlobalTimeout > PING_GLOBAL_TIMEOUT_MAX
                ) {
                    throw new Error(
                        `Timeout must be between ${PING_GLOBAL_TIMEOUT_MIN} and ${PING_GLOBAL_TIMEOUT_MAX} seconds (default: ${PING_GLOBAL_TIMEOUT_DEFAULT})`
                    );
                }

                this.timeout = pingGlobalTimeout;
            }
        }

        if (this.type === "real-browser") {
            // screenshot_delay validation
            if (this.screenshot_delay !== undefined && this.screenshot_delay !== null) {
                const delay = Number(this.screenshot_delay);
                if (isNaN(delay) || delay < 0) {
                    throw new Error("Screenshot delay must be a non-negative number");
                }

                // Must not exceed 0.8 * timeout (page.goto timeout is interval * 1000 * 0.8)
                const maxDelayFromTimeout = this.interval * 1000 * 0.8;
                if (delay >= maxDelayFromTimeout) {
                    throw new Error(`Screenshot delay must be less than ${maxDelayFromTimeout}ms (0.8 × interval)`);
                }

                // Must not exceed 0.5 * interval to prevent blocking next check
                const maxDelayFromInterval = this.interval * 1000 * 0.5;
                if (delay >= maxDelayFromInterval) {
                    throw new Error(`Screenshot delay must be less than ${maxDelayFromInterval}ms (0.5 × interval)`);
                }
            }
        }

        if (this.type === "mongodb" && this.databaseQuery) {
            // Validate that databaseQuery is valid JSON
            try {
                JSON.parse(this.databaseQuery);
            } catch (error) {
                throw new Error(`Invalid JSON in database query: ${error.message}`);
            }
        }
    }

    /**
     * Gets monitor notification of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorNotification(monitorIDs) {
        return await R.getAll(
            `
            SELECT monitor_notification.monitor_id, monitor_notification.notification_id
            FROM monitor_notification
            WHERE monitor_notification.monitor_id IN (${monitorIDs.map((_) => "?").join(",")})
        `,
            monitorIDs
        );
    }

    /**
     * Gets monitor tags of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorTag(monitorIDs) {
        return await R.getAll(
            `
            SELECT monitor_tag.monitor_id, monitor_tag.tag_id, monitor_tag.value, tag.name, tag.color
            FROM monitor_tag
            JOIN tag ON monitor_tag.tag_id = tag.id
            WHERE monitor_tag.monitor_id IN (${monitorIDs.map((_) => "?").join(",")})
        `,
            monitorIDs
        );
    }

    /**
     * prepare preloaded data for efficient access
     * @param {Array} monitorData IDs & active field of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async preparePreloadData(monitorData) {
        const notificationsMap = new Map();
        const tagsMap = new Map();
        const maintenanceStatusMap = new Map();
        const childrenIDsMap = new Map();
        const activeStatusMap = new Map();
        const forceInactiveMap = new Map();
        const pathsMap = new Map();

        if (monitorData.length > 0) {
            const monitorIDs = monitorData.map((monitor) => monitor.id);
            const notifications = await Monitor.getMonitorNotification(monitorIDs);
            const tags = await Monitor.getMonitorTag(monitorIDs);
            const maintenanceStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isUnderMaintenance(monitor.id))
            );
            const childrenIDs = await Promise.all(monitorData.map((monitor) => Monitor.getAllChildrenIDs(monitor.id)));
            const activeStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isActive(monitor.id, monitor.active))
            );
            const forceInactiveStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isParentActive(monitor.id))
            );
            const paths = await Promise.all(monitorData.map((monitor) => Monitor.getAllPath(monitor.id, monitor.name)));

            notifications.forEach((row) => {
                if (!notificationsMap.has(row.monitor_id)) {
                    notificationsMap.set(row.monitor_id, {});
                }
                notificationsMap.get(row.monitor_id)[row.notification_id] = true;
            });

            tags.forEach((row) => {
                if (!tagsMap.has(row.monitor_id)) {
                    tagsMap.set(row.monitor_id, []);
                }
                tagsMap.get(row.monitor_id).push({
                    tag_id: row.tag_id,
                    monitor_id: row.monitor_id,
                    value: row.value,
                    name: row.name,
                    color: row.color,
                });
            });

            monitorData.forEach((monitor, index) => {
                maintenanceStatusMap.set(monitor.id, maintenanceStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                childrenIDsMap.set(monitor.id, childrenIDs[index]);
            });

            monitorData.forEach((monitor, index) => {
                activeStatusMap.set(monitor.id, activeStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                forceInactiveMap.set(monitor.id, !forceInactiveStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                pathsMap.set(monitor.id, paths[index]);
            });
        }

        return {
            notifications: notificationsMap,
            tags: tagsMap,
            maintenanceStatus: maintenanceStatusMap,
            childrenIDs: childrenIDsMap,
            activeStatus: activeStatusMap,
            forceInactive: forceInactiveMap,
            paths: pathsMap,
        };
    }

    /**
     * Gets Parent of the monitor
     * @param {number} monitorID ID of monitor to get
     * @returns {Promise<LooseObject<any>>} Parent
     */
    static async getParent(monitorID) {
        return await R.getRow(
            `
            SELECT parent.* FROM monitor parent
    		LEFT JOIN monitor child
    			ON child.parent = parent.id
            WHERE child.id = ?
        `,
            [monitorID]
        );
    }

    /**
     * Gets all Children of the monitor
     * @param {number} monitorID ID of monitor to get
     * @returns {Promise<LooseObject<any>[]>} Children
     */
    static async getChildren(monitorID) {
        return await R.getAll(
            `
            SELECT * FROM monitor
            WHERE parent = ?
        `,
            [monitorID]
        );
    }

    /**
     * Gets the full path
     * @param {number} monitorID ID of the monitor to get
     * @param {string} name of the monitor to get
     * @returns {Promise<string[]>} Full path (includes groups and the name) of the monitor
     */
    static async getAllPath(monitorID, name) {
        const path = [name];

        if (this.parent === null) {
            return path;
        }

        let parent = await Monitor.getParent(monitorID);
        while (parent !== null) {
            path.unshift(parent.name);
            parent = await Monitor.getParent(parent.id);
        }

        return path;
    }

    /**
     * Gets recursive all child ids
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<Array>} IDs of all children
     */
    static async getAllChildrenIDs(monitorID) {
        const childs = await Monitor.getChildren(monitorID);

        if (childs === null) {
            return [];
        }

        let childrenIDs = [];

        for (const child of childs) {
            childrenIDs.push(child.id);
            childrenIDs = childrenIDs.concat(await Monitor.getAllChildrenIDs(child.id));
        }

        return childrenIDs;
    }

    /**
     * Unlinks all children of the group monitor
     * @param {number} groupID ID of group to remove children of
     * @returns {Promise<void>}
     */
    static async unlinkAllChildren(groupID) {
        return await R.exec("UPDATE `monitor` SET parent = ? WHERE parent = ? ", [null, groupID]);
    }

    /**
     * Delete a monitor from the system
     * @param {number} monitorID ID of the monitor to delete
     * @param {number} userID ID of the user who owns the monitor
     * @returns {Promise<void>}
     */
    static async deleteMonitor(monitorID, userID) {
        const server = UptimeKumaServer.getInstance();

        // Stop the monitor if it's running
        if (monitorID in server.monitorList) {
            await server.monitorList[monitorID].stop();
            delete server.monitorList[monitorID];
        }

        // Delete from database
        await R.exec("DELETE FROM monitor WHERE id = ? AND user_id = ? ", [monitorID, userID]);
    }

    /**
     * Recursively delete a monitor and all its descendants
     * @param {number} monitorID ID of the monitor to delete
     * @param {number} userID ID of the user who owns the monitor
     * @returns {Promise<void>}
     */
    static async deleteMonitorRecursively(monitorID, userID) {
        // Check if this monitor is a group
        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, userID]);

        if (monitor && monitor.type === "group") {
            // Get all children and delete them recursively
            const children = await Monitor.getChildren(monitorID);
            if (children && children.length > 0) {
                for (const child of children) {
                    await Monitor.deleteMonitorRecursively(child.id, userID);
                }
            }
        }

        // Delete the monitor itself
        await Monitor.deleteMonitor(monitorID, userID);
    }

    /**
     * Checks recursive if parent (ancestors) are active
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<boolean>} Is the parent monitor active?
     */
    static async isParentActive(monitorID) {
        const parent = await Monitor.getParent(monitorID);

        if (parent === null) {
            return true;
        }

        const parentActive = await Monitor.isParentActive(parent.id);
        return parent.active === 1 && parentActive;
    }

    /**
     * Obtains a new Oidc Token
     * @returns {Promise<object>} OAuthProvider client
     */
    async makeOidcTokenClientCredentialsRequest() {
        log.debug("monitor", `[${this.name}] The oauth access-token undefined or expired. Requesting a new token`);
        const oAuthAccessToken = await getOidcTokenClientCredentials(
            this.oauth_token_url,
            this.oauth_client_id,
            this.oauth_client_secret,
            this.oauth_scopes,
            this.oauth_audience,
            this.oauth_auth_method
        );
        if (this.oauthAccessToken?.expires_at) {
            log.debug(
                "monitor",
                `[${this.name}] Obtained oauth access-token. Expires at ${new Date(this.oauthAccessToken?.expires_at * 1000)}`
            );
        } else {
            log.debug("monitor", `[${this.name}] Obtained oauth access-token. Time until expiry was not provided`);
        }

        return oAuthAccessToken;
    }

    /**
     * Store TLS certificate information and check for expiry
     * @param {object} tlsInfo Information about the TLS connection
     * @returns {Promise<void>}
     */
    async handleTlsInfo(tlsInfo) {
        await this.updateTlsInfo(tlsInfo);
        this.prometheus?.update(null, tlsInfo, null);

        if (!this.getIgnoreTls() && this.isEnabledExpiryNotification()) {
            log.debug("monitor", `[${this.name}] call checkCertExpiryNotifications`);
            await checkCertExpiryNotifications(this, tlsInfo);
        }
    }

    /**
     * Get execution diagnostics for a monitor (NOC diagnostic payload)
     * @param {number} monitorId Monitor ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Diagnostic details
     */
    static async getDiagnostics(monitorId, organizationId) {
        const orgId = organizationId || 1;
        const monitor = await R.findOne("monitor", " id = ? AND (organization_id = ? OR organization_id IS NULL) ", [monitorId, orgId]);
        if (!monitor) {
            throw new Error("Monitor not found or access denied.");
        }

        const recentBeats = await R.getAll(
            "SELECT id, status, ping, time, msg, duration, down_count, probe_id FROM heartbeat WHERE monitor_id = ? ORDER BY id DESC LIMIT 20",
            [monitorId]
        );

        const lastBeat = recentBeats.length > 0 ? recentBeats[0] : null;
        const lastSuccess = recentBeats.find((b) => b.status === UP);
        const lastFailure = recentBeats.find((b) => b.status === DOWN);

        let probeInfo = null;
        let executionLocation = "Central Monitoring Server";
        let executionSource = "central";
        let workerAvailable = true;

        if (monitor.probe_id) {
            const probe = await R.getRow("SELECT id, name, status, last_heartbeat FROM probe WHERE id = ?", [monitor.probe_id]);
            if (probe) {
                probeInfo = {
                    id: probe.id,
                    name: probe.name,
                    status: probe.status,
                    last_heartbeat: probe.last_heartbeat,
                };
                executionLocation = `Remote Probe #${probe.id} (${probe.name})`;
                executionSource = "probe";
                workerAvailable = probe.status === "online";
            }
        }

        const nextScheduled = lastBeat ? new Date(new Date(lastBeat.time).getTime() + (monitor.interval || 60) * 1000).toISOString() : null;

        let statusText = "UNKNOWN";
        if (lastBeat) {
            if (lastBeat.status === UP) statusText = "UP";
            else if (lastBeat.status === DOWN) statusText = "DOWN";
            else if (lastBeat.status === PENDING) statusText = "WARNING";
            else if (lastBeat.status === MAINTENANCE) statusText = "MAINTENANCE";
        }

        return {
            monitor_id: monitor.id,
            name: monitor.name,
            type: monitor.type,
            target: monitor.hostname || monitor.url || `Target #${monitor.id}`,
            execution_location: executionLocation,
            execution_source: executionSource,
            assigned_probe_id: monitor.probe_id || null,
            probe_info: probeInfo,
            worker_available: workerAvailable,
            last_execution: lastBeat ? lastBeat.time : null,
            last_successful_execution: lastSuccess ? lastSuccess.time : null,
            last_failed_execution: lastFailure ? lastFailure.time : null,
            last_status: statusText,
            last_ping_ms: lastBeat ? lastBeat.ping : null,
            failure_count: lastBeat ? (lastBeat.down_count || 0) : 0,
            execution_duration_sec: lastBeat ? (lastBeat.duration || 0) : 0,
            failure_reason: lastFailure ? lastFailure.msg : null,
            last_message: lastBeat ? lastBeat.msg : null,
            next_scheduled_execution: nextScheduled,
            active: Boolean(monitor.active),
        };
    }

    /**
     * Reconcile active alerts and incidents across all monitors for consistent state
     * @param {number|null} organizationId Optional organization filter
     * @param {object|null} io Socket.io instance
     * @returns {Promise<object>} Reconciliation counts
     */
    static async reconcileAllMonitorAlerts(organizationId = null, io = null) {
        const orgCondition = organizationId ? "WHERE (organization_id = ? OR organization_id IS NULL) AND active = 1" : "WHERE active = 1";
        const params = organizationId ? [organizationId] : [];
        const activeMonitors = await R.getAll(`SELECT id, name, hostname, url, type, organization_id, user_id FROM monitor ${orgCondition}`, params);

        let alertsCreated = 0;
        let alertsResolved = 0;
        let incidentsCreated = 0;
        let incidentsResolved = 0;
        const isoNow = toSqlDatetime();

        for (const mon of activeMonitors) {
            const orgId = mon.organization_id || 1;
            const lastBeat = await Monitor.getPreviousHeartbeat(mon.id);
            if (!lastBeat) continue;

            if (lastBeat.status === DOWN) {
                // Ground truth is DOWN: Ensure active alert exists
                const existingAlert = await R.getRow(
                    "SELECT id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                    [orgId, mon.id]
                );
                if (!existingAlert) {
                    const alertMsg = `Monitor #${mon.id} (${mon.name}) is DOWN: ${lastBeat.msg || "Target unreachable"}`;
                    await R.exec(
                        `INSERT INTO active_alert (
                            organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
                        ) VALUES (?, 0, 'monitor', ?, 'monitor_down', 'CRITICAL', 0, ?, ?, ?, ?, ?)`,
                        [orgId, mon.id, alertMsg, isoNow, isoNow, isoNow, isoNow]
                    );
                    alertsCreated++;
                }

                // Ensure open incident exists
                const existingInc = await R.getRow(
                    `SELECT incident.id FROM incident 
                    JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                    WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                    AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                    AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                    [orgId, mon.id]
                );
                if (!existingInc) {
                    const Incident = require("./incident");
                    await Incident.createIncident(
                        {
                            title: `[OUTAGE] Monitor #${mon.id} (${mon.name}) is DOWN`,
                            description: `Automated NOC Outage Incident raised for ${mon.name}. Status: DOWN. Details: ${lastBeat.msg || "Heartbeat failed"}`,
                            failure_reason: lastBeat.msg || "Heartbeat failed",
                            severity: "P1",
                            links: [{ entity_type: "monitor", entity_id: mon.id }],
                        },
                        orgId,
                        mon.user_id
                    );
                    incidentsCreated++;
                }
            } else if (lastBeat.status === UP) {
                // Ground truth is UP: Clear dangling alerts
                const danglingAlert = await R.getRow(
                    "SELECT id, rule_id FROM active_alert WHERE (organization_id = ? OR organization_id IS NULL) AND target_type = 'monitor' AND target_id = ?",
                    [orgId, mon.id]
                );
                if (danglingAlert) {
                    const recoveryMsg = `[RECOVERED] Monitor #${mon.id} (${mon.name}) returned to service (UP)`;
                    await R.exec(
                        "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, ?, 'RECOVERED', ?, ?)",
                        [orgId, danglingAlert.id, danglingAlert.rule_id || 0, recoveryMsg, isoNow]
                    );
                    await R.exec("DELETE FROM active_alert WHERE id = ?", [danglingAlert.id]);
                    alertsResolved++;
                }

                // Resolve any open incidents
                const openIncs = await R.getAll(
                    `SELECT incident.id FROM incident 
                    JOIN incident_entity_link ON incident.id = incident_entity_link.incident_id 
                    WHERE (incident.organization_id = ? OR incident.organization_id IS NULL) 
                    AND UPPER(incident.status) NOT IN ('RESOLVED', 'CLOSED') 
                    AND incident_entity_link.entity_type = 'monitor' AND incident_entity_link.entity_id = ?`,
                    [orgId, mon.id]
                );
                for (const inc of openIncs) {
                    await R.exec(
                        "UPDATE incident SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE id = ?",
                        [isoNow, isoNow, inc.id]
                    );
                    await R.exec(
                        "INSERT INTO incident_timeline (organization_id, incident_id, user_id, event_type, message, created_at) VALUES (?, ?, ?, 'resolved', 'Auto resolved on monitor recovery reconciliation (UP)', ?)",
                        [orgId, inc.id, null, isoNow]
                    );
                    incidentsResolved++;
                }
            }
        }

        if (io) {
            if (alertsCreated > 0 || alertsResolved > 0) {
                io.emit("updateActiveAlerts");
            }
            if (incidentsCreated > 0 || incidentsResolved > 0) {
                io.emit("updateIncidentStats");
            }
        }

        return { alertsCreated, alertsResolved, incidentsCreated, incidentsResolved };
    }

    /**
     * Authoritative backend aggregation for operational status.
     * Computes real-time ground truth counts for monitors, probes, active alerts, and incidents
     * scoped to organizationId with tenant isolation.
     * @param {number|null} [organizationId] Organization ID
     * @returns {Promise<object>} Unified NOC aggregated stats
     */
    static async getNocAggregatedStats(organizationId) {
        const orgId = organizationId ? Number(organizationId) : 1;

        // 1. Monitors count by status
        const monitors = await R.getAll(
            "SELECT id, active FROM monitor WHERE organization_id = ? OR organization_id IS NULL",
            [orgId]
        );

        let totalMonitors = monitors.length;
        let up = 0;
        let down = 0;
        let warning = 0;
        let unknown = 0;
        let paused = 0;

        for (const m of monitors) {
            if (!m.active) {
                paused++;
                continue;
            }
            const lastBeat = await Monitor.getPreviousHeartbeat(m.id);
            if (!lastBeat) {
                unknown++;
            } else if (lastBeat.status === UP) {
                up++;
            } else if (lastBeat.status === DOWN) {
                down++;
            } else if (lastBeat.status === PENDING) {
                warning++;
            } else {
                unknown++;
            }
        }

        // 2. Probes count by status
        const probes = await R.getAll(
            "SELECT id, status, latency_ms FROM probe WHERE (organization_id = ? OR organization_id IS NULL) AND status NOT IN ('revoked')",
            [orgId]
        );
        let totalProbes = probes.length;
        let probesOnline = probes.filter((p) => p.status === "online").length;
        let probesDegraded = probes.filter((p) => p.status === "degraded" || (p.status === "online" && p.latency_ms > 100)).length;
        let probesOffline = probes.filter((p) => p.status === "offline").length;

        // 3. Active alerts count
        const activeAlerts = await R.getAll(
            "SELECT id, state FROM active_alert WHERE organization_id = ? OR organization_id IS NULL",
            [orgId]
        );
        let totalActiveAlerts = activeAlerts.length;
        let criticalAlerts = activeAlerts.filter((a) => a.state === "CRITICAL").length;
        let warningAlerts = activeAlerts.filter((a) => a.state === "WARNING").length;

        // 4. Open incidents count
        const openIncidents = await R.getAll(
            "SELECT id, severity FROM incident WHERE (organization_id = ? OR organization_id IS NULL) AND UPPER(status) NOT IN ('RESOLVED', 'CLOSED')",
            [orgId]
        );
        let totalOpenIncidents = openIncidents.length;
        let p1Incidents = openIncidents.filter((i) => i.severity === "P1").length;
        let p2Incidents = openIncidents.filter((i) => i.severity === "P2").length;

        return {
            monitors: {
                total: totalMonitors,
                up,
                down,
                warning,
                unknown,
                paused,
            },
            probes: {
                total: totalProbes,
                online: probesOnline,
                warning: probesDegraded,
                offline: probesOffline,
            },
            alerts: {
                total: totalActiveAlerts,
                critical: criticalAlerts,
                warning: warningAlerts,
            },
            incidents: {
                total: totalOpenIncidents,
                p1: p1Incidents,
                p2: p2Incidents,
            },
        };
    }
}

module.exports = Monitor;
