const { R } = require("redbean-node");
const { toSqlDatetime } = require("../util-server");

// Standard TIA-598 12-color fiber color code scheme
const TIA598_COLORS = [
    "Blue", "Orange", "Green", "Brown", "Slate", "White",
    "Red", "Black", "Yellow", "Violet", "Rose", "Aqua"
];

// Standard nominal splitter insertion losses (typical industry manufacturer specifications)
const NOMINAL_SPLITTER_LOSSES = {
    "1:2": 3.5,
    "1:4": 7.2,
    "1:8": 10.5,
    "1:16": 13.8,
    "1:32": 17.1,
    "1:64": 20.5,
};

// Fiber attenuation coefficients per km
const ATTENUATION_COEFFICIENTS = {
    "1310": 0.35, // 1310 nm Singlemode: ~0.35 dB/km
    "1490": 0.22, // 1490 nm Singlemode: ~0.22 dB/km
    "1550": 0.20, // 1550 nm Singlemode: ~0.20 dB/km
};

class FiberInfrastructure {
    /**
     * Record an entry in the infrastructure audit log
     * @param {number} organizationId Organization ID
     * @param {string} action Action type (CREATE, UPDATE, DELETE, PORT_CONNECT, etc.)
     * @param {string} entityType Entity type (SPLITTER, CABLE, STRAND, CLOSURE, LINK)
     * @param {number|null} entityId Entity ID
     * @param {string} entityName Entity name
     * @param {object} details Additional details
     * @param {number|null} userId User ID
     */
    static async logAudit(organizationId, action, entityType, entityId, entityName, details = {}, userId = null) {
        try {
            const orgId = organizationId || 1;
            const isoNow = toSqlDatetime();
            await R.exec(
                `INSERT INTO infrastructure_audit_log (
                    organization_id, user_id, action, entity_type, entity_id, entity_name, details_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId,
                    userId || null,
                    action,
                    entityType,
                    entityId || null,
                    entityName || null,
                    JSON.stringify(details),
                    isoNow,
                ]
            );
        } catch (e) {
            console.error("[FiberInfrastructure] Audit log error:", e.message);
        }
    }

    // =========================================================================
    // 1. SPLITTERS & SPLITTER PORTS MANAGEMENT
    // =========================================================================

    /**
     * List all splitters for an organization with port capacity metrics
     * @param {number} organizationId Organization ID
     * @param {object} filter Optional filters
     * @returns {Promise<Array>} List of splitters
     */
    static async getSplitters(organizationId, filter = {}) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT
                s.*,
                d.name AS olt_name,
                d.ip_address AS olt_ip,
                parent.name AS parent_splitter_name,
                site.name AS site_name
            FROM fiber_splitter s
            LEFT JOIN olt_device olt ON s.olt_device_id = olt.id
            LEFT JOIN device d ON olt.device_id = d.id
            LEFT JOIN fiber_splitter parent ON s.parent_splitter_id = parent.id
            LEFT JOIN site ON s.site_id = site.id
            WHERE s.organization_id = ?
        `;
        const params = [orgId];

        if (filter.tier_level) {
            sql += " AND s.tier_level = ?";
            params.push(Number(filter.tier_level));
        }

        if (filter.olt_device_id) {
            sql += " AND s.olt_device_id = ?";
            params.push(Number(filter.olt_device_id));
        }

        sql += " ORDER BY s.tier_level ASC, s.name ASC";
        const splitters = await R.getAll(sql, params);

        return splitters.map((s) => ({
            ...s,
            output_port_count: Number(s.output_port_count) || 8,
            used_port_count: Number(s.used_port_count) || 0,
            available_ports: Math.max(0, (Number(s.output_port_count) || 8) - (Number(s.used_port_count) || 0)),
            nominal_loss_db: s.nominal_loss_db !== null ? Number(s.nominal_loss_db) : NOMINAL_SPLITTER_LOSSES[s.splitter_type] || 10.5,
            measured_loss_db: s.measured_loss_db !== null ? Number(s.measured_loss_db) : null,
            attenuation_db: s.attenuation_db !== null ? Number(s.attenuation_db) : null,
        }));
    }

    /**
     * Get single splitter details with its complete port map
     * @param {number} organizationId Organization ID
     * @param {number} splitterId Splitter ID
     * @returns {Promise<object>} Splitter with ports
     */
    static async getSplitterDetails(organizationId, splitterId) {
        const orgId = organizationId || 1;
        const id = Number(splitterId);

        const splitter = await R.getRow(
            `SELECT
                s.*,
                d.name AS olt_name,
                d.ip_address AS olt_ip,
                parent.name AS parent_splitter_name,
                site.name AS site_name
             FROM fiber_splitter s
             LEFT JOIN olt_device olt ON s.olt_device_id = olt.id
             LEFT JOIN device d ON olt.device_id = d.id
             LEFT JOIN fiber_splitter parent ON s.parent_splitter_id = parent.id
             LEFT JOIN site ON s.site_id = site.id
             WHERE s.id = ? AND s.organization_id = ?`,
            [id, orgId]
        );

        if (!splitter) {
            throw new Error("Fiber splitter not found or access denied.");
        }

        const ports = await R.getAll(
            `SELECT p.*, c.name AS connected_cable_name
             FROM fiber_splitter_port p
             LEFT JOIN fiber_cable c ON p.connected_cable_id = c.id
             WHERE p.organization_id = ? AND p.splitter_id = ?
             ORDER BY p.port_type DESC, p.port_number ASC`,
            [orgId, id]
        );

        return {
            ...splitter,
            output_port_count: Number(splitter.output_port_count) || 8,
            used_port_count: Number(splitter.used_port_count) || 0,
            available_ports: Math.max(0, (Number(splitter.output_port_count) || 8) - (Number(splitter.used_port_count) || 0)),
            nominal_loss_db: splitter.nominal_loss_db !== null ? Number(splitter.nominal_loss_db) : NOMINAL_SPLITTER_LOSSES[splitter.splitter_type] || 10.5,
            ports: ports || [],
        };
    }

    /**
     * Create or update a fiber splitter and auto-initialize port records
     * @param {number} organizationId Organization ID
     * @param {object} data Splitter data
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Saved splitter
     */
    static async saveSplitter(organizationId, data, userId = null) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.name.trim()) {
            throw new Error("Splitter name is required.");
        }

        const name = data.name.trim();
        const splitterType = data.splitter_type || "1:8";
        const tierLevel = Number(data.tier_level) || 1;
        const oltDeviceId = data.olt_device_id ? Number(data.olt_device_id) : null;
        const ponPort = data.pon_port || null;
        const parentSplitterId = data.parent_splitter_id ? Number(data.parent_splitter_id) : null;
        const siteId = data.site_id ? Number(data.site_id) : null;
        const location = data.location || null;
        const manufacturer = data.manufacturer || null;
        const model = data.model || null;
        const serialNumber = data.serial_number || null;
        const splitterIdentifier = data.splitter_identifier || `SPL-${Date.now().toString().slice(-6)}`;
        const operatingWavelength = data.operating_wavelength || "1310/1490/1550nm";
        const operatingTemp = data.operating_temp || "-40°C to +85°C";
        const description = data.description || null;
        const operationalNotes = data.operational_notes || null;
        const status = data.status || "UP";

        // Determine output port count based on split ratio
        let outputCount = 8;
        if (splitterType === "1:2") outputCount = 2;
        else if (splitterType === "1:4") outputCount = 4;
        else if (splitterType === "1:8") outputCount = 8;
        else if (splitterType === "1:16") outputCount = 16;
        else if (splitterType === "1:32") outputCount = 32;
        else if (splitterType === "1:64") outputCount = 64;
        else if (data.output_port_count) outputCount = Number(data.output_port_count);

        const nominalLoss = data.nominal_loss_db !== undefined && data.nominal_loss_db !== null
            ? Number(data.nominal_loss_db)
            : NOMINAL_SPLITTER_LOSSES[splitterType] || 10.5;
        const measuredLoss = data.measured_loss_db !== undefined && data.measured_loss_db !== null
            ? Number(data.measured_loss_db)
            : null;

        const isoNow = toSqlDatetime();

        let splitterId = data.id ? Number(data.id) : null;

        if (splitterId) {
            // Prevent circular parent dependency
            if (parentSplitterId === splitterId) {
                throw new Error("A splitter cannot be its own parent.");
            }

            await R.exec(
                `UPDATE fiber_splitter SET
                    name = ?, splitter_identifier = ?, splitter_type = ?, tier_level = ?,
                    olt_device_id = ?, pon_port = ?, parent_splitter_id = ?, site_id = ?,
                    location = ?, manufacturer = ?, model = ?, serial_number = ?,
                    nominal_loss_db = ?, measured_loss_db = ?, operating_wavelength = ?,
                    operating_temp = ?, output_port_count = ?, status = ?, description = ?,
                    operational_notes = ?, attenuation_db = ?, updated_at = ?
                 WHERE id = ? AND organization_id = ?`,
                [
                    name, splitterIdentifier, splitterType, tierLevel,
                    oltDeviceId, ponPort, parentSplitterId, siteId,
                    location, manufacturer, model, serialNumber,
                    nominalLoss, measuredLoss, operatingWavelength,
                    operatingTemp, outputCount, status, description,
                    operationalNotes, nominalLoss, isoNow,
                    splitterId, orgId,
                ]
            );

            await FiberInfrastructure.logAudit(orgId, "UPDATE", "SPLITTER", splitterId, name, { splitterType, tierLevel, outputCount }, userId);
        } else {
            await R.exec(
                `INSERT INTO fiber_splitter (
                    organization_id, name, splitter_identifier, splitter_type, tier_level,
                    olt_device_id, pon_port, parent_splitter_id, site_id,
                    location, manufacturer, model, serial_number,
                    nominal_loss_db, measured_loss_db, operating_wavelength,
                    operating_temp, output_port_count, used_port_count, status,
                    description, operational_notes, attenuation_db, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId, name, splitterIdentifier, splitterType, tierLevel,
                    oltDeviceId, ponPort, parentSplitterId, siteId,
                    location, manufacturer, model, serialNumber,
                    nominalLoss, measuredLoss, operatingWavelength,
                    operatingTemp, outputCount, status,
                    description, operationalNotes, nominalLoss, isoNow, isoNow,
                ]
            );

            splitterId = await R.getCell("SELECT MAX(id) FROM fiber_splitter WHERE organization_id = ?", [orgId]);

            // Initialize input port (port_number = 0)
            await R.exec(
                `INSERT INTO fiber_splitter_port (
                    organization_id, splitter_id, port_type, port_number, port_identifier, status, created_at, updated_at
                ) VALUES (?, ?, 'INPUT', 0, 'IN', 'AVAILABLE', ?, ?)`,
                [orgId, splitterId, isoNow, isoNow]
            );

            // Initialize output ports (port_number = 1..N)
            for (let i = 1; i <= outputCount; i++) {
                await R.exec(
                    `INSERT INTO fiber_splitter_port (
                        organization_id, splitter_id, port_type, port_number, port_identifier, status, created_at, updated_at
                    ) VALUES (?, ?, 'OUTPUT', ?, ?, 'AVAILABLE', ?, ?)`,
                    [orgId, splitterId, i, `OUT-${i}`, isoNow, isoNow]
                );
            }

            await FiberInfrastructure.logAudit(orgId, "CREATE", "SPLITTER", splitterId, name, { splitterType, tierLevel, outputCount }, userId);
        }

        return await FiberInfrastructure.getSplitterDetails(orgId, splitterId);
    }

    /**
     * Connect a splitter output port to a downstream entity (ONU, secondary splitter, or drop cable)
     * @param {number} organizationId Organization ID
     * @param {object} connectionData Port connection data
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Updated port
     */
    static async connectSplitterPort(organizationId, connectionData, userId = null) {
        const orgId = organizationId || 1;
        const splitterId = Number(connectionData.splitter_id);
        const portNumber = Number(connectionData.port_number);
        const portType = connectionData.port_type || "OUTPUT";

        const port = await R.getRow(
            `SELECT * FROM fiber_splitter_port
             WHERE organization_id = ? AND splitter_id = ? AND port_type = ? AND port_number = ?`,
            [orgId, splitterId, portType, portNumber]
        );

        if (!port) {
            throw new Error(`Port ${portType} #${portNumber} not found on splitter.`);
        }

        // Prevent duplicate connection if already connected
        if (port.status === "CONNECTED" && !connectionData.force_update) {
            throw new Error(`Port ${port.port_identifier || portNumber} is already connected to ${port.connected_entity_label || "another device"}.`);
        }

        const isoNow = toSqlDatetime();
        const connectedCableId = connectionData.connected_cable_id ? Number(connectionData.connected_cable_id) : null;
        const connectedStrandNumber = connectionData.connected_strand_number ? Number(connectionData.connected_strand_number) : null;
        const connectedEntityType = connectionData.connected_entity_type || "ONU";
        const connectedEntityId = connectionData.connected_entity_id ? Number(connectionData.connected_entity_id) : null;
        const connectedEntityLabel = connectionData.connected_entity_label || "Client Device";
        const measuredLoss = connectionData.measured_loss_db !== undefined ? Number(connectionData.measured_loss_db) : null;

        await R.exec(
            `UPDATE fiber_splitter_port SET
                status = 'CONNECTED',
                connected_cable_id = ?,
                connected_strand_number = ?,
                connected_entity_type = ?,
                connected_entity_id = ?,
                connected_entity_label = ?,
                measured_loss_db = ?,
                updated_at = ?
             WHERE id = ?`,
            [
                connectedCableId,
                connectedStrandNumber,
                connectedEntityType,
                connectedEntityId,
                connectedEntityLabel,
                measuredLoss,
                isoNow,
                port.id,
            ]
        );

        // Recalculate used_port_count on the parent splitter
        const usedCount = await R.getCell(
            `SELECT COUNT(*) FROM fiber_splitter_port
             WHERE organization_id = ? AND splitter_id = ? AND port_type = 'OUTPUT' AND status = 'CONNECTED'`,
            [orgId, splitterId]
        );

        await R.exec(
            "UPDATE fiber_splitter SET used_port_count = ?, updated_at = ? WHERE id = ?",
            [Number(usedCount) || 0, isoNow, splitterId]
        );

        await FiberInfrastructure.logAudit(
            orgId,
            "PORT_CONNECT",
            "SPLITTER",
            splitterId,
            `Port ${port.port_identifier || portNumber}`,
            { connectedEntityLabel, connectedEntityType, connectedEntityId },
            userId
        );

        return await R.getRow("SELECT * FROM fiber_splitter_port WHERE id = ?", [port.id]);
    }

    /**
     * Disconnect a splitter output port and return it to AVAILABLE state
     * @param {number} organizationId Organization ID
     * @param {number} portId Port ID
     * @param {number|null} userId User ID for audit
     * @returns {Promise<boolean>} Success
     */
    static async disconnectSplitterPort(organizationId, portId, userId = null) {
        const orgId = organizationId || 1;
        const id = Number(portId);

        const port = await R.getRow(
            "SELECT * FROM fiber_splitter_port WHERE id = ? AND organization_id = ?",
            [id, orgId]
        );

        if (!port) {
            throw new Error("Splitter port not found.");
        }

        const isoNow = toSqlDatetime();
        await R.exec(
            `UPDATE fiber_splitter_port SET
                status = 'AVAILABLE',
                connected_cable_id = NULL,
                connected_strand_number = NULL,
                connected_entity_type = NULL,
                connected_entity_id = NULL,
                connected_entity_label = NULL,
                measured_loss_db = NULL,
                updated_at = ?
             WHERE id = ?`,
            [isoNow, id]
        );

        // Recalculate used_port_count
        const usedCount = await R.getCell(
            `SELECT COUNT(*) FROM fiber_splitter_port
             WHERE organization_id = ? AND splitter_id = ? AND port_type = 'OUTPUT' AND status = 'CONNECTED'`,
            [orgId, port.splitter_id]
        );

        await R.exec(
            "UPDATE fiber_splitter SET used_port_count = ?, updated_at = ? WHERE id = ?",
            [Number(usedCount) || 0, isoNow, port.splitter_id]
        );

        await FiberInfrastructure.logAudit(orgId, "PORT_DISCONNECT", "SPLITTER", port.splitter_id, `Port ${port.port_identifier || port.port_number}`, {}, userId);
        return true;
    }

    // =========================================================================
    // 2. FIBER CABLES & STRANDS MANAGEMENT
    // =========================================================================

    /**
     * Get list of fiber cables with strand utilization
     * @param {number} organizationId Organization ID
     * @param {object} filter Optional filter
     * @returns {Promise<Array>} List of cables
     */
    static async getCables(organizationId, filter = {}) {
        const orgId = organizationId || 1;
        let sql = `
            SELECT c.*
            FROM fiber_cable c
            WHERE c.organization_id = ?
        `;
        const params = [orgId];

        if (filter.cable_type) {
            sql += " AND c.cable_type = ?";
            params.push(filter.cable_type);
        }

        if (filter.status) {
            sql += " AND c.status = ?";
            params.push(filter.status);
        }

        sql += " ORDER BY c.id DESC";
        const cables = await R.getAll(sql, params);

        const result = [];
        for (const c of cables) {
            const usedStrands = await R.getCell(
                "SELECT COUNT(*) FROM fiber_strand WHERE organization_id = ? AND cable_id = ? AND status = 'CONNECTED'",
                [orgId, c.id]
            );
            const faultyStrands = await R.getCell(
                "SELECT COUNT(*) FROM fiber_strand WHERE organization_id = ? AND cable_id = ? AND status = 'FAULTY'",
                [orgId, c.id]
            );
            const totalStrands = Number(c.strand_count) || 12;
            const used = Number(usedStrands) || 0;
            const faulty = Number(faultyStrands) || 0;

            result.push({
                ...c,
                strand_count: totalStrands,
                used_strands: used,
                faulty_strands: faulty,
                available_strands: Math.max(0, totalStrands - used - faulty),
                cable_length_meters: Number(c.cable_length_meters) || 1000,
                attenuation_db_per_km: Number(c.attenuation_db_per_km) || 0.35,
            });
        }

        return result;
    }

    /**
     * Get cable details with complete strand map (TIA-598 color-coded)
     * @param {number} organizationId Organization ID
     * @param {number} cableId Cable ID
     * @returns {Promise<object>} Cable with strands
     */
    static async getCableDetails(organizationId, cableId) {
        const orgId = organizationId || 1;
        const id = Number(cableId);

        const cable = await R.getRow(
            "SELECT * FROM fiber_cable WHERE id = ? AND organization_id = ?",
            [id, orgId]
        );

        if (!cable) {
            throw new Error("Fiber cable not found.");
        }

        const strands = await R.getAll(
            `SELECT s.*, spl.splice_loss_db
             FROM fiber_strand s
             LEFT JOIN fiber_splice spl ON s.splice_id = spl.id
             WHERE s.organization_id = ? AND s.cable_id = ?
             ORDER BY s.strand_number ASC`,
            [orgId, id]
        );

        const used = strands.filter((s) => s.status === "CONNECTED").length;
        const faulty = strands.filter((s) => s.status === "FAULTY").length;
        const total = Number(cable.strand_count) || strands.length;

        return {
            ...cable,
            strand_count: total,
            used_strands: used,
            faulty_strands: faulty,
            available_strands: Math.max(0, total - used - faulty),
            cable_length_meters: Number(cable.cable_length_meters) || 1000,
            attenuation_db_per_km: Number(cable.attenuation_db_per_km) || 0.35,
            strands: strands || [],
        };
    }

    /**
     * Save a fiber cable and automatically generate individual strands
     * @param {number} organizationId Organization ID
     * @param {object} data Cable parameters
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Saved cable
     */
    static async saveCable(organizationId, data, userId = null) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.name.trim()) {
            throw new Error("Fiber cable name is required.");
        }

        const name = data.name.trim();
        const cableType = data.cable_type || "DISTRIBUTION";
        const strandCount = Number(data.strand_count || data.fiber_count || 12);
        const lengthMeters = Number(data.cable_length_meters || 1000.0);
        const attenuation = Number(data.attenuation_db_per_km || 0.35);
        const cableIdentifier = data.cable_identifier || `CBL-${Date.now().toString().slice(-6)}`;
        const manufacturer = data.manufacturer || null;
        const model = data.model || null;
        const installDate = data.installation_date || null;
        const installMethod = data.installation_method || "CONDUIT";
        const routeDesc = data.route_description || null;
        const sourceType = data.source_type || null;
        const sourceId = data.source_id ? Number(data.source_id) : null;
        const sourceLabel = data.source_label || null;
        const targetType = data.target_type || null;
        const targetId = data.target_id ? Number(data.target_id) : null;
        const targetLabel = data.target_label || null;
        const status = data.status || "ACTIVE";
        const description = data.description || null;

        const isoNow = toSqlDatetime();
        let cableId = data.id ? Number(data.id) : null;

        if (cableId) {
            await R.exec(
                `UPDATE fiber_cable SET
                    name = ?, cable_identifier = ?, cable_type = ?, fiber_count = ?, strand_count = ?,
                    cable_length_meters = ?, attenuation_db_per_km = ?, manufacturer = ?, model = ?,
                    installation_date = ?, installation_method = ?, route_description = ?,
                    source_type = ?, source_id = ?, source_label = ?, target_type = ?, target_id = ?,
                    target_label = ?, status = ?, description = ?, updated_at = ?
                 WHERE id = ? AND organization_id = ?`,
                [
                    name, cableIdentifier, cableType, strandCount, strandCount,
                    lengthMeters, attenuation, manufacturer, model,
                    installDate, installMethod, routeDesc,
                    sourceType, sourceId, sourceLabel, targetType, targetId,
                    targetLabel, status, description, isoNow,
                    cableId, orgId,
                ]
            );

            await FiberInfrastructure.logAudit(orgId, "UPDATE", "CABLE", cableId, name, { cableType, strandCount }, userId);
        } else {
            await R.exec(
                `INSERT INTO fiber_cable (
                    organization_id, name, cable_identifier, cable_type, fiber_count, strand_count,
                    cable_length_meters, attenuation_db_per_km, manufacturer, model,
                    installation_date, installation_method, route_description,
                    source_type, source_id, source_label, target_type, target_id,
                    target_label, status, description, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId, name, cableIdentifier, cableType, strandCount, strandCount,
                    lengthMeters, attenuation, manufacturer, model,
                    installDate, installMethod, routeDesc,
                    sourceType, sourceId, sourceLabel, targetType, targetId,
                    targetLabel, status, description, isoNow, isoNow,
                ]
            );

            cableId = await R.getCell("SELECT MAX(id) FROM fiber_cable WHERE organization_id = ?", [orgId]);

            // Automatically populate strands with standard TIA-598 12-color scheme
            for (let i = 1; i <= strandCount; i++) {
                const colorIndex = (i - 1) % 12;
                const tubeNum = Math.floor((i - 1) / 12) + 1;
                const colorName = tubeNum > 1
                    ? `${TIA598_COLORS[colorIndex]} (Tube ${tubeNum})`
                    : TIA598_COLORS[colorIndex];

                await R.exec(
                    `INSERT INTO fiber_strand (
                        organization_id, cable_id, strand_number, color_code, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
                    [orgId, cableId, i, colorName, isoNow, isoNow]
                );
            }

            await FiberInfrastructure.logAudit(orgId, "CREATE", "CABLE", cableId, name, { cableType, strandCount }, userId);
        }

        return await FiberInfrastructure.getCableDetails(orgId, cableId);
    }

    /**
     * Allocate or update a fiber strand assignment
     * @param {number} organizationId Organization ID
     * @param {object} strandData Strand update data
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Updated strand
     */
    static async allocateStrand(organizationId, strandData, userId = null) {
        const orgId = organizationId || 1;
        const strandId = Number(strandData.id);

        const strand = await R.getRow(
            "SELECT * FROM fiber_strand WHERE id = ? AND organization_id = ?",
            [strandId, orgId]
        );

        if (!strand) {
            throw new Error("Fiber strand not found.");
        }

        const isoNow = toSqlDatetime();
        const status = strandData.status || "CONNECTED";
        const sourceEp = strandData.source_endpoint || null;
        const targetEp = strandData.target_endpoint || null;
        const connType = strandData.connected_entity_type || null;
        const connId = strandData.connected_entity_id ? Number(strandData.connected_entity_id) : null;
        const measuredLoss = strandData.measured_loss_db !== undefined ? Number(strandData.measured_loss_db) : null;
        const notes = strandData.notes || null;

        await R.exec(
            `UPDATE fiber_strand SET
                status = ?, source_endpoint = ?, target_endpoint = ?,
                connected_entity_type = ?, connected_entity_id = ?,
                measured_loss_db = ?, notes = ?, updated_at = ?
             WHERE id = ?`,
            [
                status, sourceEp, targetEp,
                connType, connId,
                measuredLoss, notes, isoNow,
                strandId,
            ]
        );

        await FiberInfrastructure.logAudit(
            orgId,
            "ALLOCATE_STRAND",
            "STRAND",
            strandId,
            `Strand #${strand.strand_number} (${strand.color_code})`,
            { status, sourceEp, targetEp },
            userId
        );

        return await R.getRow("SELECT * FROM fiber_strand WHERE id = ?", [strandId]);
    }

    /**
     * Delete a fiber cable and its associated strands
     * @param {number} organizationId Organization ID
     * @param {number} cableId Cable ID
     * @param {number|null} userId User ID for audit
     * @returns {Promise<boolean>} Success
     */
    static async deleteCable(organizationId, cableId, userId = null) {
        const orgId = organizationId || 1;
        const id = Number(cableId);

        const cable = await R.getRow("SELECT * FROM fiber_cable WHERE id = ? AND organization_id = ?", [id, orgId]);
        if (!cable) {
            throw new Error("Cable not found.");
        }

        await R.exec("DELETE FROM fiber_strand WHERE organization_id = ? AND cable_id = ?", [orgId, id]);
        await R.exec("DELETE FROM fiber_cable WHERE id = ? AND organization_id = ?", [id, orgId]);

        await FiberInfrastructure.logAudit(orgId, "DELETE", "CABLE", id, cable.name, {}, userId);
        return true;
    }

    // =========================================================================
    // 3. SPLICE CLOSURES & DISTRIBUTION POINTS
    // =========================================================================

    /**
     * List all splice closures and cabinets
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of closures
     */
    static async getClosures(organizationId) {
        const orgId = organizationId || 1;
        const closures = await R.getAll(
            `SELECT c.*, s.name AS site_name
             FROM splice_closure c
             LEFT JOIN site s ON c.site_id = s.id
             WHERE c.organization_id = ?
             ORDER BY c.id DESC`,
            [orgId]
        );

        return closures.map((c) => ({
            ...c,
            tray_capacity: Number(c.tray_capacity) || 4,
            total_splice_capacity: Number(c.total_splice_capacity) || 48,
            used_splice_capacity: Number(c.used_splice_capacity) || 0,
            available_splices: Math.max(0, (Number(c.total_splice_capacity) || 48) - (Number(c.used_splice_capacity) || 0)),
        }));
    }

    /**
     * Create or update a splice closure
     * @param {number} organizationId Organization ID
     * @param {object} data Closure data
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Saved closure
     */
    static async saveClosure(organizationId, data, userId = null) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.name.trim()) {
            throw new Error("Closure / Cabinet name is required.");
        }

        const name = data.name.trim();
        const closureType = data.closure_type || "SPLICE_CLOSURE";
        const siteId = data.site_id ? Number(data.site_id) : null;
        const closureIdentifier = data.closure_identifier || `CLS-${Date.now().toString().slice(-6)}`;
        const location = data.location || null;
        const lat = data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null;
        const lng = data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null;
        const trayCapacity = Number(data.tray_capacity || 4);
        const totalSpliceCapacity = Number(data.total_splice_capacity || 48);
        const status = data.status || "ACTIVE";
        const notes = data.installation_notes || null;

        const isoNow = toSqlDatetime();
        let closureId = data.id ? Number(data.id) : null;

        if (closureId) {
            await R.exec(
                `UPDATE splice_closure SET
                    name = ?, closure_identifier = ?, closure_type = ?, site_id = ?,
                    location = ?, latitude = ?, longitude = ?, tray_capacity = ?,
                    total_splice_capacity = ?, status = ?, installation_notes = ?, updated_at = ?
                 WHERE id = ? AND organization_id = ?`,
                [
                    name, closureIdentifier, closureType, siteId,
                    location, lat, lng, trayCapacity,
                    totalSpliceCapacity, status, notes, isoNow,
                    closureId, orgId,
                ]
            );
            await FiberInfrastructure.logAudit(orgId, "UPDATE", "CLOSURE", closureId, name, { closureType, totalSpliceCapacity }, userId);
        } else {
            await R.exec(
                `INSERT INTO splice_closure (
                    organization_id, site_id, name, closure_identifier, closure_type,
                    location, latitude, longitude, tray_capacity, total_splice_capacity,
                    used_splice_capacity, status, installation_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                [
                    orgId, siteId, name, closureIdentifier, closureType,
                    location, lat, lng, trayCapacity, totalSpliceCapacity,
                    status, notes, isoNow, isoNow,
                ]
            );
            closureId = await R.getCell("SELECT MAX(id) FROM splice_closure WHERE organization_id = ?", [orgId]);
            await FiberInfrastructure.logAudit(orgId, "CREATE", "CLOSURE", closureId, name, { closureType, totalSpliceCapacity }, userId);
        }

        return await R.getRow("SELECT * FROM splice_closure WHERE id = ?", [closureId]);
    }

    /**
     * Add a fusion or mechanical splice between incoming and outgoing cable strands
     * @param {number} organizationId Organization ID
     * @param {object} spliceData Splice parameters
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Created splice record
     */
    static async addSplice(organizationId, spliceData, userId = null) {
        const orgId = organizationId || 1;
        const closureId = Number(spliceData.closure_id);
        const inCableId = Number(spliceData.incoming_cable_id);
        const inStrandNum = Number(spliceData.incoming_strand_number);
        const outCableId = Number(spliceData.outgoing_cable_id);
        const outStrandNum = Number(spliceData.outgoing_strand_number);
        const trayNum = Number(spliceData.tray_number || 1);
        const spliceType = spliceData.splice_type || "FUSION";
        const spliceLoss = Number(spliceData.splice_loss_db || 0.05);
        const splicedBy = spliceData.spliced_by || "Field Technician";

        // Verify closure capacity
        const closure = await R.getRow("SELECT * FROM splice_closure WHERE id = ? AND organization_id = ?", [closureId, orgId]);
        if (!closure) {
            throw new Error("Splice closure not found.");
        }
        if (closure.used_splice_capacity >= closure.total_splice_capacity) {
            throw new Error(`Splice closure is at maximum capacity (${closure.total_splice_capacity} splices).`);
        }

        const isoNow = toSqlDatetime();

        await R.exec(
            `INSERT INTO fiber_splice (
                organization_id, closure_id, tray_number, incoming_cable_id, incoming_strand_number,
                outgoing_cable_id, outgoing_strand_number, splice_type, splice_loss_db,
                spliced_by, spliced_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orgId, closureId, trayNum, inCableId, inStrandNum,
                outCableId, outStrandNum, spliceType, spliceLoss,
                splicedBy, isoNow, isoNow, isoNow,
            ]
        );

        const spliceId = await R.getCell("SELECT MAX(id) FROM fiber_splice WHERE organization_id = ?", [orgId]);

        // Mark strands as spliced
        await R.exec(
            "UPDATE fiber_strand SET splice_id = ?, status = 'CONNECTED', updated_at = ? WHERE organization_id = ? AND cable_id = ? AND strand_number = ?",
            [spliceId, isoNow, orgId, inCableId, inStrandNum]
        );
        await R.exec(
            "UPDATE fiber_strand SET splice_id = ?, status = 'CONNECTED', updated_at = ? WHERE organization_id = ? AND cable_id = ? AND strand_number = ?",
            [spliceId, isoNow, orgId, outCableId, outStrandNum]
        );

        // Update used capacity on closure
        const currentCount = await R.getCell("SELECT COUNT(*) FROM fiber_splice WHERE organization_id = ? AND closure_id = ?", [orgId, closureId]);
        await R.exec("UPDATE splice_closure SET used_splice_capacity = ?, updated_at = ? WHERE id = ?", [Number(currentCount) || 1, isoNow, closureId]);

        await FiberInfrastructure.logAudit(
            orgId,
            "SPLICE",
            "CLOSURE",
            closureId,
            closure.name,
            { inCableId, inStrandNum, outCableId, outStrandNum, spliceLoss },
            userId
        );

        return await R.getRow("SELECT * FROM fiber_splice WHERE id = ?", [spliceId]);
    }

    /**
     * Get list of splices inside a closure
     * @param {number} organizationId Organization ID
     * @param {number} closureId Closure ID
     * @returns {Promise<Array>} Splices
     */
    static async getClosureSplices(organizationId, closureId) {
        const orgId = organizationId || 1;
        const id = Number(closureId);

        return await R.getAll(
            `SELECT
                spl.*,
                in_c.name AS incoming_cable_name,
                out_c.name AS outgoing_cable_name
             FROM fiber_splice spl
             LEFT JOIN fiber_cable in_c ON spl.incoming_cable_id = in_c.id
             LEFT JOIN fiber_cable out_c ON spl.outgoing_cable_id = out_c.id
             WHERE spl.organization_id = ? AND spl.closure_id = ?
             ORDER BY spl.tray_number ASC, spl.id ASC`,
            [orgId, id]
        );
    }

    // =========================================================================
    // 4. FIBER PATCH CORDS
    // =========================================================================

    /**
     * List patch cords
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} Patch cords
     */
    static async getPatchCords(organizationId) {
        const orgId = organizationId || 1;
        return await R.getAll(
            `SELECT
                p.*,
                src_d.name AS source_device_name,
                tgt_d.name AS target_device_name
             FROM fiber_patch_cord p
             LEFT JOIN device src_d ON p.source_device_id = src_d.id
             LEFT JOIN device tgt_d ON p.target_device_id = tgt_d.id
             WHERE p.organization_id = ?
             ORDER BY p.id DESC`,
            [orgId]
        );
    }

    /**
     * Save a patch cord
     * @param {number} organizationId Organization ID
     * @param {object} data Patch cord data
     * @param {number|null} userId User ID for audit
     * @returns {Promise<object>} Saved patch cord
     */
    static async savePatchCord(organizationId, data, userId = null) {
        const orgId = organizationId || 1;
        if (!data || !data.name || !data.name.trim()) {
            throw new Error("Patch cord name is required.");
        }

        const name = data.name.trim();
        const connA = data.connector_a_type || "SC/APC";
        const connB = data.connector_b_type || "SC/APC";
        const fiberType = data.fiber_type || "OS2_SINGLEMODE";
        const lengthM = Number(data.length_meters || 2.0);
        const srcDevId = data.source_device_id ? Number(data.source_device_id) : null;
        const srcPort = data.source_port || null;
        const tgtDevId = data.target_device_id ? Number(data.target_device_id) : null;
        const tgtPort = data.target_port || null;
        const loss = Number(data.insertion_loss_db || 0.25);
        const status = data.status || "ACTIVE";

        const isoNow = toSqlDatetime();
        let cordId = data.id ? Number(data.id) : null;

        if (cordId) {
            await R.exec(
                `UPDATE fiber_patch_cord SET
                    name = ?, connector_a_type = ?, connector_b_type = ?, fiber_type = ?,
                    length_meters = ?, source_device_id = ?, source_port = ?,
                    target_device_id = ?, target_port = ?, insertion_loss_db = ?,
                    status = ?, updated_at = ?
                 WHERE id = ? AND organization_id = ?`,
                [
                    name, connA, connB, fiberType,
                    lengthM, srcDevId, srcPort,
                    tgtDevId, tgtPort, loss,
                    status, isoNow, cordId, orgId,
                ]
            );
            await FiberInfrastructure.logAudit(orgId, "UPDATE", "PATCH_CORD", cordId, name, { connA, connB, lengthM }, userId);
        } else {
            await R.exec(
                `INSERT INTO fiber_patch_cord (
                    organization_id, name, connector_a_type, connector_b_type, fiber_type,
                    length_meters, source_device_id, source_port, target_device_id, target_port,
                    insertion_loss_db, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orgId, name, connA, connB, fiberType,
                    lengthM, srcDevId, srcPort, tgtDevId, tgtPort,
                    loss, status, isoNow, isoNow,
                ]
            );
            cordId = await R.getCell("SELECT MAX(id) FROM fiber_patch_cord WHERE organization_id = ?", [orgId]);
            await FiberInfrastructure.logAudit(orgId, "CREATE", "PATCH_CORD", cordId, name, { connA, connB, lengthM }, userId);
        }

        return await R.getRow("SELECT * FROM fiber_patch_cord WHERE id = ?", [cordId]);
    }

    // =========================================================================
    // 5. OPTICAL LOSS BUDGET & POWER CALCULATOR ENGINE
    // =========================================================================

    /**
     * Compute full optical power loss budget across passive optical path
     * @param {object} params Calculation parameters
     * @returns {object} Detailed loss budget and margin analysis
     */
    static calculateOpticalLossBudget(params = {}) {
        const wavelength = String(params.wavelength || "1490");
        const alpha = ATTENUATION_COEFFICIENTS[wavelength] || 0.22; // dB/km

        const cableLengthKm = Math.max(0, Number(params.cable_length_km || params.cableLengthKm || 5.0));
        const fiberLoss = Number((cableLengthKm * alpha).toFixed(2));

        // Primary splitter loss
        const primarySplitRatio = params.primary_split_ratio || params.primarySplitRatio || "1:8";
        const primarySplitterLoss = NOMINAL_SPLITTER_LOSSES[primarySplitRatio] || 10.5;

        // Secondary splitter loss (if cascaded)
        const secondarySplitRatio = params.secondary_split_ratio || params.secondarySplitRatio || null;
        const secondarySplitterLoss = secondarySplitRatio && NOMINAL_SPLITTER_LOSSES[secondarySplitRatio]
            ? NOMINAL_SPLITTER_LOSSES[secondarySplitRatio]
            : 0.0;

        const totalSplitterLoss = Number((primarySplitterLoss + secondarySplitterLoss).toFixed(2));

        // Mated connector loss (~0.35 dB per pair)
        const connectorCount = Math.max(0, Number(params.connector_count || params.connectorCount || 4));
        const connectorLossPerPair = Number(params.connector_loss_db || 0.35);
        const totalConnectorLoss = Number((connectorCount * connectorLossPerPair).toFixed(2));

        // Fusion splice loss (~0.05 dB per splice)
        const spliceCount = Math.max(0, Number(params.splice_count || params.spliceCount || 2));
        const spliceLossEach = Number(params.splice_loss_db || 0.05);
        const totalSpliceLoss = Number((spliceCount * spliceLossEach).toFixed(2));

        // Standard safety engineering margin
        const safetyMargin = Number(params.safety_margin_db || 3.0);

        // Sum components
        const totalEstimatedLossDb = Number((
            fiberLoss + totalSplitterLoss + totalConnectorLoss + totalSpliceLoss + safetyMargin
        ).toFixed(2));

        // Transceiver parameters
        const oltTxPowerDbm = Number(params.olt_tx_power_dbm !== undefined ? params.olt_tx_power_dbm : 2.5);
        const onuSensitivityDbm = Number(params.onu_sensitivity_dbm !== undefined ? params.onu_sensitivity_dbm : -27.0);

        // Expected received power at customer ONU
        const expectedRxPowerDbm = Number((oltTxPowerDbm - totalEstimatedLossDb).toFixed(2));
        const opticalPowerMargin = Number((expectedRxPowerDbm - onuSensitivityDbm).toFixed(2));

        // Health evaluation
        let budgetStatus = "PASS_OPTIMAL";
        let recommendation = "Optical link budget has excellent margin for high-speed GPON traffic.";

        if (expectedRxPowerDbm < onuSensitivityDbm) {
            budgetStatus = "FAIL_CRITICAL";
            recommendation = "Optical link budget exceeds maximum attenuation limit. Reduce split ratio, check splice losses, or shorten fiber run.";
        } else if (opticalPowerMargin < 2.0 || expectedRxPowerDbm <= -25.0) {
            budgetStatus = "PASS_MARGINAL";
            recommendation = "Optical margin is low (<2 dB). Verify fiber cleanliness and minimize excess mechanical splices.";
        }

        return {
            wavelengthNm: wavelength,
            attenuationCoeffDbPerKm: alpha,
            cableLengthKm,
            fiberLossDb: fiberLoss,
            primarySplitRatio,
            primarySplitterLossDb: primarySplitterLoss,
            secondarySplitRatio,
            secondarySplitterLossDb: secondarySplitterLoss,
            totalSplitterLossDb: totalSplitterLoss,
            connectorCount,
            totalConnectorLossDb: totalConnectorLoss,
            spliceCount,
            totalSpliceLossDb: totalSpliceLoss,
            safetyMarginDb: safetyMargin,
            totalEstimatedLossDb,
            oltTxPowerDbm,
            onuSensitivityDbm,
            expectedRxPowerDbm,
            opticalPowerMarginDb: opticalPowerMargin,
            budgetStatus,
            recommendation,
        };
    }

    // =========================================================================
    // 6. INFRASTRUCTURE AUDIT TRAIL
    // =========================================================================

    /**
     * Get infrastructure change logs
     * @param {number} organizationId Organization ID
     * @param {number} limit Max rows
     * @returns {Promise<Array>} Audit records
     */
    static async getAuditLogs(organizationId, limit = 50) {
        const orgId = organizationId || 1;
        const rows = await R.getAll(
            `SELECT a.*, u.username
             FROM infrastructure_audit_log a
             LEFT JOIN user u ON a.user_id = u.id
             WHERE a.organization_id = ?
             ORDER BY a.id DESC LIMIT ?`,
            [orgId, Number(limit) || 50]
        );

        return rows.map((r) => ({
            ...r,
            details: r.details_json ? JSON.parse(r.details_json) : {},
        }));
    }
}

module.exports = FiberInfrastructure;
