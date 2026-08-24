exports.up = async function (knex) {
    // 1. Add is_super_admin to user table
    const hasUserTable = await knex.schema.hasTable("user");
    if (hasUserTable) {
        const hasSuperAdminCol = await knex.schema.hasColumn("user", "is_super_admin");
        if (!hasSuperAdminCol) {
            await knex.schema.alterTable("user", function (table) {
                table.boolean("is_super_admin").notNullable().defaultTo(false);
            });
        }
        // Grant Super Admin status to the primary user (id = 1)
        await knex("user").where({ id: 1 }).update({ is_super_admin: true });
    }

    // 2. Add SaaS entitlement fields to organization table
    const hasOrgTable = await knex.schema.hasTable("organization");
    if (hasOrgTable) {
        const hasPlanCol = await knex.schema.hasColumn("organization", "plan");
        if (!hasPlanCol) {
            await knex.schema.alterTable("organization", function (table) {
                table.string("plan", 50).notNullable().defaultTo("starter");
                table.integer("max_monitors").notNullable().defaultTo(10);
                table.integer("max_devices").notNullable().defaultTo(10);
                table.integer("max_members").notNullable().defaultTo(5);
            });
        }
    }
};

exports.down = async function (knex) {
    const hasUserTable = await knex.schema.hasTable("user");
    if (hasUserTable) {
        const hasSuperAdminCol = await knex.schema.hasColumn("user", "is_super_admin");
        if (hasSuperAdminCol) {
            await knex.schema.alterTable("user", function (table) {
                table.dropColumn("is_super_admin");
            });
        }
    }

    const hasOrgTable = await knex.schema.hasTable("organization");
    if (hasOrgTable) {
        const hasPlanCol = await knex.schema.hasColumn("organization", "plan");
        if (hasPlanCol) {
            await knex.schema.alterTable("organization", function (table) {
                table.dropColumn("plan");
                table.dropColumn("max_monitors");
                table.dropColumn("max_devices");
                table.dropColumn("max_members");
            });
        }
    }
};
