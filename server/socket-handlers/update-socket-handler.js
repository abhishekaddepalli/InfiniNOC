const { checkLogin } = require("../util-server");
const UpdateEngine = require("../update-engine");

/**
 * Socket handlers for Application Update Engine
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.updateSocketHandler = (socket) => {
    // Check for platform updates
    socket.on("checkPlatformUpdates", async (data, callback) => {
        try {
            checkLogin(socket);
            const channel = (data && data.channel) || "stable";
            const updateInfo = await UpdateEngine.checkForUpdates(channel);
            if (typeof callback === "function") {
                callback({ ok: true, updateInfo });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Run Pre-Update Safety Checks
    socket.on("runUpdateSafetyCheck", async (data, callback) => {
        try {
            checkLogin(socket);
            const targetVersion = (data && data.targetVersion) || "1.0.1";
            const safetyReport = await UpdateEngine.runUpdateSafetyCheck(targetVersion);
            if (typeof callback === "function") {
                callback({ ok: true, safetyReport });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Get Version History
    socket.on("getUpdateHistory", async (callback) => {
        try {
            checkLogin(socket);
            const history = UpdateEngine.getVersionHistory();
            if (typeof callback === "function") {
                callback({ ok: true, history });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });
};
