exports.up = async function (knex) {
    // 1. olt_device table
    const hasOltTable = await knex.schema.hasTable("olt_device");
    if (!hasOltTable) {
        await knex.schema.createTable("olt_device", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("device_id").unsigned().notNullable();
            table.string("vendor_adapter_id", 50).notNullable().defaultTo("huawei");
            table.string("model", 100).nullable();
            table.string("firmware_version", 100).nullable();
            table.integer("total_pon_ports").unsigned().notNullable().defaultTo(8);
            table.integer("online_onu_count").unsigned().notNullable().defaultTo(0);
            table.integer("offline_onu_count").unsigned().notNullable().defaultTo(0);
            table.integer("los_count").unsigned().notNullable().defaultTo(0);
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "device_id"], "unique_org_olt_device");
            table.index("organization_id", "olt_org_id");
            table.index("device_id", "olt_dev_id");
        });
    }

    // 2. onu_inventory table
    const hasOnuTable = await knex.schema.hasTable("onu_inventory");
    if (!hasOnuTable) {
        await knex.schema.createTable("onu_inventory", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("olt_device_id").unsigned().notNullable();
            table.string("pon_port", 50).notNullable().defaultTo("0/1/1");
            table.integer("onu_index").unsigned().notNullable().defaultTo(1);
            table.string("serial_number", 100).notNullable();
            table.string("online_status", 20).notNullable().defaultTo("ONLINE"); // ONLINE, OFFLINE, LOS
            table.float("rx_power_dbm").nullable();
            table.float("tx_power_dbm").nullable();
            table.datetime("last_los_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "olt_device_id", "serial_number"], "unique_org_olt_onu_sn");
            table.index("organization_id", "onu_org_id");
            table.index("olt_device_id", "onu_olt_id");
            table.index("serial_number", "onu_sn");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("onu_inventory");
    await knex.schema.dropTableIfExists("olt_device");
};
