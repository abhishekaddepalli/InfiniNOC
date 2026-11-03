/**
 * VLAN ID & 802.1Q Network Tag Validator
 */
class VlanCalculator {
    /**
     * Validate and classify 802.1Q VLAN ID
     * @param {object} params Parameter object
     * @param {number|string} params.vlanId VLAN ID (0-4095)
     * @returns {object} Validation result
     */
    static execute({ vlanId }) {
        const id = parseInt(vlanId, 10);
        if (isNaN(id)) {
            return {
                ok: false,
                status: "INVALID_INPUT",
                error: "VLAN ID must be a valid integer between 1 and 4094.",
            };
        }

        if (id < 0 || id > 4095) {
            return {
                ok: false,
                status: "OUT_OF_RANGE",
                error: `VLAN ID ${id} is outside the 12-bit IEEE 802.1Q range (0 - 4095).`,
            };
        }

        let rangeType = "NORMAL";
        let description = "Standard Ethernet user VLAN";
        let isConfigurable = true;
        let isReserved = false;

        if (id === 0) {
            rangeType = "RESERVED";
            description = "Priority-tagged frames only; indicates no VLAN identification.";
            isConfigurable = false;
            isReserved = true;
        } else if (id === 1) {
            rangeType = "DEFAULT";
            description = "Default Native VLAN (Cisco/Standard Ethernet). Often used for management traffic.";
            isConfigurable = true;
        } else if (id >= 2 && id <= 1001) {
            rangeType = "NORMAL";
            description = "Normal-range VLAN. Supported across all switches and routers.";
            isConfigurable = true;
        } else if (id >= 1002 && id <= 1005) {
            rangeType = "LEGACY_RESERVED";
            description = "Legacy Token Ring and FDDI VLANs. Typically cannot be deleted on older equipment.";
            isConfigurable = false;
            isReserved = true;
        } else if (id >= 1006 && id <= 4094) {
            rangeType = "EXTENDED";
            description = "Extended-range VLAN for enterprise networks, Metro Ethernet and ISPs.";
            isConfigurable = true;
        } else if (id === 4095) {
            rangeType = "RESERVED";
            description = "Reserved for internal system use, testing, and wildcards. Cannot be configured.";
            isConfigurable = false;
            isReserved = true;
        }

        return {
            ok: true,
            status: isReserved ? "RESERVED" : "VALID",
            vlanId: id,
            binary: id.toString(2).padStart(12, "0"),
            hex: "0x" + id.toString(16).padStart(3, "0").toUpperCase(),
            rangeType,
            description,
            isConfigurable,
            isReserved,
            standard: "IEEE 802.1Q (12-bit VID)",
        };
    }
}

module.exports = { VlanCalculator };
