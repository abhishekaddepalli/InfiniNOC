/**
 * InfiniNOC Migration: Diagnostic Tools History & Preferences
 * Adds: diagnostic_history, diagnostic_tool_preference
 */
exports.up = async function (knex) {
    // 1. diagnostic_history table
    const hasHistory = await knex.schema.hasTable("diagnostic_history");
    if (!hasHistory) {
        await knex.schema.createTable("diagnostic_history", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("user_id").unsigned().nullable();
            table.string("tool_id", 64).notNullable();
            table.string("category", 64).notNullable();
            table.string("target", 255).notNullable();
            table.text("parameters").nullable();
            table.string("execution_location", 64).notNullable().defaultTo("central");
            table.integer("probe_id").unsigned().nullable();
            table.string("status", 32).notNullable().defaultTo("SUCCESS");
            table.integer("duration_ms").unsigned().nullable();
            table.text("result", "longtext").nullable();
            table.text("error_message").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index(["organization_id", "tool_id"], "idx_diag_org_tool");
            table.index(["organization_id", "created_at"], "idx_diag_org_created");
            table.index(["organization_id", "target"], "idx_diag_org_target");
        });
    }

    // 2. diagnostic_tool_preference table
    const hasPreference = await knex.schema.hasTable("diagnostic_tool_preference");
    if (!hasPreference) {
        await knex.schema.createTable("diagnostic_tool_preference", function (table) {
            table.increments("id").primary();
            table.integer("user_id").unsigned().notNullable();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.string("tool_slug", 64).notNullable();
            table.boolean("is_favorite").notNullable().defaultTo(true);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["user_id", "tool_slug"], "uniq_user_tool_pref");
            table.index(["organization_id", "user_id"], "idx_pref_org_user");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("diagnostic_tool_preference");
    await knex.schema.dropTableIfExists("diagnostic_history");
};
