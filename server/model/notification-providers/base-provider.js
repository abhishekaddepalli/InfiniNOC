const { encryptSecret, decryptSecret } = require("../credential-crypto");

class BaseNotificationProvider {
    /**
     * Base Notification Provider Constructor
     * @param {string} id Provider ID
     * @param {string} name Human-readable name
     * @param {string} channelType Channel type (EMAIL, TELEGRAM, WHATSAPP, WEBHOOK)
     */
    constructor(id = "base", name = "Generic Provider", channelType = "WEBHOOK") {
        this.id = id;
        this.name = name;
        this.channelType = channelType;
    }

    /**
     * Encrypt config object containing provider credentials using AES-256-GCM
     * @param {object} rawConfig Raw configuration dictionary
     * @returns {string} Encrypted ciphertext string
     */
    encryptConfig(rawConfig) {
        if (!rawConfig) {
            return "";
        }
        const encObj = encryptSecret(rawConfig);
        return JSON.stringify(encObj);
    }

    /**
     * Decrypt AES-256-GCM ciphertext into provider configuration object
     * @param {string} encryptedString Ciphertext string
     * @returns {object} Decrypted config object
     */
    decryptConfig(encryptedString) {
        if (!encryptedString) {
            return {};
        }
        try {
            const encObj = typeof encryptedString === "string" ? JSON.parse(encryptedString) : encryptedString;
            if (encObj.encrypted_data && encObj.iv && encObj.auth_tag) {
                const res = decryptSecret(encObj.encrypted_data, encObj.iv, encObj.auth_tag);
                return typeof res === "string" ? JSON.parse(res) : res;
            }
            return encObj;
        } catch (e) {
            return {};
        }
    }

    /**
     * Abstract send notification method
     * @param {object} options Options object containing recipient, subject, body, payload, config
     * @returns {Promise<object>} Result status object
     */
    async sendNotification(options) {
        if (!options || !options.recipient) {
            throw new Error("Recipient required.");
        }
        return {
            success: true,
            provider: this.id,
            deliveredAt: new Date().toISOString(),
        };
    }
}

module.exports = BaseNotificationProvider;
