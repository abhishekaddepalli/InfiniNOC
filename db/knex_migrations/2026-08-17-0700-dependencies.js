exports.up = async function (knex) {
    // 1. device_dependency table
    const hasDepTable = await knex.schema.hasTable("device_dependency");
    if (!hasDepTable) {
        await knex.schema.createTable("device_dependency", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("parent_device_id").unsigned().notNullable();
            table.integer("child_device_id").unsigned().notNullable();
            table.string("dependency_type", 20).notNullable().defaultTo("UPSTREAM"); // UPSTREAM, DOWNSTREAM, DEPENDS_ON
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id", "parent_device_id", "child_device_id"], "unique_org_parent_child");
            table.index("organization_id", "dep_org_id");
            table.index("parent_device_id", "dep_parent_id");
            table.index("child_device_id", "dep_child_id");
        });
    }

    // 2. Add impact metric columns to incident table if missing
    const hasIncidentTable = await knex.schema.hasTable("incident");
    if (hasIncidentTable) {
        const columnsToAdd = [
            ["root_device_id", (t) => t.integer("root_device_id").unsigned().nullable()],
            ["affected_devices_count", (t) => t.integer("affected_devices_count").unsigned().notNullable().defaultTo(1)],
            ["affected_sites_count", (t) => t.integer("affected_sites_count").unsigned().notNullable().defaultTo(1)],
            ["affected_monitors_count", (t) => t.integer("affected_monitors_count").unsigned().notNullable().defaultTo(0)],
            ["estimated_impact", (t) => t.string("estimated_impact", 20).notNullable().defaultTo("Medium")], // Critical, High, Medium, Low
        ];

        for (const [colName, colFn] of columnsToAdd) {
            const hasCol = await knex.schema.hasColumn("incident", colName);
            if (!hasCol) {
                await knex.schema.alterTable("incident", (table) => colFn(table));
            }
        }
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("device_dependency");
};
