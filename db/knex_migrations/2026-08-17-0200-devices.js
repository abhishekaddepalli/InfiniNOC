exports.up = async function (knex) {
    // 1. Create device table
    const hasDeviceTable = await knex.schema.hasTable("device");
    if (!hasDeviceTable) {
        await knex.schema.createTable("device", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("site_id").unsigned().nullable();
            table.string("name", 255).notNullable();
            table.string("hostname", 255).nullable();
            table.string("ip_address", 100).nullable();
            table.string("ipv6_address", 100).nullable();
            table.string("device_type", 100).notNullable();
            table.string("vendor", 100).nullable();
            table.string("model", 100).nullable();
            table.string("serial_number", 100).nullable();
            table.text("description").nullable();
            table.string("status", 50).notNullable().defaultTo("online");
            table.text("tags").nullable();
            table.text("notes").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "device_org_id");
            table.index("site_id", "device_site_id");
        });
    }

    // 2. Create device_credential table (Encrypted Credential Abstraction)
    const hasCredentialTable = await knex.schema.hasTable("device_credential");
    if (!hasCredentialTable) {
        await knex.schema.createTable("device_credential", function (table) {
            table.increments("id").primary();
            table.integer("device_id").unsigned().notNullable();
            table.string("name", 100).notNullable();
            table.string("type", 50).notNullable();
            table.text("encrypted_data").notNullable();
            table.string("iv", 100).notNullable();
            table.string("auth_tag", 100).notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("device_id", "credential_device_id");
        });
    }

    // 3. Create device_monitor table
    const hasDeviceMonitorTable = await knex.schema.hasTable("device_monitor");
    if (!hasDeviceMonitorTable) {
        await knex.schema.createTable("device_monitor", function (table) {
            table.increments("id").primary();
            table.integer("device_id").unsigned().notNullable();
            table.integer("monitor_id").unsigned().notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.unique(["device_id", "monitor_id"]);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("device_monitor");
    await knex.schema.dropTableIfExists("device_credential");
    await knex.schema.dropTableIfExists("device");
};
