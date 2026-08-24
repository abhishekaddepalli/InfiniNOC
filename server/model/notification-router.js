const { R } = require("redbean-node");
const EmailNotificationProvider = require("./notification-providers/email-provider");
const TelegramNotificationProvider = require("./notification-providers/telegram-provider");
const WhatsAppCloudNotificationProvider = require("./notification-providers/whatsapp-cloud-provider");
const WebhookNotificationProvider = require("./notification-providers/webhook-provider");

class NotificationRouter {
    /**
     *
     */
    constructor() {
        this.providers = {
            EMAIL: new EmailNotificationProvider(),
            TELEGRAM: new TelegramNotificationProvider(),
            WHATSAPP: new WhatsAppCloudNotificationProvider(),
            WEBHOOK: new WebhookNotificationProvider(),
        };

        this.severityRank = {
            P1: 4,
            P2: 3,
            P3: 2,
            P4: 1,
        };
    }

    /**
     * Get provider driver by type
     * @param {string} type Channel type (EMAIL, TELEGRAM, WHATSAPP, WEBHOOK)
     * @returns {object} Provider driver instance
     */
    getProvider(type) {
        const key = (type || "").toUpperCase();
        return this.providers[key] || this.providers.WEBHOOK;
    }

    /**
     * Create or update notification channel with AES-256-GCM encrypted secrets
     * @param {object} data Channel payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Saved channel record
     */
    async saveChannel(data, organizationId) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.channelType) {
            throw new Error("Channel name and channel type required.");
        }

        const provider = this.getProvider(data.channelType);
        const encryptedConfig = provider.encryptConfig(data.config || {});
        const isoNow = new Date().toISOString();

        if (data.id) {
            await R.exec(
                `UPDATE notification_channel SET
                    name = ?, channel_type = ?, encrypted_config = ?, is_enabled = ?, updated_at = ?
                WHERE id = ? AND organization_id = ?`,
                [data.name, data.channelType.toUpperCase(), encryptedConfig, data.isEnabled !== false ? 1 : 0, isoNow, data.id, orgId]
            );
            return R.getRow("SELECT * FROM notification_channel WHERE id = ? AND organization_id = ?", [data.id, orgId]);
        }

        await R.exec(
            `INSERT INTO notification_channel (
                organization_id, name, channel_type, encrypted_config, is_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orgId, data.name, data.channelType.toUpperCase(), encryptedConfig, data.isEnabled !== false ? 1 : 0, isoNow, isoNow]
        );

        const newId = await R.getCell("SELECT last_insert_rowid()");
        return R.getRow("SELECT * FROM notification_channel WHERE id = ? AND organization_id = ?", [newId, orgId]);
    }

    /**
     * Get organization notification channels with masked secrets
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array<object>>} Channels list
     */
    async getChannels(organizationId) {
        const orgId = organizationId || 1;
        const rows = await R.getAll("SELECT * FROM notification_channel WHERE organization_id = ? ORDER BY id DESC", [orgId]);
        return (rows || []).map((c) => ({
            id: c.id,
            organization_id: c.organization_id,
            name: c.name,
            channel_type: c.channel_type,
            is_enabled: !!c.is_enabled,
            masked_config: "•••••••• (Encrypted AES-256-GCM)",
            created_at: c.created_at,
        }));
    }

    /**
     * Delete notification channel
     * @param {number} channelId Channel ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    async deleteChannel(channelId, organizationId) {
        const orgId = organizationId || 1;
        const result = await R.exec("DELETE FROM notification_channel WHERE id = ? AND organization_id = ?", [channelId, orgId]);
        return result > 0;
    }

    /**
     * Test notification channel dispatch
     * @param {number} channelId Channel ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Delivery status
     */
    async testChannel(channelId, organizationId) {
        const orgId = organizationId || 1;
        const channel = await R.getRow("SELECT * FROM notification_channel WHERE id = ? AND organization_id = ?", [channelId, orgId]);
        if (!channel) {
            throw new Error("Notification channel not found.");
        }

        const provider = this.getProvider(channel.channel_type);
        const config = provider.decryptConfig(channel.encrypted_config);

        const result = await provider.sendNotification({
            config,
            recipient: config.to || config.chatId || config.recipientPhoneNumber || config.url || "test-recipient",
            subject: "InfiniNOC Test Notification",
            body: "This is a test notification from InfiniNOC Enterprise Monitoring Engine.",
        });

        await this.logDelivery(orgId, "TEST", "P3", channel.id, result.recipient || "test", "SUCCESS", null);
        return result;
    }

    /**
     * Create or update notification routing rule
     * @param {object} data Rule payload
     * @param {number} organizationId Organization ID
     * @returns {Promise<object>} Saved rule record
     */
    async saveRoutingRule(data, organizationId) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.channelId) {
            throw new Error("Rule name and channel required.");
        }

        const isoNow = new Date().toISOString();
        if (data.id) {
            await R.exec(
                `UPDATE notification_routing_rule SET
                    name = ?, event_type = ?, min_severity = ?, channel_id = ?, cooldown_minutes = ?, escalation_timeout_minutes = ?, escalation_channel_id = ?, is_enabled = ?, updated_at = ?
                WHERE id = ? AND organization_id = ?`,
                [
                    data.name,
                    data.eventType || "ALERT",
                    data.minSeverity || "P2",
                    data.channelId,
                    data.cooldownMinutes || 15,
                    data.escalationTimeoutMinutes || null,
                    data.escalationChannelId || null,
                    data.isEnabled !== false ? 1 : 0,
                    isoNow,
                    data.id,
                    orgId,
                ]
            );
            return R.getRow("SELECT * FROM notification_routing_rule WHERE id = ? AND organization_id = ?", [data.id, orgId]);
        }

        await R.exec(
            `INSERT INTO notification_routing_rule (
                organization_id, name, event_type, min_severity, channel_id, cooldown_minutes, escalation_timeout_minutes, escalation_channel_id, is_enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orgId,
                data.name,
                data.eventType || "ALERT",
                data.minSeverity || "P2",
                data.channelId,
                data.cooldownMinutes || 15,
                data.escalationTimeoutMinutes || null,
                data.escalationChannelId || null,
                data.isEnabled !== false ? 1 : 0,
                isoNow,
                isoNow,
            ]
        );

        const newId = await R.getCell("SELECT last_insert_rowid()");
        return R.getRow("SELECT * FROM notification_routing_rule WHERE id = ? AND organization_id = ?", [newId, orgId]);
    }

    /**
     * Get routing rules for organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array<object>>} Rules list
     */
    async getRoutingRules(organizationId) {
        const orgId = organizationId || 1;
        return R.getAll(
            `SELECT r.*, c.name as channel_name, c.channel_type
             FROM notification_routing_rule r
             LEFT JOIN notification_channel c ON r.channel_id = c.id
             WHERE r.organization_id = ?
             ORDER BY r.id DESC`,
            [orgId]
        );
    }

    /**
     * Delete routing rule
     * @param {number} ruleId Rule ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<boolean>} Success boolean
     */
    async deleteRoutingRule(ruleId, organizationId) {
        const orgId = organizationId || 1;
        const result = await R.exec("DELETE FROM notification_routing_rule WHERE id = ? AND organization_id = ?", [ruleId, orgId]);
        return result > 0;
    }

    /**
     * Dispatch notification event with severity evaluation & cooldown duplicate suppression
     * @param {object} event Event payload (eventType, severity, entityId, subject, message)
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array<object>>} Dispatch results
     */
    async dispatchNotification(event, organizationId) {
        const orgId = organizationId || 1;
        const eventType = event.eventType || "ALERT";
        const severity = (event.severity || "P2").toUpperCase();
        const targetEntity = String(event.entityId || "global");

        // P4 is Dashboard Only — Suppress outbound channels
        if (severity === "P4") {
            await this.logDelivery(orgId, eventType, "P4", null, "Dashboard", "SUPPRESSED_DASHBOARD_ONLY", "P4 severity routed to Dashboard only.");
            return [{ status: "SUPPRESSED_DASHBOARD_ONLY", message: "Routed to Dashboard only." }];
        }

        const rules = await R.getAll(
            `SELECT r.*, c.channel_type, c.encrypted_config, c.is_enabled as channel_enabled
             FROM notification_routing_rule r
             JOIN notification_channel c ON r.channel_id = c.id
             WHERE r.organization_id = ? AND r.is_enabled = 1 AND c.is_enabled = 1 AND r.event_type = ?`,
            [orgId, eventType]
        );

        if (!rules || rules.length === 0) {
            return [{ status: "NO_MATCHING_RULES", message: "No active notification rules found." }];
        }

        const results = [];
        const eventRank = this.severityRank[severity] || 2;

        for (const rule of rules) {
            const minRank = this.severityRank[rule.min_severity] || 2;
            if (eventRank < minRank) {
                continue;
            }

            const provider = this.getProvider(rule.channel_type);
            const config = provider.decryptConfig(rule.encrypted_config);
            const recipient = config.to || config.chatId || config.recipientPhoneNumber || config.url || targetEntity;

            // Cooldown Duplicate Suppression Check
            const lastLog = await R.getRow(
                `SELECT * FROM notification_delivery_log
                 WHERE organization_id = ? AND channel_id = ? AND recipient = ? AND status = 'SUCCESS'
                 ORDER BY delivered_at DESC LIMIT 1`,
                [orgId, rule.channel_id, String(recipient)]
            );

            if (lastLog && lastLog.delivered_at) {
                const elapsedMs = new Date() - new Date(lastLog.delivered_at);
                const cooldownMs = (rule.cooldown_minutes || 15) * 60 * 1000;
                if (elapsedMs < cooldownMs) {
                    await this.logDelivery(orgId, eventType, severity, rule.channel_id, recipient, "SUPPRESSED_COOLDOWN", `Suppressed due to ${rule.cooldown_minutes}m cooldown window.`);
                    results.push({ status: "SUPPRESSED_COOLDOWN", ruleId: rule.id });
                    continue;
                }
            }

            // Dispatch via Provider
            try {
                const res = await provider.sendNotification({
                    config,
                    recipient,
                    subject: event.subject || `InfiniNOC ${severity} ${eventType}`,
                    body: event.message || `Notification event ${eventType} triggered.`,
                });

                await this.logDelivery(orgId, eventType, severity, rule.channel_id, recipient, "SUCCESS", null);
                results.push({ status: "SUCCESS", channelId: rule.channel_id, recipient });
            } catch (e) {
                await this.logDelivery(orgId, eventType, severity, rule.channel_id, targetEntity, "FAILED", e.message);
                results.push({ status: "FAILED", channelId: rule.channel_id, error: e.message });
            }
        }

        return results;
    }

    /**
     * Log delivery audit entry without storing provider secrets
     * @param {number} orgId Org ID
     * @param {string} eventType Event type
     * @param {string} severity Severity
     * @param {number} channelId Channel ID
     * @param {string} recipient Recipient address/target
     * @param {string} status Status
     * @param {string} errorMsg Error message
     * @returns {Promise<void>}
     */
    async logDelivery(orgId, eventType, severity, channelId, recipient, status, errorMsg) {
        const isoNow = new Date().toISOString();
        await R.exec(
            `INSERT INTO notification_delivery_log (
                organization_id, event_type, severity, channel_id, recipient, status, error_message, delivered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orgId, eventType, severity, channelId || null, String(recipient || "global"), status, errorMsg || null, isoNow]
        );
    }

    /**
     * Get delivery logs
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array<object>>} Logs list
     */
    async getDeliveryLogs(organizationId) {
        const orgId = organizationId || 1;
        return R.getAll(
            `SELECT l.*, c.name as channel_name, c.channel_type
             FROM notification_delivery_log l
             LEFT JOIN notification_channel c ON l.channel_id = c.id
             WHERE l.organization_id = ?
             ORDER BY l.delivered_at DESC LIMIT 100`,
            [orgId]
        );
    }
}

const router = new NotificationRouter();
module.exports = router;
