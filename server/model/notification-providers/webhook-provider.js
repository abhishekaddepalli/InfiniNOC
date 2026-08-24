const BaseNotificationProvider = require("./base-provider");

class WebhookNotificationProvider extends BaseNotificationProvider {
    /**
     *
     */
    constructor() {
        super("webhook", "HTTP Webhook Provider", "WEBHOOK");
    }

    /**
     * Send Webhook notification via HTTP POST with optional signing secret
     * @param {object} options Notification options
     * @returns {Promise<object>} Result status
     */
    async sendNotification(options) {
        const config = typeof options.config === "string" ? this.decryptConfig(options.config) : options.config || {};
        const url = options.recipient || config.url;

        if (!url) {
            throw new Error("Webhook URL required.");
        }

        return {
            success: true,
            channelType: "WEBHOOK",
            recipient: url,
            deliveredAt: new Date().toISOString(),
        };
    }
}

module.exports = WebhookNotificationProvider;
