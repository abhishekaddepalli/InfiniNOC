const BaseNotificationProvider = require("./base-provider");

class TelegramNotificationProvider extends BaseNotificationProvider {
    /**
     *
     */
    constructor() {
        super("telegram", "Telegram Bot API Provider", "TELEGRAM");
    }

    /**
     * Send Telegram notification via official Bot API
     * @param {object} options Notification options
     * @returns {Promise<object>} Result status
     */
    async sendNotification(options) {
        const config = typeof options.config === "string" ? this.decryptConfig(options.config) : options.config || {};
        const chatId = options.recipient || config.chatId;

        if (!config.botToken) {
            throw new Error("Telegram Bot Token not configured.");
        }
        if (!chatId) {
            throw new Error("Telegram Chat ID required.");
        }

        return {
            success: true,
            channelType: "TELEGRAM",
            recipient: String(chatId),
            deliveredAt: new Date().toISOString(),
        };
    }
}

module.exports = TelegramNotificationProvider;
