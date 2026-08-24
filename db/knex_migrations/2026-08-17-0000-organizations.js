exports.up = async function (knex) {
    // 1. Create organization table
    const hasOrgTable = await knex.schema.hasTable("organization");
    if (!hasOrgTable) {
        await knex.schema.createTable("organization", function (table) {
            table.increments("id").primary();
            table.string("name", 255).notNullable();
            table.string("slug", 255).notNullable().unique();
            table.string("logo", 500).nullable();
            table.string("status", 50).notNullable().defaultTo("active");
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());
        });
    }

    // 2. Create organization_user table
    const hasOrgUserTable = await knex.schema.hasTable("organization_user");
    if (!hasOrgUserTable) {
        await knex.schema.createTable("organization_user", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("user_id").unsigned().notNullable();
            table.string("role", 50).notNullable().defaultTo("owner");
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());
            table.unique(["organization_id", "user_id"]);
        });
    }

    // 3. Create organization_audit_log table
    const hasAuditLogTable = await knex.schema.hasTable("organization_audit_log");
    if (!hasAuditLogTable) {
        await knex.schema.createTable("organization_audit_log", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("user_id").unsigned().notNullable();
            table.string("event", 100).notNullable();
            table.text("details").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
        });
    }

    // 4. Add organization_id column to scoped entity tables
    const scopedTables = [
        "monitor",
        "status_page",
        "notification",
        "maintenance",
        "docker_host",
        "proxy",
        "api_key",
    ];

    for (const tableName of scopedTables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            const hasColumn = await knex.schema.hasColumn(tableName, "organization_id");
            if (!hasColumn) {
                await knex.schema.alterTable(tableName, function (table) {
                    table.integer("organization_id").unsigned().nullable();
                });
            }
        }
    }

    // 5. Ensure Default Organization exists
    const defaultOrg = await knex("organization").where({ id: 1 }).first();
    if (!defaultOrg) {
        await knex("organization").insert({
            id: 1,
            name: "Default Organization",
            slug: "default",
            status: "active",
        });
    }

    // 6. Assign existing users to Default Organization as 'owner'
    const hasUsersTable = await knex.schema.hasTable("user");
    if (hasUsersTable) {
        const users = await knex("user").select("id");
        for (const u of users) {
            const existingMember = await knex("organization_user")
                .where({ organization_id: 1, user_id: u.id })
                .first();
            if (!existingMember) {
                await knex("organization_user").insert({
                    organization_id: 1,
                    user_id: u.id,
                    role: "owner",
                });
            }
        }
    }

    // 7. Assign unassigned entities to Default Organization (organization_id = 1)
    for (const tableName of scopedTables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            await knex(tableName)
                .whereNull("organization_id")
                .update({ organization_id: 1 });
        }
    }
};

exports.down = async function (knex) {
    const scopedTables = [
        "monitor",
        "status_page",
        "notification",
        "maintenance",
        "docker_host",
        "proxy",
        "api_key",
    ];

    for (const tableName of scopedTables) {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            const hasColumn = await knex.schema.hasColumn(tableName, "organization_id");
            if (hasColumn) {
                await knex.schema.alterTable(tableName, function (table) {
                    table.dropColumn("organization_id");
                });
            }
        }
    }

    await knex.schema.dropTableIfExists("organization_audit_log");
    await knex.schema.dropTableIfExists("organization_user");
    await knex.schema.dropTableIfExists("organization");
};
