exports.up = async function (knex) {
    // 1. Ensure probe table has advanced telemetry columns
    const hasProbeTable = await knex.schema.hasTable("probe");
    if (hasProbeTable) {
        const probeColumns = [
            ["cpu_usage", (t) => t.float("cpu_usage").nullable()],
            ["memory_usage", (t) => t.float("memory_usage").nullable()],
            ["disk_usage", (t) => t.float("disk_usage").nullable()],
            ["region", (t) => t.string("region", 100).nullable()],
            ["location", (t) => t.string("location", 255).nullable()],
            ["os_info", (t) => t.string("os_info", 255).nullable()],
            ["tasks_executed", (t) => t.integer("tasks_executed").unsigned().defaultTo(0)],
            ["tasks_failed", (t) => t.integer("tasks_failed").unsigned().defaultTo(0)],
            ["queue_backlog", (t) => t.integer("queue_backlog").unsigned().defaultTo(0)],
        ];

        for (const [colName, colFn] of probeColumns) {
            const hasCol = await knex.schema.hasColumn("probe", colName);
            if (!hasCol) {
                await knex.schema.alterTable("probe", (table) => colFn(table));
            }
        }
    }

    // 2. Ensure monitor table has probe_id column
    const hasMonitorTable = await knex.schema.hasTable("monitor");
    if (hasMonitorTable) {
        const hasProbeIdCol = await knex.schema.hasColumn("monitor", "probe_id");
        if (!hasProbeIdCol) {
            await knex.schema.alterTable("monitor", function (table) {
                table.integer("probe_id").unsigned().nullable();
                table.index("probe_id", "monitor_probe_id_idx");
            });
        }
    }

    // 3. Ensure heartbeat table has probe_id column
    const hasHeartbeatTable = await knex.schema.hasTable("heartbeat");
    if (hasHeartbeatTable) {
        const hasHbProbeIdCol = await knex.schema.hasColumn("heartbeat", "probe_id");
        if (!hasHbProbeIdCol) {
            await knex.schema.alterTable("heartbeat", function (table) {
                table.integer("probe_id").unsigned().nullable();
            });
        }
    }

    // 4. Create monitor_probe table for multi-probe monitoring if not exists
    const hasMonitorProbeTable = await knex.schema.hasTable("monitor_probe");
    if (!hasMonitorProbeTable) {
        await knex.schema.createTable("monitor_probe", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.integer("monitor_id").unsigned().notNullable();
            table.integer("probe_id").unsigned().notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index(["monitor_id", "probe_id"], "idx_monitor_probe");
            table.index("organization_id", "idx_monitor_probe_org");
        });
    }

    // 5. Ensure incident table has organization_id default 1 and proper indexing
    const hasIncidentTable = await knex.schema.hasTable("incident");
    if (hasIncidentTable) {
        const hasFailureReason = await knex.schema.hasColumn("incident", "failure_reason");
        if (!hasFailureReason) {
            await knex.schema.alterTable("incident", function (table) {
                table.text("failure_reason").nullable();
            });
        }
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("monitor_probe");
};
