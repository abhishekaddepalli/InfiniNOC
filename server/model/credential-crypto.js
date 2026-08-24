const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const MASTER_KEY = crypto.scryptSync("infininoc-credential-secret-key-2026", "infininoc-salt", 32);

/**
 * Encrypt a credential payload using AES-256-GCM
 * @param {object|string} payload Credential secret object or string
 * @returns {object} Encrypted object containing { encrypted_data, iv, auth_tag }
 */
function encryptSecret(payload) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return {
        encrypted_data: encrypted,
        iv: iv.toString("hex"),
        auth_tag: authTag,
    };
}

/**
 * Decrypt an AES-256-GCM encrypted credential payload
 * @param {string} encryptedHex Encrypted hex payload
 * @param {string} ivHex Initialization vector hex
 * @param {string} authTagHex Authentication tag hex
 * @returns {object|string} Decrypted payload
 */
function decryptSecret(encryptedHex, ivHex, authTagHex) {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    try {
        return JSON.parse(decrypted);
    } catch {
        return decrypted;
    }
}

module.exports = {
    encryptSecret,
    decryptSecret,
};
