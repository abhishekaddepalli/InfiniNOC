/**
 * InfiniNOC Migration: FTTH Physical Fiber Infrastructure Management
 * Adds: fiber_cable, fiber_strand, fiber_splitter_port, splice_closure, fiber_splice, fiber_patch_cord, infrastructure_audit_log
 * Extends: fiber_splitter with technical specs and port management
 */
exports.up = async function (knex) {
    // 1. Extend fiber_splitter table
    const hasSplitter = await knex.schema.hasTable("fiber_splitter");
    if (hasSplitter) {
        await knex.schema.alterTable("fiber_splitter", function (table) {
            table.string("splitter_identifier", 100).nullable();
            table.integer("site_id").unsigned().nullable();
            table.string("manufacturer", 100).nullable();
            table.string("model", 100).nullable();
            table.string("serial_number", 100).nullable();
            table.float("nominal_loss_db").nullable();
            table.float("measured_loss_db").nullable();
            table.string("operating_wavelength", 50).nullable().defaultTo("1310/1490/1550nm");
            table.string("operating_temp", 50).nullable();
            table.integer("output_port_count").unsigned().notNullable().defaultTo(8);
            table.integer("used_port_count").unsigned().notNullable().defaultTo(0);
            table.string("status", 20).notNullable().defaultTo("UP");
            table.text("description").nullable();
            table.text("operational_notes").nullable();
        });
    }

    // 2. fiber_splitter_port table
    const hasSplitterPort = await knex.schema.hasTable("fiber_splitter_port");
    if (!hasSplitterPort) {
        await knex.schema.createTable("fiber_splitter_port", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("splitter_id").unsigned().notNullable();
            table.string("port_type", 20).notNullable().defaultTo("OUTPUT"); // INPUT, OUTPUT
            table.integer("port_number").unsigned().notNullable(); // 0 for Input, 1..N for Output
            table.string("port_identifier", 50).nullable(); // IN, OUT-1, OUT-2...
            table.string("status", 20).notNullable().defaultTo("AVAILABLE"); // AVAILABLE, CONNECTED, RESERVED, FAULTY
            table.integer("connected_cable_id").unsigned().nullable();
            table.integer("connected_strand_number").unsigned().nullable();
            table.string("connected_entity_type", 50).nullable(); // SPLITTER, ONU, CABLE, PATCH_CORD
            table.integer("connected_entity_id").unsigned().nullable();
            table.string("connected_entity_label", 255).nullable();
            table.float("measured_loss_db").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "splitter_id", "port_type", "port_number"], "uniq_splitter_port");
            table.index(["organization_id", "splitter_id"], "idx_splitter_ports");
        });
    }

    // 3. fiber_cable table
    const hasCable = await knex.schema.hasTable("fiber_cable");
    if (!hasCable) {
        await knex.schema.createTable("fiber_cable", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.string("name", 150).notNullable();
            table.string("cable_identifier", 100).nullable();
            table.string("cable_type", 50).notNullable().defaultTo("DISTRIBUTION"); // BACKBONE, FEEDER, DISTRIBUTION, DROP, UNDERGROUND, AERIAL, DUCT, ADSS, ARMORED, INDOOR
            table.integer("fiber_count").unsigned().notNullable().defaultTo(12);
            table.integer("strand_count").unsigned().notNullable().defaultTo(12);
            table.float("cable_length_meters").notNullable().defaultTo(1000.0);
            table.float("attenuation_db_per_km").notNullable().defaultTo(0.35);
            table.string("manufacturer", 100).nullable();
            table.string("model", 100).nullable();
            table.string("installation_date", 50).nullable();
            table.string("installation_method", 50).nullable().defaultTo("CONDUIT"); // DUCT, DIRECT_BURIED, AERIAL_POLE, CONDUIT
            table.text("route_description").nullable();
            table.string("source_type", 50).nullable(); // DEVICE, SPLITTER, CLOSURE, SITE
            table.integer("source_id").unsigned().nullable();
            table.string("source_label", 150).nullable();
            table.string("target_type", 50).nullable(); // DEVICE, SPLITTER, CLOSURE, ONU, SITE
            table.integer("target_id").unsigned().nullable();
            table.string("target_label", 150).nullable();
            table.string("status", 20).notNullable().defaultTo("ACTIVE"); // ACTIVE, MAINTENANCE, DAMAGED, RESERVED
            table.text("description").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "idx_cable_org");
            table.index(["source_type", "source_id"], "idx_cable_source");
            table.index(["target_type", "target_id"], "idx_cable_target");
        });
    }

    // 4. fiber_strand table
    const hasStrand = await knex.schema.hasTable("fiber_strand");
    if (!hasStrand) {
        await knex.schema.createTable("fiber_strand", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("cable_id").unsigned().notNullable();
            table.integer("strand_number").unsigned().notNullable();
            table.string("color_code", 30).notNullable().defaultTo("Blue");
            table.string("status", 20).notNullable().defaultTo("AVAILABLE"); // AVAILABLE, CONNECTED, RESERVED, FAULTY
            table.string("source_endpoint", 100).nullable();
            table.string("target_endpoint", 100).nullable();
            table.string("connected_entity_type", 50).nullable(); // SPLITTER_PORT, PATCH_CORD, SPLICE, ONU
            table.integer("connected_entity_id").unsigned().nullable();
            table.integer("splice_id").unsigned().nullable();
            table.float("measured_loss_db").nullable();
            table.text("notes").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "cable_id", "strand_number"], "uniq_cable_strand");
            table.index(["organization_id", "cable_id"], "idx_strands_cable");
        });
    }

    // 5. splice_closure table (Splice Closures, FDC, FAT, Handholes, Poles)
    const hasClosure = await knex.schema.hasTable("splice_closure");
    if (!hasClosure) {
        await knex.schema.createTable("splice_closure", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("site_id").unsigned().nullable();
            table.string("name", 150).notNullable();
            table.string("closure_identifier", 100).nullable();
            table.string("closure_type", 50).notNullable().defaultTo("SPLICE_CLOSURE"); // FDC, FAT, FDB, SPLICE_CLOSURE, PATCH_PANEL, HANDHOLE, POLE
            table.string("location", 255).nullable();
            table.float("latitude").nullable();
            table.float("longitude").nullable();
            table.integer("tray_capacity").unsigned().notNullable().defaultTo(4);
            table.integer("total_splice_capacity").unsigned().notNullable().defaultTo(48);
            table.integer("used_splice_capacity").unsigned().notNullable().defaultTo(0);
            table.string("status", 20).notNullable().defaultTo("ACTIVE"); // ACTIVE, MAINTENANCE, FULL
            table.text("installation_notes").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "idx_closure_org");
        });
    }

    // 6. fiber_splice table
    const hasSplice = await knex.schema.hasTable("fiber_splice");
    if (!hasSplice) {
        await knex.schema.createTable("fiber_splice", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("closure_id").unsigned().notNullable();
            table.integer("tray_number").unsigned().notNullable().defaultTo(1);
            table.integer("incoming_cable_id").unsigned().notNullable();
            table.integer("incoming_strand_number").unsigned().notNullable();
            table.integer("outgoing_cable_id").unsigned().notNullable();
            table.integer("outgoing_strand_number").unsigned().notNullable();
            table.string("splice_type", 30).notNullable().defaultTo("FUSION"); // FUSION, MECHANICAL
            table.float("splice_loss_db").notNullable().defaultTo(0.05);
            table.string("spliced_by", 100).nullable();
            table.datetime("spliced_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index(["organization_id", "closure_id"], "idx_splice_closure");
        });
    }

    // 7. fiber_patch_cord table
    const hasPatchCord = await knex.schema.hasTable("fiber_patch_cord");
    if (!hasPatchCord) {
        await knex.schema.createTable("fiber_patch_cord", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.string("name", 150).notNullable();
            table.string("connector_a_type", 30).notNullable().defaultTo("SC/APC"); // SC/APC, SC/UPC, LC/APC, LC/UPC, FC, ST
            table.string("connector_b_type", 30).notNullable().defaultTo("SC/APC");
            table.string("fiber_type", 30).notNullable().defaultTo("OS2_SINGLEMODE"); // OS2_SINGLEMODE, OM3_MULTIMODE, OM4_MULTIMODE
            table.float("length_meters").notNullable().defaultTo(2.0);
            table.integer("source_device_id").unsigned().nullable();
            table.string("source_port", 50).nullable();
            table.integer("target_device_id").unsigned().nullable();
            table.string("target_port", 50).nullable();
            table.float("insertion_loss_db").notNullable().defaultTo(0.25);
            table.string("status", 20).notNullable().defaultTo("ACTIVE"); // ACTIVE, SPARE, FAULTY
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "idx_patchcord_org");
        });
    }

    // 8. infrastructure_audit_log table
    const hasAuditLog = await knex.schema.hasTable("infrastructure_audit_log");
    if (!hasAuditLog) {
        await knex.schema.createTable("infrastructure_audit_log", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("user_id").unsigned().nullable();
            table.string("action", 50).notNullable(); // CREATE, UPDATE, DELETE, PORT_CONNECT, PORT_DISCONNECT, SPLICE, ACKNOWLEDGE
            table.string("entity_type", 50).notNullable(); // SPLITTER, CABLE, STRAND, CLOSURE, LINK, PATCH_CORD
            table.integer("entity_id").unsigned().nullable();
            table.string("entity_name", 150).nullable();
            table.text("details_json").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index(["organization_id", "entity_type"], "idx_audit_entity");
            table.index("created_at", "idx_audit_time");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("infrastructure_audit_log");
    await knex.schema.dropTableIfExists("fiber_patch_cord");
    await knex.schema.dropTableIfExists("fiber_splice");
    await knex.schema.dropTableIfExists("splice_closure");
    await knex.schema.dropTableIfExists("fiber_strand");
    await knex.schema.dropTableIfExists("fiber_cable");
    await knex.schema.dropTableIfExists("fiber_splitter_port");
};
