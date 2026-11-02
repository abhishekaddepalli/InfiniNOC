const { R } = require("redbean-node");
const Incident = require("./incident");

class FiberFaultEngine {
    /**
     * Run intelligent fiber fault detection and correlation across all OLTs, PON ports, and ONUs
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of detected or active fiber faults
     */
    static async analyzeAndCorrelateFaults(organizationId) {
        const orgId = organizationId || 1;
        const isoNow = new Date().toISOString();
        const activeFaults = [];

        // 1. Fetch all OLT devices
        const olts = await R.getAll(
            `SELECT olt.*, d.name AS device_name, d.ip_address, d.status AS device_status
             FROM olt_device olt
             JOIN device d ON olt.device_id = d.id
             WHERE olt.organization_id = ?`,
            [orgId]
        );

        for (const olt of olts) {
            // Check OLT reachability
            const isOltDown = olt.device_status === "DOWN";

            // If OLT is DOWN, verify whether upstream switch interface failed (Uplink Failure) or OLT hardware failed
            if (isOltDown) {
                // Check if parent switch link is DOWN
                const upstreamDep = await R.getRow(
                    `SELECT dep.*, pdev.name AS parent_name, pdev.status AS parent_status
                     FROM device_dependency dep
                     JOIN device pdev ON dep.parent_device_id = pdev.id
                     WHERE dep.organization_id = ? AND dep.child_device_id = ?`,
                    [orgId, olt.device_id]
                );

                const faultCat = (upstreamDep && upstreamDep.parent_status === "DOWN")
                    ? "UPLINK_FAILURE"
                    : "OLT_FAILURE";

                const faultTitle = faultCat === "UPLINK_FAILURE"
                    ? `Upstream Uplink Failure to OLT: ${olt.device_name}`
                    : `OLT Outage: ${olt.device_name} Unreachable`;

                const evidence = faultCat === "UPLINK_FAILURE"
                    ? `Parent device ${upstreamDep.parent_name} is DOWN. Uplink interface ${upstreamDep.source_interface || "Trunk"} lost carrier signal.`
                    : `OLT ${olt.device_name} (${olt.ip_address}) failed ICMP/SNMP polling. All ${olt.total_pon_ports} PON ports offline.`;

                const fault = await FiberFaultEngine._upsertFaultIncident(orgId, {
                    faultCategory: faultCat,
                    confidenceLevel: "CONFIRMED",
                    severity: "CRITICAL",
                    oltDeviceId: olt.id,
                    ponPort: null,
                    affectedOnusCount: olt.online_onu_count + olt.offline_onu_count + olt.los_count,
                    evidence,
                    probableLocation: upstreamDep ? `${upstreamDep.parent_name} -> ${olt.device_name}` : `OLT Rack / Power Supply (${olt.ip_address})`,
                    recommendedSteps: "Verify physical AC/DC dual power feeds, check OLT console port, inspect uplink SFP+ optics.",
                });
                activeFaults.push(fault);
                continue;
            }

            // 2. OLT is UP: Inspect PON ports and ONU clusters for shared fiber cuts vs individual drops
            const ponPorts = await R.getAll(
                "SELECT * FROM pon_port WHERE organization_id = ? AND olt_device_id = ?",
                [orgId, olt.id]
            );

            for (const pon of ponPorts) {
                // Fetch ONUs on this PON port
                const onus = await R.getAll(
                    "SELECT * FROM onu_inventory WHERE organization_id = ? AND olt_device_id = ? AND pon_port = ?",
                    [orgId, olt.id, pon.port_identifier]
                );

                if (onus.length === 0) continue;

                const losOnus = onus.filter((o) => o.online_status === "LOS");
                const dyingGaspOnus = onus.filter((o) => o.last_dereg_reason && o.last_dereg_reason.toLowerCase().includes("dying gasp"));
                const totalConfigured = onus.length;

                // Case A: Entire PON port oper_status is DOWN (Transceiver failure or trunk fiber break at OLT)
                if (pon.oper_status === "DOWN" || pon.admin_status === "DOWN") {
                    const fault = await FiberFaultEngine._upsertFaultIncident(orgId, {
                        faultCategory: "PON_PORT_FAILURE",
                        confidenceLevel: "CONFIRMED",
                        severity: "CRITICAL",
                        oltDeviceId: olt.id,
                        ponPort: pon.port_identifier,
                        affectedOnusCount: totalConfigured,
                        evidence: `PON port ${pon.port_identifier} operStatus is DOWN on OLT ${olt.device_name}. Laser bias abnormal. All ${totalConfigured} ONUs affected.`,
                        probableLocation: `OLT Chassis ${olt.device_name} PON SFP Port ${pon.port_identifier}`,
                        recommendedSteps: "Inspect PON transceiver SFP module, clean SC/UPC connector, verify optical output with power meter.",
                    });
                    activeFaults.push(fault);
                    continue;
                }

                // Case B: Shared Fiber Cut Detection (Multiple ONUs reporting LOS simultaneously)
                // Threshold: >= 3 ONUs or > 50% of connected ONUs in LOS state while OLT is healthy
                if (losOnus.length >= 3 || (totalConfigured >= 2 && losOnus.length / totalConfigured >= 0.5)) {
                    // Check if an OTDR measurement exists for this link
                    const otdr = await R.getRow(
                        `SELECT * FROM otdr_measurement
                         WHERE organization_id = ? AND fiber_link_name LIKE ?
                         ORDER BY id DESC LIMIT 1`,
                        [orgId, `%${pon.port_identifier}%`]
                    );

                    const confidence = otdr ? "CONFIRMED" : (losOnus.length >= 5 ? "PROBABLE" : "SUSPECTED");
                    const otdrDistance = otdr ? otdr.event_distance_km : null;
                    const affectedSnList = losOnus.map((o) => o.serial_number);

                    const locationStr = otdrDistance
                        ? `Trunk / Distribution Cable at ~${otdrDistance.toFixed(2)} km from OLT`
                        : `Distribution path between OLT ${olt.device_name} (Port ${pon.port_identifier}) and Primary Splitter (FDC)`;

                    const evidence = `Simultaneous LOS detected across ${losOnus.length} of ${totalConfigured} ONUs on PON port ${pon.port_identifier}. OLT is online and transmitting. ${otdr ? `OTDR trace verified reflection break at ${otdrDistance} km.` : "No Dying Gasp alarms received (indicates physical optical path cut, not power outage)."}`;

                    const fault = await FiberFaultEngine._upsertFaultIncident(orgId, {
                        faultCategory: "SUSPECTED_FIBER_CUT",
                        confidenceLevel: confidence,
                        severity: "CRITICAL",
                        oltDeviceId: olt.id,
                        ponPort: pon.port_identifier,
                        affectedOnusCount: losOnus.length,
                        affectedOnusJson: JSON.stringify(affectedSnList),
                        evidence,
                        probableLocation: locationStr,
                        recommendedSteps: "Dispatch fiber restoration crew with OTDR and fusion splicer. Inspect primary fiber enclosure and route path.",
                        otdrDistanceKm: otdrDistance,
                    });
                    activeFaults.push(fault);
                    continue;
                }

                // Case C: Single/Dual Dying Gasp (Customer premise power interruption, NOT a fiber cut)
                if (dyingGaspOnus.length > 0 && losOnus.length < 3) {
                    const dyingSnList = dyingGaspOnus.map((o) => o.serial_number);
                    const fault = await FiberFaultEngine._upsertFaultIncident(orgId, {
                        faultCategory: "ONU_POWER_FAILURE",
                        confidenceLevel: "CONFIRMED",
                        severity: "MINOR",
                        oltDeviceId: olt.id,
                        ponPort: pon.port_identifier,
                        affectedOnusCount: dyingGaspOnus.length,
                        affectedOnusJson: JSON.stringify(dyingSnList),
                        evidence: `Dying Gasp power failure signal received from ONU(s): ${dyingSnList.join(", ")}. Fiber link is intact.`,
                        probableLocation: `Customer Premise / Power Grid (ONU: ${dyingSnList.join(", ")})`,
                        recommendedSteps: "Check local AC power feed and 12V DC power adapter at customer location. No fiber repair required.",
                    });
                    activeFaults.push(fault);
                    continue;
                }

                // Case D: High Optical Attenuation / Fiber Degradation (Marginal signal: < -27 dBm)
                const degradedOnus = onus.filter((o) => o.rx_power_dbm !== null && o.rx_power_dbm < -27.0 && o.online_status === "ONLINE");
                if (degradedOnus.length >= 2) {
                    const degradedSnList = degradedOnus.map((o) => `${o.serial_number} (${o.rx_power_dbm} dBm)`);
                    const fault = await FiberFaultEngine._upsertFaultIncident(orgId, {
                        faultCategory: "HIGH_ATTENUATION",
                        confidenceLevel: "PROBABLE",
                        severity: "WARNING",
                        oltDeviceId: olt.id,
                        ponPort: pon.port_identifier,
                        affectedOnusCount: degradedOnus.length,
                        affectedOnusJson: JSON.stringify(degradedSnList),
                        evidence: `Optical attenuation exceeds -27 dBm on ${degradedOnus.length} ONUs: ${degradedSnList.join(", ")}. Signal margin degraded.`,
                        probableLocation: `Distribution Splitter or dirty optical connector on PON ${pon.port_identifier}`,
                        recommendedSteps: "Clean optical patch cords with fiber pen, verify optical splice loss, inspect macro-bends in fiber tray.",
                    });
                    activeFaults.push(fault);
                }
            }
        }

        // Auto-resolve stale faults that are no longer active
        await FiberFaultEngine._resolveStaleFaults(orgId, activeFaults);

        return activeFaults;
    }

    /**
     * Upsert a fiber fault incident and synchronize with the main incident lifecycle
     * @param {number} orgId Organization ID
     * @param {object} faultData Fault details
     * @returns {Promise<object>} Created or updated fault
     * @private
     */
    static async _upsertFaultIncident(orgId, faultData) {
        const isoNow = new Date().toISOString();

        // Check if an existing ACTIVE fault matches this category and PON port/OLT
        let existing = null;
        if (faultData.ponPort) {
            existing = await R.getRow(
                `SELECT * FROM fiber_fault_incident
                 WHERE organization_id = ? AND fault_category = ? AND olt_device_id = ? AND pon_port = ? AND status IN ('ACTIVE', 'INVESTIGATING')`,
                [orgId, faultData.faultCategory, faultData.oltDeviceId, faultData.ponPort]
            );
        } else {
            existing = await R.getRow(
                `SELECT * FROM fiber_fault_incident
                 WHERE organization_id = ? AND fault_category = ? AND olt_device_id = ? AND pon_port IS NULL AND status IN ('ACTIVE', 'INVESTIGATING')`,
                [orgId, faultData.faultCategory, faultData.oltDeviceId]
            );
        }

        if (existing) {
            await R.exec(
                `UPDATE fiber_fault_incident SET
                    confidence_level = ?, severity = ?, affected_onus_count = ?, affected_onus_json = ?,
                    evidence = ?, probable_location = ?, recommended_steps = ?, otdr_distance_km = ?
                 WHERE id = ?`,
                [
                    faultData.confidenceLevel,
                    faultData.severity,
                    faultData.affectedOnusCount,
                    faultData.affectedOnusJson || null,
                    faultData.evidence,
                    faultData.probableLocation,
                    faultData.recommendedSteps,
                    faultData.otdrDistanceKm || null,
                    existing.id,
                ]
            );
            return await R.getRow("SELECT * FROM fiber_fault_incident WHERE id = ?", [existing.id]);
        } else {
            await R.exec(
                `INSERT INTO fiber_fault_incident (
                    organization_id, fault_category, confidence_level, severity, status,
                    olt_device_id, pon_port, affected_onus_count, affected_onus_json,
                    evidence, probable_location, recommended_steps, otdr_distance_km,
                    detected_at, created_at
                ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId,
                    faultData.faultCategory,
                    faultData.confidenceLevel,
                    faultData.severity,
                    faultData.oltDeviceId,
                    faultData.ponPort || null,
                    faultData.affectedOnusCount,
                    faultData.affectedOnusJson || null,
                    faultData.evidence,
                    faultData.probableLocation,
                    faultData.recommendedSteps,
                    faultData.otdrDistanceKm || null,
                    isoNow,
                    isoNow,
                ]
            );

            const newId = await R.getCell("SELECT MAX(id) FROM fiber_fault_incident WHERE organization_id = ?", [orgId]);
            const created = await R.getRow("SELECT * FROM fiber_fault_incident WHERE id = ?", [newId]);

            // Synchronize with main Incident management system for P1/P2 NOC response
            try {
                const incTitle = `Fiber Fault: [${faultData.confidenceLevel}] ${faultData.faultCategory.replace(/_/g, " ")}${faultData.ponPort ? " on PON " + faultData.ponPort : ""}`;
                const incSeverity = faultData.severity === "CRITICAL" ? "P1" : (faultData.severity === "MAJOR" ? "P2" : "P3");
                await Incident.createIncident(
                    {
                        title: incTitle,
                        description: faultData.evidence,
                        severity: incSeverity,
                        failure_reason: `[${faultData.confidenceLevel}] ${faultData.faultCategory}: ${faultData.evidence}`,
                    },
                    orgId,
                    null
                );
            } catch (err) {
                console.error("[FiberFaultEngine] Error synchronizing incident:", err.message);
            }

            return created;
        }
    }

    /**
     * Mark faults as RESOLVED when conditions clear
     * @param {number} orgId Organization ID
     * @param {Array} currentActiveFaults Currently detected active faults
     * @private
     */
    static async _resolveStaleFaults(orgId, currentActiveFaults) {
        const activeIds = currentActiveFaults.map((f) => f.id);
        const isoNow = new Date().toISOString();

        if (activeIds.length > 0) {
            const placeholders = activeIds.map(() => "?").join(",");
            await R.exec(
                `UPDATE fiber_fault_incident SET
                    status = 'RESOLVED', resolved_at = ?
                 WHERE organization_id = ? AND status = 'ACTIVE' AND id NOT IN (${placeholders})`,
                [isoNow, orgId, ...activeIds]
            );
        } else {
            await R.exec(
                `UPDATE fiber_fault_incident SET
                    status = 'RESOLVED', resolved_at = ?
                 WHERE organization_id = ? AND status = 'ACTIVE'`,
                [isoNow, orgId]
            );
        }
    }

    /**
     * Get active fiber faults for an organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of active faults
     */
    static async getActiveFiberFaults(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll(
            `SELECT
                f.*,
                olt.model AS olt_model,
                d.name AS olt_name,
                d.ip_address AS olt_ip
             FROM fiber_fault_incident f
             LEFT JOIN olt_device olt ON f.olt_device_id = olt.id
             LEFT JOIN device d ON olt.device_id = d.id
             WHERE f.organization_id = ? AND f.status IN ('ACTIVE', 'INVESTIGATING')
             ORDER BY f.id DESC`,
            [orgId]
        );
    }
}

module.exports = FiberFaultEngine;
