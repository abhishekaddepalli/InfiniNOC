const isFreeBSD = /^freebsd/.test(process.platform);

// Interop with browser
const args = typeof process !== "undefined" ? require("args-parser")(process.argv) : {};

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
let hostEnv = isFreeBSD ? null : (process.env.INFININOC_HOST || process.env.HOST);
const hostname = args.host || process.env.INFININOC_HOST || process.env.UPTIME_KUMA_HOST || hostEnv;

const port = [args.port, process.env.INFININOC_PORT, process.env.UPTIME_KUMA_PORT, process.env.PORT, 3001]
    .map((portValue) => parseInt(portValue))
    .find((portValue) => !isNaN(portValue));

const sslKey = args["ssl-key"] || process.env.INFININOC_SSL_KEY || process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || undefined;
const sslCert = args["ssl-cert"] || process.env.INFININOC_SSL_CERT || process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || undefined;
const sslKeyPassphrase =
    args["ssl-key-passphrase"] ||
    process.env.INFININOC_SSL_KEY_PASSPHRASE ||
    process.env.UPTIME_KUMA_SSL_KEY_PASSPHRASE ||
    process.env.SSL_KEY_PASSPHRASE ||
    undefined;

const isSSL = sslKey && sslCert;

/**
 * Get the local WebSocket URL
 * @returns {string} The local WebSocket URL
 */
function getLocalWebSocketURL() {
    const protocol = isSSL ? "wss" : "ws";
    const host = hostname || "localhost";
    return `${protocol}://${host}:${port}`;
}

const localWebSocketURL = getLocalWebSocketURL();

const demoMode = args["demo"] || false;

module.exports = {
    args,
    hostname,
    port,
    sslKey,
    sslCert,
    sslKeyPassphrase,
    isSSL,
    localWebSocketURL,
    demoMode,
};
