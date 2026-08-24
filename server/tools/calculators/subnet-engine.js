const net = require("net");

/**
 * Deterministic Subnet & CIDR Mathematics Engine (IPv4 & IPv6)
 */
class SubnetEngine {
    /**
     * Parse IPv4 address string to 32-bit unsigned integer
     * @param {string} ipStr IPv4 address
     * @returns {number} 32-bit integer representation
     */
    static ipv4ToInt(ipStr) {
        return ipStr.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    /**
     * Convert 32-bit unsigned integer to IPv4 address string
     * @param {number} intVal 32-bit integer
     * @returns {string} IPv4 string
     */
    static intToIpv4(intVal) {
        return [
            (intVal >>> 24) & 255,
            (intVal >>> 16) & 255,
            (intVal >>> 8) & 255,
            intVal & 255,
        ].join(".");
    }

    /**
     * Calculate IPv4 Subnet Mathematics
     * @param {string} cidrInput Target CIDR e.g., "192.168.10.0/24" or IP "192.168.10.5"
     * @throws {Error} If CIDR input or address syntax is invalid
     * @returns {object} Subnet calculation result
     */
    static calculateIpv4(cidrInput) {
        if (!cidrInput || typeof cidrInput !== "string") {
            throw new Error("CIDR input string is required.");
        }

        let [ipPart, maskPart] = cidrInput.trim().split("/");
        let prefix = parseInt(maskPart, 10);

        if (isNaN(prefix)) {
            prefix = 32;
        }

        if (prefix < 0 || prefix > 32) {
            throw new Error(`Invalid IPv4 CIDR prefix /${prefix}. Prefix must be between 0 and 32.`);
        }

        if (net.isIP(ipPart) !== 4) {
            throw new Error(`Invalid IPv4 address '${ipPart}'.`);
        }

        const ipInt = this.ipv4ToInt(ipPart);
        const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        const wildcardInt = (~maskInt) >>> 0;

        const networkInt = (ipInt & maskInt) >>> 0;
        const broadcastInt = (networkInt | wildcardInt) >>> 0;

        const totalAddresses = Math.pow(2, 32 - prefix);
        let usableHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : totalAddresses - 2;
        if (usableHosts < 0) {
            usableHosts = 0;
        }

        let firstHostInt = prefix === 32 ? networkInt : networkInt + 1;
        let lastHostInt = prefix === 32 ? networkInt : broadcastInt - 1;

        if (prefix === 31) {
            firstHostInt = networkInt;
            lastHostInt = broadcastInt;
        }

        const parts = ipPart.split(".").map(Number);
        let classification = "Public";

        if (parts[0] === 10) {
            classification = "Private (RFC1918)";
        } else if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
            classification = "Private (RFC1918)";
        } else if (parts[0] === 192 && parts[1] === 168) {
            classification = "Private (RFC1918)";
        } else if (parts[0] === 127) {
            classification = "Loopback";
        } else if (parts[0] === 169 && parts[1] === 254) {
            classification = "Link-Local";
        } else if (parts[0] >= 224 && parts[0] <= 239) {
            classification = "Multicast";
        }

        return {
            ok: true,
            ipVersion: "IPv4",
            input: cidrInput,
            ipAddress: ipPart,
            prefix: `/${prefix}`,
            networkAddress: this.intToIpv4(networkInt),
            subnetMask: this.intToIpv4(maskInt),
            wildcardMask: this.intToIpv4(wildcardInt),
            broadcastAddress: prefix === 32 ? "N/A (Host Route)" : this.intToIpv4(broadcastInt),
            totalAddresses,
            usableHosts,
            firstHost: this.intToIpv4(firstHostInt),
            lastHost: this.intToIpv4(lastHostInt),
            usableHostRange: `${this.intToIpv4(firstHostInt)} - ${this.intToIpv4(lastHostInt)}`,
            classification,
            checkedAt: new Date().toISOString(),
        };
    }

    /**
     * Calculate IPv6 Subnet Mathematics
     * @param {string} cidrInput Target IPv6 CIDR e.g., "2001:db8::/64"
     * @throws {Error} If IPv6 CIDR syntax is invalid
     * @returns {object} IPv6 calculation result
     */
    static calculateIpv6(cidrInput) {
        let [ipPart, maskPart] = cidrInput.trim().split("/");
        let prefix = parseInt(maskPart, 10);

        if (isNaN(prefix)) {
            prefix = 128;
        }

        if (prefix < 0 || prefix > 128) {
            throw new Error(`Invalid IPv6 CIDR prefix /${prefix}. Prefix must be between 0 and 128.`);
        }

        if (net.isIP(ipPart) !== 6) {
            throw new Error(`Invalid IPv6 address '${ipPart}'.`);
        }

        let classification = "Global Unicast";
        const cleanIp = ipPart.toLowerCase();

        if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") {
            classification = "Loopback";
        } else if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) {
            classification = "Link-Local";
        } else if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) {
            classification = "Unique Local";
        } else if (cleanIp.startsWith("ff")) {
            classification = "Multicast";
        }

        return {
            ok: true,
            ipVersion: "IPv6",
            input: cidrInput,
            ipAddress: ipPart,
            prefix: `/${prefix}`,
            networkAddress: ipPart,
            totalAddresses: prefix === 128 ? "1" : `2^${128 - prefix}`,
            usableHosts: prefix === 128 ? "1" : `2^${128 - prefix}`,
            classification,
            note: "IPv6 does not use broadcast addresses or subnetwork host offsets in traditional IPv4 style.",
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = { SubnetEngine };
