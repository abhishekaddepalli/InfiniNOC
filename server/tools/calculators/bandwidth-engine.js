/**
 * Deterministic Bandwidth & Data Transfer Time Calculator
 */
class BandwidthEngine {
    /**
     * Calculate file transfer times across various network link speeds
     * @param {object} params Target parameters
     * @param {number} params.fileSize File size number
     * @param {string} params.sizeUnit Size unit (MB, GB, TB)
     * @throws {Error} If file size input is invalid
     * @returns {object} Bandwidth calculation result
     */
    static calculateTransfer({ fileSize, sizeUnit = "GB" }) {
        const size = parseFloat(fileSize);
        if (isNaN(size) || size <= 0) {
            throw new Error("File size must be a positive number.");
        }

        const unit = (sizeUnit || "GB").toUpperCase();
        let bytes = size;

        if (unit === "KB") {
            bytes = size * 1024;
        } else if (unit === "MB") {
            bytes = size * 1024 * 1024;
        } else if (unit === "GB") {
            bytes = size * 1024 * 1024 * 1024;
        } else if (unit === "TB") {
            bytes = size * 1024 * 1024 * 1024 * 1024;
        }

        const bits = bytes * 8;

        const speeds = [
            { name: "56 Kbps (Dial-Up)", speedbps: 56 * 1000 },
            { name: "10 Mbps (Fast Ethernet)", speedbps: 10 * 1000 * 1000 },
            { name: "100 Mbps (Fast Ethernet)", speedbps: 100 * 1000 * 1000 },
            { name: "1 Gbps (Gigabit Fiber)", speedbps: 1000 * 1000 * 1000 },
            { name: "10 Gbps (Enterprise Core)", speedbps: 10000 * 1000 * 1000 },
            { name: "100 Gbps (Backbone Data Center)", speedbps: 100000 * 1000 * 1000 },
        ];

        const matrix = speeds.map((s) => {
            const seconds = bits / s.speedbps;
            return {
                linkName: s.name,
                speedMbps: s.speedbps / (1000 * 1000),
                seconds: Math.round(seconds * 100) / 100,
                formattedTime: this.formatSeconds(seconds),
            };
        });

        return {
            ok: true,
            fileSize: size,
            sizeUnit: unit,
            totalBytes: bytes,
            totalBits: bits,
            transferMatrix: matrix,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Format raw seconds into human-readable duration
     * @param {number} totalSeconds Total seconds
     * @returns {string} Human formatted duration string
     */
    static formatSeconds(totalSeconds) {
        if (totalSeconds < 1) {
            return `${Math.round(totalSeconds * 1000)} ms`;
        }
        if (totalSeconds < 60) {
            return `${Math.round(totalSeconds * 10) / 10} sec`;
        }

        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);

        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
    }
}

module.exports = { BandwidthEngine };
