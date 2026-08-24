exports.up = async function (knex) {
    // 1. incident table
    const hasIncidentTable = await knex.schema.hasTable("incident");
    if (!hasIncidentTable) {
        await knex.schema.createTable("incident", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable().defaultTo(1);
            table.string("title", 255).notNullable();
            table.text("content").nullable();
            table.text("description").nullable();
            table.string("severity", 10).notNullable().defaultTo("P3");
            table.string("status", 20).notNullable().defaultTo("OPEN");
            table.integer("site_id").unsigned().nullable();
            table.integer("assigned_user_id").unsigned().nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("acknowledged_at").nullable();
            table.datetime("resolved_at").nullable();
            table.datetime("closed_at").nullable();
            table.text("root_cause").nullable();
            table.text("resolution").nullable();
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "incident_org_id");
            table.index("status", "incident_status");
            table.index("severity", "incident_severity");
        });
    } else {
        // Table exists from legacy schema - alter content to be nullable if needed and add InfiniNOC fields
        const columnsToAdd = [
            ["organization_id", (t) => t.integer("organization_id").unsigned().notNullable().defaultTo(1)],
            ["description", (t) => t.text("description").nullable()],
            ["severity", (t) => t.string("severity", 10).notNullable().defaultTo("P3")],
            ["status", (t) => t.string("status", 20).notNullable().defaultTo("OPEN")],
            ["site_id", (t) => t.integer("site_id").unsigned().nullable()],
            ["assigned_user_id", (t) => t.integer("assigned_user_id").unsigned().nullable()],
            ["created_at", (t) => t.datetime("created_at").defaultTo(knex.fn.now())],
            ["acknowledged_at", (t) => t.datetime("acknowledged_at").nullable()],
            ["resolved_at", (t) => t.datetime("resolved_at").nullable()],
            ["closed_at", (t) => t.datetime("closed_at").nullable()],
            ["root_cause", (t) => t.text("root_cause").nullable()],
            ["resolution", (t) => t.text("resolution").nullable()],
            ["updated_at", (t) => t.datetime("updated_at").defaultTo(knex.fn.now())],
        ];

        for (const [colName, colFn] of columnsToAdd) {
            const hasCol = await knex.schema.hasColumn("incident", colName);
            if (!hasCol) {
                await knex.schema.alterTable("incident", (table) => colFn(table));
            }
        }
    }

    // 2. incident_timeline table
    const hasTimelineTable = await knex.schema.hasTable("incident_timeline");
    if (!hasTimelineTable) {
        await knex.schema.createTable("incident_timeline", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("incident_id").unsigned().notNullable();
            table.integer("user_id").unsigned().nullable();
            table.string("event_type", 50).notNullable();
            table.text("message").notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index(["incident_id", "organization_id"], "timeline_incident_org");
        });
    }

    // 3. incident_entity_link table
    const hasLinkTable = await knex.schema.hasTable("incident_entity_link");
    if (!hasLinkTable) {
        await knex.schema.createTable("incident_entity_link", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("incident_id").unsigned().notNullable();
            table.string("entity_type", 50).notNullable();
            table.integer("entity_id").unsigned().notNullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index(["incident_id", "entity_type", "entity_id"], "link_incident_entity");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("incident_entity_link");
    await knex.schema.dropTableIfExists("incident_timeline");
};
