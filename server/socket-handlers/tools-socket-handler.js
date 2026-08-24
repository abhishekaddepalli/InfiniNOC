const { checkLogin } = require("../util-server");
const { ToolRegistry } = require("../tools/tool-registry");
const { ToolService } = require("../tools/tool-service");
const { log } = require("../../src/util");

// In-memory persistent state per user for favorites and history
const userFavoritesMap = new Map();
const userHistoryMap = new Map();

/**
 * Socket handlers for InfiniNOC Network Tools Center
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.toolsSocketHandler = (socket) => {
    // Fetch Tool Registry & Categories
    socket.on("getToolRegistry", async (callback) => {
        try {
            checkLogin(socket);
            const categories = ToolRegistry.getCategories();
            const tools = ToolRegistry.getTools();
            if (typeof callback === "function") {
                callback({ ok: true, categories, tools });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Execute Diagnostic Tool Request
    socket.on("executeTool", async (data, callback) => {
        try {
            checkLogin(socket);
            if (!data || !data.slug) {
                throw new Error("Tool slug is required.");
            }

            const slug = data.slug;
            const params = data.params || {};
            const userId = socket.userID || 1;

            const result = await ToolService.execute(slug, params);

            // Record execution in history
            const tool = ToolRegistry.getToolBySlug(slug);
            const toolName = tool ? tool.name : slug;
            const inputSummary = params.target || params.host || params.ip || JSON.stringify(params);

            let history = userHistoryMap.get(userId) || [];
            history.unshift({
                slug,
                name: toolName,
                input: String(inputSummary).substring(0, 250),
                timestamp: new Date().toISOString(),
                status: result.ok ? (result.status || "SUCCESS") : (result.status || "FAILED"),
            });

            if (history.length > 20) {
                history = history.slice(0, 20);
            }
            userHistoryMap.set(userId, history);

            if (typeof callback === "function") {
                callback({ ok: true, result, history });
            }
        } catch (error) {
            log.error("tools-engine", `Error executing tool: ${error.message}`);
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Get User Tool Favorites
    socket.on("getUserToolFavorites", async (callback) => {
        try {
            checkLogin(socket);
            const userId = socket.userID || 1;
            const favorites = userFavoritesMap.get(userId) || ["ip-checker", "port-checker", "subnet-calculator", "dns-lookup"];
            if (typeof callback === "function") {
                callback({ ok: true, favorites });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Toggle User Tool Favorite
    socket.on("toggleUserToolFavorite", async (data, callback) => {
        try {
            checkLogin(socket);
            if (!data || !data.slug) {
                throw new Error("Tool slug is required.");
            }
            const userId = socket.userID || 1;
            let favorites = userFavoritesMap.get(userId) || ["ip-checker", "port-checker", "subnet-calculator", "dns-lookup"];
            const index = favorites.indexOf(data.slug);
            let isFavorite = false;

            if (index >= 0) {
                favorites.splice(index, 1);
                isFavorite = false;
            } else {
                favorites.push(data.slug);
                isFavorite = true;
            }

            userFavoritesMap.set(userId, favorites);
            if (typeof callback === "function") {
                callback({ ok: true, favorites, isFavorite });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Get Recently Used Tools History
    socket.on("getRecentlyUsedTools", async (callback) => {
        try {
            checkLogin(socket);
            const userId = socket.userID || 1;
            const history = userHistoryMap.get(userId) || [
                { slug: "port-checker", name: "Port Checker", input: "1.1.1.1:53", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), status: "OPEN" },
                { slug: "ip-checker", name: "IP Checker", input: "8.8.8.8", timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), status: "SUCCESS" },
            ];
            if (typeof callback === "function") {
                callback({ ok: true, history });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // Record Tool Execution in History
    socket.on("recordToolUsage", async (data, callback) => {
        try {
            checkLogin(socket);
            if (!data || !data.slug || !data.input) {
                throw new Error("Tool slug and input summary are required.");
            }
            const userId = socket.userID || 1;
            const tool = ToolRegistry.getToolBySlug(data.slug);
            const toolName = tool ? tool.name : data.slug;

            let history = userHistoryMap.get(userId) || [];
            history.unshift({
                slug: data.slug,
                name: toolName,
                input: String(data.input).substring(0, 250),
                timestamp: new Date().toISOString(),
                status: data.status || "SUCCESS",
            });

            // Keep last 20 entries
            if (history.length > 20) {
                history = history.slice(0, 20);
            }

            userHistoryMap.set(userId, history);

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
