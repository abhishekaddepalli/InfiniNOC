exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable("sla_report");
    if (!hasTable) {
        await knex.schema.createTable("sla_report", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("name", 150).notNullable();
            table.string("report_type", 50).notNullable().defaultTo("SUMMARY"); // SUMMARY, SITE, DEVICE, MONITOR
            table.integer("entity_id").unsigned().nullable();
            table.string("time_range", 30).notNullable().defaultTo("30d"); // 24h, 7d, 30d, custom
            table.datetime("start_date").nullable();
            table.datetime("end_date").nullable();
            table.float("availability_pct").notNullable().defaultTo(100.0);
            table.integer("total_downtime_seconds").unsigned().notNullable().defaultTo(0);
            table.integer("mttr_seconds").unsigned().notNullable().defaultTo(0);
            table.integer("incident_count").unsigned().notNullable().defaultTo(0);
            table.integer("p1_count").unsigned().notNullable().defaultTo(0);
            table.integer("p2_count").unsigned().notNullable().defaultTo(0);
            table.float("avg_response_time_ms").notNullable().defaultTo(0.0);
            table.float("avg_packet_loss_pct").notNullable().defaultTo(0.0);
            table.float("avg_latency_ms").notNullable().defaultTo(0.0);
            table.string("status", 30).notNullable().defaultTo("COMPLETED"); // GENERATING, COMPLETED, FAILED
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("completed_at").nullable();

            table.index("organization_id", "sla_org_id");
            table.index("report_type", "sla_type");
            table.index("created_at", "sla_time");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("sla_report");
};
