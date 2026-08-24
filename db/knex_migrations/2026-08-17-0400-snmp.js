exports.up = async function (knex) {
    const hasSnmpTable = await knex.schema.hasTable("snmp_config");
    if (!hasSnmpTable) {
        await knex.schema.createTable("snmp_config", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("device_id").unsigned().notNullable();
            table.string("snmp_version", 20).notNullable().defaultTo("v2c");
            table.integer("credential_id").unsigned().nullable();
            table.integer("port").notNullable().defaultTo(161);
            table.integer("timeout").notNullable().defaultTo(5000);
            table.integer("retries").notNullable().defaultTo(2);
            table.integer("poll_interval").notNullable().defaultTo(30);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "snmp_org_id");
            table.index("device_id", "snmp_dev_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("snmp_config");
};
