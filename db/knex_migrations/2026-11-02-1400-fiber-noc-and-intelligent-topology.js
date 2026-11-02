exports.up = async function (knex) {
    // 1. pon_port table
    const hasPonPort = await knex.schema.hasTable("pon_port");
    if (!hasPonPort) {
        await knex.schema.createTable("pon_port", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("olt_device_id").unsigned().notNullable();
            table.string("port_identifier", 50).notNullable();
            table.string("name", 100).nullable();
            table.string("admin_status", 20).notNullable().defaultTo("UP");
            table.string("oper_status", 20).notNullable().defaultTo("UP");
            table.integer("total_onus").unsigned().notNullable().defaultTo(0);
            table.integer("online_onus").unsigned().notNullable().defaultTo(0);
            table.integer("offline_onus").unsigned().notNullable().defaultTo(0);
            table.integer("los_onus").unsigned().notNullable().defaultTo(0);
            table.float("rx_power_dbm").nullable();
            table.float("tx_power_dbm").nullable();
            table.float("traffic_in_mbps").notNullable().defaultTo(0);
            table.float("traffic_out_mbps").notNullable().defaultTo(0);
            table.datetime("last_state_change").nullable();
            table.datetime("last_polled_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "olt_device_id", "port_identifier"], "unique_org_olt_pon");
            table.index("organization_id", "pon_org_id");
            table.index("olt_device_id", "pon_olt_id");
            table.index("port_identifier", "pon_port_id");
        });
    }

    // 2. Add columns to olt_device
    const hasOltDevice = await knex.schema.hasTable("olt_device");
    if (hasOltDevice) {
        const oltCols = [
            ["management_ip", (t) => t.string("management_ip", 50).nullable()],
            ["uptime_seconds", (t) => t.integer("uptime_seconds").unsigned().nullable()],
            ["cpu_usage", (t) => t.float("cpu_usage").nullable()],
            ["memory_usage", (t) => t.float("memory_usage").nullable()],
            ["temperature", (t) => t.float("temperature").nullable()],
            ["last_polled_at", (t) => t.datetime("last_polled_at").nullable()],
            ["alarm_count", (t) => t.integer("alarm_count").unsigned().notNullable().defaultTo(0)],
        ];
        for (const [colName, colFn] of oltCols) {
            const hasCol = await knex.schema.hasColumn("olt_device", colName);
            if (!hasCol) {
                await knex.schema.alterTable("olt_device", (table) => colFn(table));
            }
        }
    }

    // 3. Add columns to onu_inventory
    const hasOnuInventory = await knex.schema.hasTable("onu_inventory");
    if (hasOnuInventory) {
        const onuCols = [
            ["name", (t) => t.string("name", 100).nullable()],
            ["customer_name", (t) => t.string("customer_name", 100).nullable()],
            ["site_id", (t) => t.integer("site_id").unsigned().nullable()],
            ["mac_address", (t) => t.string("mac_address", 50).nullable()],
            ["ip_address", (t) => t.string("ip_address", 50).nullable()],
            ["temperature", (t) => t.float("temperature").nullable()],
            ["uptime_seconds", (t) => t.integer("uptime_seconds").unsigned().nullable()],
            ["last_dereg_reason", (t) => t.string("last_dereg_reason", 100).nullable()],
            ["last_registered_at", (t) => t.datetime("last_registered_at").nullable()],
            ["last_deregistered_at", (t) => t.datetime("last_deregistered_at").nullable()],
            ["last_polled_at", (t) => t.datetime("last_polled_at").nullable()],
        ];
        for (const [colName, colFn] of onuCols) {
            const hasCol = await knex.schema.hasColumn("onu_inventory", colName);
            if (!hasCol) {
                await knex.schema.alterTable("onu_inventory", (table) => colFn(table));
            }
        }
    }

    // 4. onu_event_history table
    const hasOnuHistory = await knex.schema.hasTable("onu_event_history");
    if (!hasOnuHistory) {
        await knex.schema.createTable("onu_event_history", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("onu_id").unsigned().notNullable();
            table.string("event_type", 50).notNullable(); // STATE_CHANGE, OPTICAL_SAMPLE, ALARM, REGISTRATION, DEREGISTRATION
            table.string("status", 20).notNullable(); // ONLINE, OFFLINE, LOS, DYING_GASP
            table.float("rx_power_dbm").nullable();
            table.float("tx_power_dbm").nullable();
            table.text("message").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "onu_hist_org_id");
            table.index("onu_id", "onu_hist_onu_id");
            table.index("created_at", "onu_hist_time");
        });
    }

    // 5. fiber_splitter table
    const hasSplitter = await knex.schema.hasTable("fiber_splitter");
    if (!hasSplitter) {
        await knex.schema.createTable("fiber_splitter", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 100).notNullable();
            table.string("splitter_type", 20).notNullable().defaultTo("1:8"); // 1:4, 1:8, 1:16, 1:32, 1:64
            table.integer("tier_level").unsigned().notNullable().defaultTo(1);
            table.integer("olt_device_id").unsigned().nullable();
            table.string("pon_port", 50).nullable();
            table.integer("parent_splitter_id").unsigned().nullable();
            table.string("location", 255).nullable();
            table.float("attenuation_db").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "splitter_org_id");
            table.index("olt_device_id", "splitter_olt_id");
        });
    }

    // 6. Add link telemetry columns to device_dependency
    const hasDepTable = await knex.schema.hasTable("device_dependency");
    if (hasDepTable) {
        const depCols = [
            ["link_type", (t) => t.string("link_type", 20).notNullable().defaultTo("FIBER")],
            ["link_speed", (t) => t.string("link_speed", 30).notNullable().defaultTo("1 Gbps")],
            ["source_interface", (t) => t.string("source_interface", 50).nullable()],
            ["target_interface", (t) => t.string("target_interface", 50).nullable()],
            ["status", (t) => t.string("status", 20).notNullable().defaultTo("UP")],
            ["traffic_utilization_pct", (t) => t.float("traffic_utilization_pct").notNullable().defaultTo(0)],
            ["latency_ms", (t) => t.float("latency_ms").notNullable().defaultTo(0)],
            ["packet_loss_pct", (t) => t.float("packet_loss_pct").notNullable().defaultTo(0)],
            ["relationship_source", (t) => t.string("relationship_source", 20).notNullable().defaultTo("MANUAL")],
        ];
        for (const [colName, colFn] of depCols) {
            const hasCol = await knex.schema.hasColumn("device_dependency", colName);
            if (!hasCol) {
                await knex.schema.alterTable("device_dependency", (table) => colFn(table));
            }
        }
    }

    // 7. fiber_fault_incident table
    const hasFiberFault = await knex.schema.hasTable("fiber_fault_incident");
    if (!hasFiberFault) {
        await knex.schema.createTable("fiber_fault_incident", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("fault_category", 50).notNullable();
            table.string("confidence_level", 20).notNullable().defaultTo("PROBABLE"); // CONFIRMED, PROBABLE, SUSPECTED
            table.string("severity", 20).notNullable().defaultTo("MAJOR"); // CRITICAL, MAJOR, MINOR, WARNING
            table.string("status", 20).notNullable().defaultTo("ACTIVE"); // ACTIVE, INVESTIGATING, RESOLVED
            table.integer("olt_device_id").unsigned().nullable();
            table.string("pon_port", 50).nullable();
            table.integer("affected_onus_count").unsigned().notNullable().defaultTo(0);
            table.text("affected_onus_json").nullable();
            table.text("evidence").nullable();
            table.string("probable_location", 255).nullable();
            table.text("recommended_steps").nullable();
            table.float("otdr_distance_km").nullable();
            table.datetime("detected_at").defaultTo(knex.fn.now());
            table.datetime("last_healthy_at").nullable();
            table.datetime("resolved_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "fault_org_id");
            table.index("status", "fault_status");
            table.index("fault_category", "fault_cat");
        });
    }

    // 8. otdr_measurement table
    const hasOtdr = await knex.schema.hasTable("otdr_measurement");
    if (!hasOtdr) {
        await knex.schema.createTable("otdr_measurement", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("fiber_fault_id").unsigned().nullable();
            table.string("fiber_link_name", 100).notNullable();
            table.float("total_distance_km").notNullable();
            table.float("event_distance_km").notNullable();
            table.string("event_type", 50).notNullable(); // BREAK, HIGH_LOSS_SPLICE, BEND, REFLECTOR, END_OF_FIBER
            table.float("loss_db").notNullable();
            table.float("reflectance_db").nullable();
            table.string("trace_file_ref", 255).nullable();
            table.datetime("tested_at").defaultTo(knex.fn.now());
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "otdr_org_id");
            table.index("fiber_fault_id", "otdr_fault_id");
        });
    }

    // 9. device_interface table
    const hasInterface = await knex.schema.hasTable("device_interface");
    if (!hasInterface) {
        await knex.schema.createTable("device_interface", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("device_id").unsigned().notNullable();
            table.integer("interface_index").unsigned().notNullable();
            table.string("name", 100).notNullable();
            table.string("alias", 255).nullable();
            table.string("admin_status", 20).notNullable().defaultTo("UP");
            table.string("oper_status", 20).notNullable().defaultTo("UP");
            table.string("speed_bps", 50).nullable();
            table.string("duplex", 20).nullable();
            table.string("in_octets", 50).nullable().defaultTo("0");
            table.string("out_octets", 50).nullable().defaultTo("0");
            table.integer("in_errors").unsigned().notNullable().defaultTo(0);
            table.integer("out_errors").unsigned().notNullable().defaultTo(0);
            table.integer("in_discards").unsigned().notNullable().defaultTo(0);
            table.integer("out_discards").unsigned().notNullable().defaultTo(0);
            table.float("utilization_pct").notNullable().defaultTo(0);
            table.datetime("last_state_change").nullable();
            table.datetime("last_polled_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "device_id", "interface_index"], "unique_org_dev_ifindex");
            table.index("organization_id", "dev_if_org_id");
            table.index("device_id", "dev_if_dev_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("device_interface");
    await knex.schema.dropTableIfExists("otdr_measurement");
    await knex.schema.dropTableIfExists("fiber_fault_incident");
    await knex.schema.dropTableIfExists("fiber_splitter");
    await knex.schema.dropTableIfExists("onu_event_history");
    await knex.schema.dropTableIfExists("pon_port");
};
