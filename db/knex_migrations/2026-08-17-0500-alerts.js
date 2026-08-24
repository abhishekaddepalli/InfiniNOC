exports.up = async function (knex) {
    // 1. alert_rule table
    const hasRuleTable = await knex.schema.hasTable("alert_rule");
    if (!hasRuleTable) {
        await knex.schema.createTable("alert_rule", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 255).notNullable();
            table.string("target_type", 50).notNullable().defaultTo("device"); // device, probe, monitor
            table.integer("target_id").unsigned().nullable();
            table.string("metric", 100).notNullable(); // device_unavailable, cpu, memory, temperature, interface_down, bandwidth, packet_loss, latency, probe_offline
            table.string("operator", 10).notNullable().defaultTo(">"); // >, >=, <, <=, ==, !=
            table.float("threshold").notNullable();
            table.integer("duration_seconds").notNullable().defaultTo(300);
            table.string("severity", 20).notNullable().defaultTo("WARNING"); // WARNING, CRITICAL
            table.integer("cooldown_seconds").notNullable().defaultTo(1800);
            table.boolean("enabled").notNullable().defaultTo(true);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "rule_org_id");
        });
    }

    // 2. active_alert table
    const hasActiveTable = await knex.schema.hasTable("active_alert");
    if (!hasActiveTable) {
        await knex.schema.createTable("active_alert", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("rule_id").unsigned().notNullable();
            table.string("target_type", 50).notNullable();
            table.integer("target_id").unsigned().notNullable();
            table.string("metric", 100).notNullable();
            table.string("state", 20).notNullable(); // WARNING, CRITICAL
            table.float("trigger_value").nullable();
            table.text("message").nullable();
            table.datetime("first_triggered_at").defaultTo(knex.fn.now());
            table.datetime("last_notified_at").defaultTo(knex.fn.now());
            table.boolean("acknowledged").notNullable().defaultTo(false);
            table.integer("acknowledged_by").unsigned().nullable();
            table.datetime("acknowledged_at").nullable();
            table.datetime("silenced_until").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "active_alert_org_id");
            table.index(["rule_id", "target_id"], "active_alert_rule_target");
        });
    }

    // 3. alert_history table
    const hasHistoryTable = await knex.schema.hasTable("alert_history");
    if (!hasHistoryTable) {
        await knex.schema.createTable("alert_history", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("alert_id").unsigned().nullable();
            table.integer("rule_id").unsigned().notNullable();
            table.string("state", 20).notNullable(); // OK, WARNING, CRITICAL, RECOVERED
            table.text("message").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "history_org_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("alert_history");
    await knex.schema.dropTableIfExists("active_alert");
    await knex.schema.dropTableIfExists("alert_rule");
};
