const { R } = require("redbean-node");

class AlertEngine {
    /**
     * Compare a metric value against a threshold operator
     * @param {number} value Telemetry metric value
     * @param {string} operator Operator ('>', '>=', '<', '<=', '==', '!=')
     * @param {number} threshold Target threshold
     * @returns {boolean} True if threshold is breached
     */
    static compareThreshold(value, operator, threshold) {
        const v = Number(value);
        const t = Number(threshold);

        switch (operator) {
            case ">": return v > t;
            case ">=": return v >= t;
            case "<": return v < t;
            case "<=": return v <= t;
            case "==": return v === t;
            case "!=": return v !== t;
            default: return v > t;
        }
    }

    /**
     * Evaluate a telemetry metric against an alert rule
     * @param {object} rule Alert rule object
     * @param {number} metricValue Current metric value
     * @param {object} targetEntity Target device/probe/monitor object
     * @returns {Promise<object|null>} Result object or null if suppressed/normal
     */
    static async evaluateRule(rule, metricValue, targetEntity) {
        if (!rule || !rule.enabled) {
            return null;
        }

        const orgId = rule.organization_id || 1;
        const targetId = rule.target_id || (targetEntity ? targetEntity.id : null);
        const targetType = rule.target_type || "device";

        // 1. Maintenance Suppression Check
        if (targetEntity && (targetEntity.in_maintenance || targetEntity.status === "maintenance")) {
            return { suppressed: true, reason: "maintenance" };
        }

        const isBreached = AlertEngine.compareThreshold(metricValue, rule.operator, rule.threshold);

        // Fetch existing active alert for this rule + target
        const activeAlert = await R.getRow(
            "SELECT * FROM active_alert WHERE rule_id = ? AND target_id = ? AND organization_id = ?",
            [rule.id, targetId, orgId]
        );

        const now = new Date();
        const isoNow = now.toISOString();

        if (isBreached) {
            // 2. Cooldown & Deduplication Check
            if (activeAlert) {
                // Check if silenced
                if (activeAlert.silenced_until) {
                    const silenceDate = new Date(String(activeAlert.silenced_until).replace(" ", "T") + (String(activeAlert.silenced_until).endsWith("Z") ? "" : "Z"));
                    if (silenceDate > now) {
                        return { suppressed: true, reason: "silenced" };
                    }
                }

                // Check cooldown window
                const rawDateStr = String(activeAlert.last_notified_at).replace(" ", "T");
                const lastNotifiedDate = new Date(rawDateStr.endsWith("Z") ? rawDateStr : rawDateStr + "Z");
                const lastNotifiedMs = isNaN(lastNotifiedDate.getTime()) ? now.getTime() : lastNotifiedDate.getTime();
                const cooldownMs = (rule.cooldown_seconds || 1800) * 1000;

                if (now.getTime() - lastNotifiedMs < cooldownMs) {
                    return { suppressed: true, reason: "cooldown", alert: activeAlert };
                }

                // Update notification timestamp (cooldown elapsed)
                await R.exec(
                    "UPDATE active_alert SET last_notified_at = ?, trigger_value = ?, updated_at = ? WHERE id = ?",
                    [isoNow, metricValue, isoNow, activeAlert.id]
                );

                return { alert: activeAlert, duplicated: true };
            }

            // 3. Create New Active Alert
            const msg = `[${rule.severity}] ${rule.name}: Metric '${rule.metric}' value ${metricValue} breached threshold ${rule.operator} ${rule.threshold}`;

            await R.exec(
                `INSERT INTO active_alert (
                    organization_id, rule_id, target_type, target_id, metric, state, trigger_value, message, first_triggered_at, last_notified_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [orgId, rule.id, targetType, targetId, rule.metric, rule.severity, metricValue, msg, isoNow, isoNow, isoNow, isoNow]
            );

            const alertId = await R.getCell("SELECT MAX(id) FROM active_alert WHERE organization_id = ?", [orgId]);

            // Log in history
            await R.exec(
                "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [orgId, alertId, rule.id, rule.severity, msg, isoNow]
            );

            const newAlert = await R.getRow("SELECT * FROM active_alert WHERE id = ?", [alertId]);
            return { alert: newAlert, created: true };
        } else {
            // 4. Recovery Transition
            if (activeAlert) {
                const recoveryMsg = `[RECOVERED] ${rule.name}: Metric '${rule.metric}' returned to normal (${metricValue})`;

                // Record RECOVERED state in history
                await R.exec(
                    "INSERT INTO alert_history (organization_id, alert_id, rule_id, state, message, created_at) VALUES (?, ?, ?, 'RECOVERED', ?, ?)",
                    [orgId, activeAlert.id, rule.id, recoveryMsg, isoNow]
                );

                // Remove from active alerts
                await R.exec("DELETE FROM active_alert WHERE id = ?", [activeAlert.id]);

                return { recovered: true, alertId: activeAlert.id };
            }
        }

        return null;
    }

    /**
     * Acknowledge an active alert
     * @param {number} alertId Alert ID
     * @param {number} userId User ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated alert
     */
    static async acknowledgeAlert(alertId, userId, organizationId) {
        const orgId = organizationId || 1;
        const alert = await R.getRow("SELECT * FROM active_alert WHERE id = ? AND organization_id = ?", [alertId, orgId]);
        if (!alert) {
            throw new Error("Alert not found or access denied.");
        }

        const isoNow = new Date().toISOString();

        await R.exec(
            "UPDATE active_alert SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?, updated_at = ? WHERE id = ?",
            [userId || null, isoNow, isoNow, alertId]
        );

        return await R.getRow("SELECT * FROM active_alert WHERE id = ?", [alertId]);
    }

    /**
     * Silence an active alert for duration
     * @param {number} alertId Alert ID
     * @param {number} silenceMinutes Duration in minutes
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Updated alert
     */
    static async silenceAlert(alertId, silenceMinutes, organizationId) {
        const orgId = organizationId || 1;
        const alert = await R.getRow("SELECT * FROM active_alert WHERE id = ? AND organization_id = ?", [alertId, orgId]);
        if (!alert) {
            throw new Error("Alert not found or access denied.");
        }

        const mins = Number(silenceMinutes) || 60;
        const silencedUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();
        const isoNow = new Date().toISOString();

        await R.exec(
            "UPDATE active_alert SET silenced_until = ?, updated_at = ? WHERE id = ?",
            [silencedUntil, isoNow, alertId]
        );

        return await R.getRow("SELECT * FROM active_alert WHERE id = ?", [alertId]);
    }

    /**
     * Create an alert rule
     * @param {object} data Rule data
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Created rule
     */
    static async createRule(data, organizationId) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.metric || data.threshold === undefined) {
            throw new Error("Rule name, metric, and threshold are required.");
        }

        const isoNow = new Date().toISOString();

        await R.exec(
            `INSERT INTO alert_rule (
                organization_id, name, target_type, target_id, metric, operator, threshold, duration_seconds, severity, cooldown_seconds, enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                orgId,
                data.name.trim(),
                data.target_type || "device",
                data.target_id || null,
                data.metric,
                data.operator || ">",
                Number(data.threshold),
                Number(data.duration_seconds) || 300,
                data.severity || "WARNING",
                Number(data.cooldown_seconds) || 1800,
                isoNow,
                isoNow,
            ]
        );

        const ruleId = await R.getCell("SELECT MAX(id) FROM alert_rule WHERE organization_id = ?", [orgId]);
        return await R.getRow("SELECT * FROM alert_rule WHERE id = ?", [ruleId]);
    }

    /**
     * Delete an alert rule
     * @param {number} ruleId Rule ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    static async deleteRule(ruleId, organizationId) {
        const orgId = organizationId || 1;
        const rule = await R.getCell("SELECT id FROM alert_rule WHERE id = ? AND organization_id = ?", [ruleId, orgId]);
        if (!rule) {
            throw new Error("Alert rule not found or access denied.");
        }

        await R.exec("DELETE FROM alert_rule WHERE id = ? AND organization_id = ?", [ruleId, orgId]);
        await R.exec("DELETE FROM active_alert WHERE rule_id = ? AND organization_id = ?", [ruleId, orgId]);
        return true;
    }

    /**
     * Get rules scoped to organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Rule list
     */
    static async getRules(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll("SELECT * FROM alert_rule WHERE organization_id = ? ORDER BY id DESC", [orgId]);
    }

    /**
     * Get active alerts scoped to organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Active alerts
     */
    static async getActiveAlerts(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll(
            "SELECT active_alert.*, alert_rule.name as rule_name FROM active_alert LEFT JOIN alert_rule ON active_alert.rule_id = alert_rule.id WHERE active_alert.organization_id = ? ORDER BY active_alert.id DESC",
            [orgId]
        );
    }

    /**
     * Get alert audit history scoped to organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} History records
     */
    static async getAlertHistory(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll("SELECT * FROM alert_history WHERE organization_id = ? ORDER BY id DESC LIMIT 100", [orgId]);
    }
}

module.exports = AlertEngine;
