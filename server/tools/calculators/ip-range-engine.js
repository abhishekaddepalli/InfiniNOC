const net = require("net");
const { SubnetEngine } = require("./subnet-engine");

/**
 * IP Range Calculator Engine
 */
class IpRangeEngine {
    /**
     * Calculate covering CIDRs and address statistics for an IP Range
     * @param {string} startIp First IP in range
     * @param {string} endIp Last IP in range
     * @throws {Error} If IP addresses are invalid or mismatched
     * @returns {object} IP Range calculation result
     */
    static calculateRange(startIp, endIp) {
        if (!startIp || !endIp) {
            throw new Error("Both Start IP and End IP addresses are required.");
        }

        const cleanStart = startIp.trim();
        const cleanEnd = endIp.trim();

        const startType = net.isIP(cleanStart);
        const endType = net.isIP(cleanEnd);

        if (!startType) {
            throw new Error(`Invalid Start IP address '${cleanStart}'.`);
        }
        if (!endType) {
            throw new Error(`Invalid End IP address '${cleanEnd}'.`);
        }
        if (startType !== endType) {
            throw new Error(`IP family mismatch: Start IP is IPv${startType} while End IP is IPv${endType}.`);
        }

        if (startType === 4) {
            const startInt = SubnetEngine.ipv4ToInt(cleanStart);
            const endInt = SubnetEngine.ipv4ToInt(cleanEnd);

            if (startInt > endInt) {
                throw new Error(`Start IP (${cleanStart}) must be less than or equal to End IP (${cleanEnd}).`);
            }

            const totalAddresses = endInt - startInt + 1;
            const cidrs = this.getCoveringCidrsIPv4(startInt, endInt);

            return {
                ok: true,
                ipVersion: "IPv4",
                startIp: cleanStart,
                endIp: cleanEnd,
                firstAddress: cleanStart,
                lastAddress: cleanEnd,
                totalAddresses,
                coveringCidrs: cidrs,
                checkedAt: new Date().toISOString(),
            };
        }

        return {
            ok: true,
            ipVersion: "IPv6",
            startIp: cleanStart,
            endIp: cleanEnd,
            firstAddress: cleanStart,
            lastAddress: cleanEnd,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Find smallest set of covering CIDR blocks for an IPv4 integer range
     * @param {number} start Unsigned 32-bit start IP integer
     * @param {number} end Unsigned 32-bit end IP integer
     * @returns {Array<string>} List of covering CIDR notation blocks
     */
    static getCoveringCidrsIPv4(start, end) {
        const result = [];
        let current = start;

        while (current <= end) {
            let maxSize = 32;
            while (maxSize > 0) {
                const mask = (~0 << (32 - (maxSize - 1))) >>> 0;
                if ((current & mask) !== current) {
                    break;
                }
                const numAddrs = Math.pow(2, 32 - (maxSize - 1));
                if (current + numAddrs - 1 > end) {
                    break;
                }
                maxSize--;
            }
            result.push(`${SubnetEngine.intToIpv4(current)}/${maxSize}`);
            current += Math.pow(2, 32 - maxSize);
        }

        return result;
    }
}

module.exports = { IpRangeEngine };
