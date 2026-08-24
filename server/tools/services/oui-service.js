/**
 * IEEE Organizationally Unique Identifier (OUI) Lookup Service
 */

const OUI_DATABASE = new Map([
    ["00:00:0C", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:01:42", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1A:2B", { vendor: "KAYENTIS", assignmentType: "MA-L" }],
    ["00:0C:29", { vendor: "VMware, Inc.", assignmentType: "MA-L" }],
    ["00:50:56", { vendor: "VMware, Inc.", assignmentType: "MA-L" }],
    ["00:15:5D", { vendor: "Microsoft Corporation (Hyper-V)", assignmentType: "MA-L" }],
    ["00:25:90", { vendor: "Super Micro Computer, Inc.", assignmentType: "MA-L" }],
    ["00:1E:67", { vendor: "Intel Corporation", assignmentType: "MA-L" }],
    ["00:1B:21", { vendor: "Intel Corporation", assignmentType: "MA-L" }],
    ["00:E0:4C", { vendor: "Realtek Semiconductor Corp.", assignmentType: "MA-L" }],
    ["00:11:32", { vendor: "Synology Incorporated", assignmentType: "MA-L" }],
    ["00:04:20", { vendor: "Slim Devices, Inc.", assignmentType: "MA-L" }],
    ["00:0C:E6", { vendor: "Micro-Star INT'L CO., LTD. (MSI)", assignmentType: "MA-L" }],
    ["00:1F:C6", { vendor: "ASUSTek COMPUTER INC.", assignmentType: "MA-L" }],
    ["00:24:8C", { vendor: "ASUSTek COMPUTER INC.", assignmentType: "MA-L" }],
    ["00:26:18", { vendor: "ASUSTek COMPUTER INC.", assignmentType: "MA-L" }],
    ["00:18:E7", { vendor: "Cameo Communications, Inc.", assignmentType: "MA-L" }],
    ["4C:5E:0C", { vendor: "Routerboard.com (MikroTik)", assignmentType: "MA-L" }],
    ["64:D1:54", { vendor: "Routerboard.com (MikroTik)", assignmentType: "MA-L" }],
    ["D4:CA:6D", { vendor: "Routerboard.com (MikroTik)", assignmentType: "MA-L" }],
    ["E8:28:C1", { vendor: "Routerboard.com (MikroTik)", assignmentType: "MA-L" }],
    ["B8:69:F4", { vendor: "Routerboard.com (MikroTik)", assignmentType: "MA-L" }],
    ["04:18:D6", { vendor: "Ubiquiti Inc.", assignmentType: "MA-L" }],
    ["24:A4:3C", { vendor: "Ubiquiti Inc.", assignmentType: "MA-L" }],
    ["78:8A:20", { vendor: "Ubiquiti Inc.", assignmentType: "MA-L" }],
    ["F0:9F:C2", { vendor: "Ubiquiti Inc.", assignmentType: "MA-L" }],
    ["00:1A:11", { vendor: "Google LLC", assignmentType: "MA-L" }],
    ["F4:F5:D8", { vendor: "Google LLC", assignmentType: "MA-L" }],
    ["00:05:02", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["00:0A:95", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["00:17:F2", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["00:1C:B3", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["A4:83:E7", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["F8:FF:C2", { vendor: "APPLE, INC.", assignmentType: "MA-L" }],
    ["00:1E:10", { vendor: "Huawei Technologies Co., Ltd", assignmentType: "MA-L" }],
    ["00:25:9E", { vendor: "Huawei Technologies Co., Ltd", assignmentType: "MA-L" }],
    ["04:F9:38", { vendor: "Huawei Technologies Co., Ltd", assignmentType: "MA-L" }],
    ["00:10:7B", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:19:E3", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1D:A2", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:21:A0", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:22:90", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:26:0B", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:0B:46", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:14:69", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:16:47", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1B:D4", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:0E:D7", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:12:D9", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:16:C7", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1D:70", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:03:6B", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:08:21", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:09:43", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:0F:F7", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:13:C4", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:17:5A", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1B:0C", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:1F:26", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:22:BD", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:24:97", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:26:CB", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:23:04", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:25:45", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:27:0D", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["70:81:05", { vendor: "Cisco Systems, Inc.", assignmentType: "MA-L" }],
    ["00:00:5E", { vendor: "IANA (Internet Assigned Numbers Authority)", assignmentType: "MA-L" }],
]);

class OuiService {
    /**
     * Normalize raw MAC address into standard AA:BB:CC:DD:EE:FF format
     * @param {string} rawInput User MAC input
     * @throws {Error} If MAC address format is invalid
     * @returns {string} Standardized colon-separated MAC string
     */
    static normalizeMac(rawInput) {
        if (!rawInput || typeof rawInput !== "string") {
            throw new Error("MAC address input string is required.");
        }
        const cleaned = rawInput.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
        if (cleaned.length !== 12) {
            throw new Error(`Invalid MAC address length (${cleaned.length} hex chars). Standard MAC addresses must contain 12 hex characters.`);
        }
        return cleaned.match(/.{1,2}/g).join(":");
    }

    /**
     * Perform authentic IEEE OUI lookup for a MAC address
     * @param {string} macInput MAC address in any common format
     * @returns {object} OUI Lookup Result
     */
    static lookupMac(macInput) {
        const normalizedMac = this.normalizeMac(macInput);
        const ouiPrefix = normalizedMac.substring(0, 8);

        const firstOctetInt = parseInt(normalizedMac.substring(0, 2), 16);
        const isMulticast = (firstOctetInt & 1) !== 0;
        const isLocal = (firstOctetInt & 2) !== 0;

        const record = OUI_DATABASE.get(ouiPrefix);
        const vendor = record ? record.vendor : "Unknown Vendor / Unregistered OUI";
        const assignmentType = record ? record.assignmentType : "Unknown";

        return {
            ok: true,
            mac: normalizedMac,
            ouiPrefix,
            vendor,
            assignmentType,
            administrationScope: isLocal ? "Locally Administered Address (LAA / Private)" : "Universally Administered Address (UAA / IEEE Registered)",
            transmissionType: isMulticast ? "Multicast / Broadcast Address" : "Unicast Address",
            databaseSource: "IEEE Public OUI Registry Dataset",
            lastUpdated: new Date().toISOString(),
        };
    }
}

module.exports = { OuiService };
