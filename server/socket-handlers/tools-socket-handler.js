const { checkLogin } = require("../util-server");
const { ToolRegistry } = require("../tools/tool-registry");
const { ToolService } = require("../tools/tool-service");
const { DiagnosticHistory } = require("../model/diagnostic-history");
const { R } = require("redbean-node");
const { log } = require("../../src/util");

/**
 * Socket handlers for InfiniNOC Diagnostic Network Tools Center
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.toolsSocketHandler = (socket) => {
    // 1. Fetch Tool Registry & Categories
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

    // 2. Execute Diagnostic Tool Request
    socket.on("executeTool", async (data, callback) => {
        try {
            checkLogin(socket);
            if (!data || !data.slug) {
                throw new Error("Tool slug is required.");
            }

            const slug = data.slug;
            const params = data.params || {};
            const userId = socket.userID || 1;
            const organizationId = socket.organizationID || 1;

            const result = await ToolService.execute(slug, params, { userId, organizationId });

            // Fetch latest history
            const history = await DiagnosticHistory.getHistory({
                organizationId,
                userId,
                limit: 20,
            });

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

    // 3. Get User Tool Favorites
    socket.on("getUserToolFavorites", async (callback) => {
        try {
            checkLogin(socket);
            const userId = socket.userID || 1;
            const organizationId = socket.organizationID || 1;
            const favorites = await DiagnosticHistory.getFavorites(userId, organizationId);
            if (typeof callback === "function") {
                callback({ ok: true, favorites });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // 4. Toggle User Tool Favorite
    socket.on("toggleUserToolFavorite", async (data, callback) => {
        try {
            checkLogin(socket);
            if (!data || !data.slug) {
                throw new Error("Tool slug is required.");
            }
            const userId = socket.userID || 1;
            const organizationId = socket.organizationID || 1;
            const favorites = await DiagnosticHistory.toggleFavorite(userId, data.slug, organizationId);
            const isFavorite = favorites.includes(data.slug);
            if (typeof callback === "function") {
                callback({ ok: true, favorites, isFavorite });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // 5. Get Recently Used Tools History
    socket.on("getRecentlyUsedTools", async (callback) => {
        try {
            checkLogin(socket);
            const userId = socket.userID || 1;
            const organizationId = socket.organizationID || 1;
            const records = await DiagnosticHistory.getHistory({
                organizationId,
                userId,
                limit: 10,
            });

            const history = records.map((r) => {
                const tool = ToolRegistry.getToolBySlug(r.toolId);
                return {
                    id: r.id,
                    slug: r.toolId,
                    name: tool ? tool.name : r.toolId,
                    input: r.target,
                    timestamp: r.createdAt,
                    status: r.status,
                    durationMs: r.durationMs,
                    executionLocation: r.executionLocation,
                };
            });

            if (typeof callback === "function") {
                callback({ ok: true, history });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // 6. Get Comprehensive Diagnostic Execution History with Filtering
    socket.on("getDiagnosticHistory", async (filter, callback) => {
        try {
            checkLogin(socket);
            const organizationId = socket.organizationID || 1;
            const records = await DiagnosticHistory.getHistory({
                organizationId,
                ...(filter || {}),
            });
            if (typeof callback === "function") {
                callback({ ok: true, records });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // 7. Clear Diagnostic Execution History
    socket.on("clearDiagnosticHistory", async (filter, callback) => {
        try {
            checkLogin(socket);
            const organizationId = socket.organizationID || 1;
            const success = await DiagnosticHistory.clearHistory({
                organizationId,
                userId: socket.userID || 1,
                ...(filter || {}),
            });
            if (typeof callback === "function") {
                callback({ ok: success });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });

    // 8. Get Available Diagnostic Execution Locations (Central + Online Probes)
    socket.on("getDiagnosticExecutionLocations", async (callback) => {
        try {
            checkLogin(socket);
            const organizationId = socket.organizationID || 1;
            const locations = [
                { id: "central", name: "Central Server (Local Host)", status: "ONLINE", location: "Central NOC Cluster" },
            ];

            try {
                const probes = await R.getAll(
                    "SELECT id, name, location, status FROM probe WHERE organization_id = ? AND status = 'online' ORDER BY name ASC",
                    [organizationId]
                );
                for (const p of probes) {
                    locations.push({
                        id: `probe:${p.id}`,
                        probeId: p.id,
                        name: `Probe: ${p.name}`,
                        status: p.status ? p.status.toUpperCase() : "ONLINE",
                        location: p.location || "Remote Site",
                    });
                }
            } catch (_) {}

            if (typeof callback === "function") {
                callback({ ok: true, locations });
            }
        } catch (error) {
            if (typeof callback === "function") {
                callback({ ok: false, msg: error.message });
            }
        }
    });
};
