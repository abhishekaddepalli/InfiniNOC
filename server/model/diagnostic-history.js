const { R } = require("redbean-node");
const { log } = require("../../src/util");

/**
 * InfiniNOC Diagnostic History Model
 * Persists and retrieves tool execution records and user preferences
 */
class DiagnosticHistory {
    /**
     * Record a tool execution event in the database
     * @param {object} data Execution parameters
     * @returns {Promise<object>} Recorded execution record
     */
    static async recordExecution(data) {
        try {
            const orgId = parseInt(data.organizationId || data.organization_id || 1, 10);
            const userId = data.userId ? parseInt(data.userId, 10) : null;
            const toolId = String(data.toolId || data.slug || "unknown").substring(0, 64);
            const category = String(data.category || "general").substring(0, 64);
            const target = String(data.target || data.host || data.domain || data.ip || "").substring(0, 255);
            const paramsJson = data.parameters ? JSON.stringify(data.parameters) : (data.params ? JSON.stringify(data.params) : null);
            const executionLocation = String(data.executionLocation || data.execution_location || "central").substring(0, 64);
            const probeId = data.probeId ? parseInt(data.probeId, 10) : null;
            const status = String(data.status || (data.ok ? "SUCCESS" : "FAILED")).substring(0, 32);
            const durationMs = data.durationMs != null ? parseInt(data.durationMs, 10) : (data.totalTimeMs != null ? parseInt(data.totalTimeMs, 10) : null);
            const resultJson = data.result ? JSON.stringify(data.result) : null;
            const errorMessage = data.errorMessage || data.error || (data.ok === false ? data.msg : null);

            const record = R.dispense("diagnostic_history");
            record.organization_id = orgId;
            record.user_id = userId;
            record.tool_id = toolId;
            record.category = category;
            record.target = target;
            record.parameters = paramsJson;
            record.execution_location = executionLocation;
            record.probe_id = probeId;
            record.status = status;
            record.duration_ms = durationMs;
            record.result = resultJson;
            record.error_message = errorMessage ? String(errorMessage).substring(0, 1000) : null;
            record.created_at = R.isoDateTime();
            record.updated_at = R.isoDateTime();

            const id = await R.store(record);
            return {
                id,
                organizationId: orgId,
                userId,
                toolId,
                category,
                target,
                executionLocation,
                probeId,
                status,
                durationMs,
                createdAt: record.created_at,
            };
        } catch (err) {
            log.error("diagnostic-history", `Failed to record execution: ${err.message}`);
            return null;
        }
    }

    /**
     * Query execution history with optional filtering
     * @param {object} filter Filter options
     * @returns {Promise<Array<object>>} History records
     */
    static async getHistory(filter = {}) {
        try {
            const orgId = parseInt(filter.organizationId || filter.organization_id || 1, 10);
            const limit = Math.min(Math.max(parseInt(filter.limit || 50, 10), 1), 200);
            const offset = Math.max(parseInt(filter.offset || 0, 10), 0);

            let query = R.knex("diagnostic_history")
                .where("organization_id", orgId);

            if (filter.toolId || filter.slug) {
                query = query.where("tool_id", filter.toolId || filter.slug);
            }
            if (filter.category && filter.category !== "all") {
                query = query.where("category", filter.category);
            }
            if (filter.target) {
                query = query.where("target", "like", `%${filter.target.trim()}%`);
            }
            if (filter.status) {
                query = query.where("status", filter.status);
            }
            if (filter.userId) {
                query = query.where("user_id", parseInt(filter.userId, 10));
            }

            const rows = await query
                .orderBy("id", "desc")
                .limit(limit)
                .offset(offset);

            return rows.map((row) => {
                let parsedResult = null;
                let parsedParams = null;
                try {
                    if (row.result) parsedResult = JSON.parse(row.result);
                } catch (_) {}
                try {
                    if (row.parameters) parsedParams = JSON.parse(row.parameters);
                } catch (_) {}

                return {
                    id: row.id,
                    organizationId: row.organization_id,
                    userId: row.user_id,
                    toolId: row.tool_id,
                    category: row.category,
                    target: row.target,
                    parameters: parsedParams,
                    executionLocation: row.execution_location,
                    probeId: row.probe_id,
                    status: row.status,
                    durationMs: row.duration_ms,
                    result: parsedResult,
                    errorMessage: row.error_message,
                    createdAt: row.created_at,
                };
            });
        } catch (err) {
            log.error("diagnostic-history", `Failed to get history: ${err.message}`);
            return [];
        }
    }

    /**
     * Clear history records
     * @param {object} filter Filter options
     * @returns {Promise<boolean>} Success indicator
     */
    static async clearHistory(filter = {}) {
        try {
            const orgId = parseInt(filter.organizationId || filter.organization_id || 1, 10);
            let query = R.knex("diagnostic_history").where("organization_id", orgId);

            if (filter.toolId || filter.slug) {
                query = query.where("tool_id", filter.toolId || filter.slug);
            }
            if (filter.userId) {
                query = query.where("user_id", parseInt(filter.userId, 10));
            }

            await query.del();
            return true;
        } catch (err) {
            log.error("diagnostic-history", `Failed to clear history: ${err.message}`);
            return false;
        }
    }

    /**
     * Get favorite tool slugs for a user
     * @param {number} userId User ID
     * @param {number} orgId Organization ID
     * @returns {Promise<Array<string>>} Favorite tool slugs
     */
    static async getFavorites(userId, orgId = 1) {
        try {
            const rows = await R.knex("diagnostic_tool_preference")
                .where({
                    user_id: parseInt(userId, 10),
                    is_favorite: true,
                })
                .select("tool_slug");

            if (rows.length === 0) {
                // Default favorites
                return ["ping", "traceroute", "dns-lookup", "port-checker", "ssl-checker", "subnet-calculator"];
            }
            return rows.map((r) => r.tool_slug);
        } catch (err) {
            log.error("diagnostic-history", `Failed to get favorites: ${err.message}`);
            return ["ping", "traceroute", "dns-lookup", "port-checker", "ssl-checker", "subnet-calculator"];
        }
    }

    /**
     * Toggle favorite tool slug for a user
     * @param {number} userId User ID
     * @param {string} toolSlug Tool slug
     * @param {number} orgId Organization ID
     * @returns {Promise<Array<string>>} Updated favorite tool slugs
     */
    static async toggleFavorite(userId, toolSlug, orgId = 1) {
        try {
            const uId = parseInt(userId, 10);
            const slug = String(toolSlug).trim();

            const existing = await R.knex("diagnostic_tool_preference")
                .where({ user_id: uId, tool_slug: slug })
                .first();

            if (existing) {
                const newStatus = !existing.is_favorite;
                await R.knex("diagnostic_tool_preference")
                    .where({ id: existing.id })
                    .update({
                        is_favorite: newStatus,
                        updated_at: R.isoDateTime(),
                    });
            } else {
                await R.knex("diagnostic_tool_preference").insert({
                    user_id: uId,
                    organization_id: parseInt(orgId, 10),
                    tool_slug: slug,
                    is_favorite: true,
                    created_at: R.isoDateTime(),
                    updated_at: R.isoDateTime(),
                });
            }
            return await this.getFavorites(uId, orgId);
        } catch (err) {
            log.error("diagnostic-history", `Failed to toggle favorite: ${err.message}`);
            return await this.getFavorites(userId, orgId);
        }
    }
}

module.exports = { DiagnosticHistory };
