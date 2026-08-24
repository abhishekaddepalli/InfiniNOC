exports.up = async function (knex) {
    // 1. Create site table
    const hasSiteTable = await knex.schema.hasTable("site");
    if (!hasSiteTable) {
        await knex.schema.createTable("site", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 255).notNullable();
            table.string("code", 100).notNullable();
            table.text("description").nullable();
            table.text("address").nullable();
            table.decimal("latitude", 10, 8).nullable();
            table.decimal("longitude", 11, 8).nullable();
            table.string("timezone", 100).defaultTo("UTC");
            table.string("status", 50).notNullable().defaultTo("Operational");
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "site_org_id");
            table.unique(["organization_id", "code"]);
        });
    }

    // 2. Create site_monitor table
    const hasSiteMonitorTable = await knex.schema.hasTable("site_monitor");
    if (!hasSiteMonitorTable) {
        await knex.schema.createTable("site_monitor", function (table) {
            table.increments("id").primary();
            table.integer("site_id").unsigned().notNullable();
            table.integer("monitor_id").unsigned().notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.unique(["site_id", "monitor_id"]);
        });
    }

    // 3. Create site_device table
    const hasSiteDeviceTable = await knex.schema.hasTable("site_device");
    if (!hasSiteDeviceTable) {
        await knex.schema.createTable("site_device", function (table) {
            table.increments("id").primary();
            table.integer("site_id").unsigned().notNullable();
            table.string("device_name", 255).notNullable();
            table.string("device_type", 100).notNullable();
            table.string("ip_address", 100).nullable();
            table.string("status", 50).defaultTo("online");
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("site_id", "site_device_site_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("site_device");
    await knex.schema.dropTableIfExists("site_monitor");
    await knex.schema.dropTableIfExists("site");
};
