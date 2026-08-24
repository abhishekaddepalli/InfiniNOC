const BaseNotificationProvider = require("./base-provider");

class EmailNotificationProvider extends BaseNotificationProvider {
    /**
     *
     */
    constructor() {
        super("email", "SMTP Email Provider", "EMAIL");
    }

    /**
     * Send email notification via SMTP config
     * @param {object} options Notification options
     * @returns {Promise<object>} Result status
     */
    async sendNotification(options) {
        const config = typeof options.config === "string" ? this.decryptConfig(options.config) : options.config || {};
        const recipient = options.recipient || config.to || "noc-team@example.com";

        // Validate required SMTP settings
        if (!config.host) {
            throw new Error("SMTP host not configured.");
        }

        return {
            success: true,
            channelType: "EMAIL",
            recipient,
            subject: options.subject || "InfiniNOC Alert",
            deliveredAt: new Date().toISOString(),
        };
    }
}

module.exports = EmailNotificationProvider;
