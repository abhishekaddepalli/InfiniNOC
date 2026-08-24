exports.up = async function (knex) {
    // 1. Add status column to organization_user if missing
    const hasOrgUserTable = await knex.schema.hasTable("organization_user");
    if (hasOrgUserTable) {
        const hasStatusCol = await knex.schema.hasColumn("organization_user", "status");
        if (!hasStatusCol) {
            await knex.schema.alterTable("organization_user", function (table) {
                table.string("status", 50).notNullable().defaultTo("active");
            });
        }
    }

    // 2. Create organization_invitation table
    const hasInvTable = await knex.schema.hasTable("organization_invitation");
    if (!hasInvTable) {
        await knex.schema.createTable("organization_invitation", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("email", 255).notNullable();
            table.string("role", 50).notNullable().defaultTo("engineer");
            table.string("token_hash", 255).notNullable().unique();
            table.datetime("expires_at").notNullable();
            table.datetime("accepted_at").nullable();
            table.integer("invited_by").unsigned().nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "inv_org_id");
            table.index("email", "inv_email");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("organization_invitation");
    const hasOrgUserTable = await knex.schema.hasTable("organization_user");
    if (hasOrgUserTable) {
        const hasStatusCol = await knex.schema.hasColumn("organization_user", "status");
        if (hasStatusCol) {
            await knex.schema.alterTable("organization_user", function (table) {
                table.dropColumn("status");
            });
        }
    }
};
