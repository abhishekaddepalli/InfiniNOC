exports.up = async function (knex) {
    // 1. notification_channel table
    const hasChannelTable = await knex.schema.hasTable("notification_channel");
    if (!hasChannelTable) {
        await knex.schema.createTable("notification_channel", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 100).notNullable();
            table.string("channel_type", 50).notNullable(); // EMAIL, TELEGRAM, WHATSAPP, WEBHOOK
            table.text("encrypted_config").notNullable(); // AES-256-GCM encrypted JSON
            table.boolean("is_enabled").notNullable().defaultTo(true);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "nc_org_id");
            table.index("channel_type", "nc_type");
        });
    }

    // 2. notification_routing_rule table
    const hasRoutingTable = await knex.schema.hasTable("notification_routing_rule");
    if (!hasRoutingTable) {
        await knex.schema.createTable("notification_routing_rule", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 100).notNullable();
            table.string("event_type", 50).notNullable().defaultTo("ALERT"); // ALERT, INCIDENT, RECOVERY, PROBE_OFFLINE
            table.string("min_severity", 20).notNullable().defaultTo("P2"); // P1, P2, P3, P4
            table.integer("channel_id").unsigned().notNullable();
            table.integer("cooldown_minutes").unsigned().notNullable().defaultTo(15);
            table.integer("escalation_timeout_minutes").unsigned().nullable();
            table.integer("escalation_channel_id").unsigned().nullable();
            table.text("schedule_json").nullable();
            table.boolean("is_enabled").notNullable().defaultTo(true);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "nrr_org_id");
            table.index("event_type", "nrr_event");
            table.index("min_severity", "nrr_sev");
        });
    }

    // 3. notification_delivery_log table
    const hasLogTable = await knex.schema.hasTable("notification_delivery_log");
    if (!hasLogTable) {
        await knex.schema.createTable("notification_delivery_log", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("event_type", 50).notNullable();
            table.string("severity", 20).notNullable();
            table.integer("channel_id").unsigned().nullable();
            table.string("recipient", 255).notNullable();
            table.string("status", 30).notNullable(); // SUCCESS, FAILED, SUPPRESSED_COOLDOWN
            table.text("error_message").nullable();
            table.datetime("delivered_at").defaultTo(knex.fn.now());

            table.index("organization_id", "ndl_org_id");
            table.index("status", "ndl_status");
            table.index("delivered_at", "ndl_time");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("notification_delivery_log");
    await knex.schema.dropTableIfExists("notification_routing_rule");
    await knex.schema.dropTableIfExists("notification_channel");
};
