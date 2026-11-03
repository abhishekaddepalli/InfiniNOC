exports.up = async function (knex) {
    const hasSiteTable = await knex.schema.hasTable("site");
    if (hasSiteTable) {
        const hasCity = await knex.schema.hasColumn("site", "city");
        if (!hasCity) {
            await knex.schema.table("site", function (table) {
                table.string("city", 100).nullable();
            });
        }
        const hasState = await knex.schema.hasColumn("site", "state");
        if (!hasState) {
            await knex.schema.table("site", function (table) {
                table.string("state", 100).nullable();
            });
        }
        const hasCountry = await knex.schema.hasColumn("site", "country");
        if (!hasCountry) {
            await knex.schema.table("site", function (table) {
                table.string("country", 100).nullable();
            });
        }
    }
};

exports.down = async function (knex) {
    const hasSiteTable = await knex.schema.hasTable("site");
    if (hasSiteTable) {
        await knex.schema.table("site", function (table) {
            table.dropColumn("country");
            table.dropColumn("state");
            table.dropColumn("city");
        });
    }
};
