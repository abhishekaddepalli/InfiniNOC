exports.up = async function (knex) {
    // Create probe table
    const hasProbeTable = await knex.schema.hasTable("probe");
    if (!hasProbeTable) {
        await knex.schema.createTable("probe", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("site_id").unsigned().nullable();
            table.string("name", 255).notNullable();
            table.text("description").nullable();
            table.string("registration_token_hash", 255).nullable();
            table.boolean("registration_token_used").defaultTo(false);
            table.datetime("token_expires_at").nullable();
            table.string("api_key_hash", 255).nullable();
            table.string("status", 50).notNullable().defaultTo("pending");
            table.string("ip_address", 100).nullable();
            table.string("version", 50).defaultTo("1.0.0");
            table.integer("latency_ms").nullable();
            table.datetime("last_heartbeat").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "probe_org_id");
            table.index("site_id", "probe_site_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("probe");
};
