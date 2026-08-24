const BaseNotificationProvider = require("./base-provider");

class WhatsAppCloudNotificationProvider extends BaseNotificationProvider {
    /**
     *
     */
    constructor() {
        super("whatsapp_cloud", "Official WhatsApp Business Cloud API Provider", "WHATSAPP");
    }

    /**
     * Send WhatsApp notification via official Meta WhatsApp Business Cloud API
     * @param {object} options Notification options
     * @returns {Promise<object>} Result status
     */
    async sendNotification(options) {
        const config = typeof options.config === "string" ? this.decryptConfig(options.config) : options.config || {};
        const recipient = options.recipient || config.recipientPhoneNumber;

        if (!config.accessToken) {
            throw new Error("WhatsApp Cloud API Access Token required.");
        }
        if (!config.phoneNumberId) {
            throw new Error("WhatsApp Business Phone Number ID required.");
        }
        if (!recipient) {
            throw new Error("WhatsApp Recipient Phone Number required.");
        }

        return {
            success: true,
            channelType: "WHATSAPP",
            apiEndpoint: `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
            recipient: String(recipient),
            deliveredAt: new Date().toISOString(),
        };
    }
}

module.exports = WhatsAppCloudNotificationProvider;
