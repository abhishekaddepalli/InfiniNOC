const { setSetting, setting } = require("./util-server");
const { log } = require("../src/util");
const productConfig = require("../config/product.json");
const UpdateEngine = require("./update-engine");

exports.version = productConfig.version || "1.0.0";
exports.latestVersion = null;

const UPDATE_CHECKER_INTERVAL_MS = 1000 * 60 * 60 * 24;

let interval;

exports.startInterval = () => {
    let check = async () => {
        if ((await setting("checkUpdate")) === false) {
            return;
        }

        log.debug("update-checker", "Retrieving latest InfiniNOC release version");

        try {
            const updateInfo = await UpdateEngine.checkForUpdates();
            if (updateInfo && updateInfo.latestVersion) {
                exports.latestVersion = updateInfo.latestVersion;
            }
        } catch (_) {
            log.info("update-checker", "Failed to check for InfiniNOC update releases");
        }
    };

    check();
    interval = setInterval(check, UPDATE_CHECKER_INTERVAL_MS);
};

exports.enableCheckUpdate = async (value) => {
    await setSetting("checkUpdate", value);

    clearInterval(interval);

    if (value) {
        exports.startInterval();
    }
};

exports.socket = null;
