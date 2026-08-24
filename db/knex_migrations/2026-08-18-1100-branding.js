exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable("organization_branding");
    if (!hasTable) {
        await knex.schema.createTable("organization_branding", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("company_name", 150).notNullable().defaultTo("InfiniNOC Platform");
            table.string("logo_url", 500).nullable();
            table.string("favicon_url", 500).nullable();
            table.string("primary_color", 30).notNullable().defaultTo("#f59e0b"); // Warning amber default
            table.string("secondary_color", 30).notNullable().defaultTo("#0284c7"); // Info cyan default
            table.string("login_title", 150).notNullable().defaultTo("InfiniNOC Enterprise Operations Center");
            table.string("login_subtitle", 255).notNullable().defaultTo("Secure High-Availability Telemetry & Incident Portal");
            table.string("email_header_text", 255).nullable().defaultTo("InfiniNOC Operations Telemetry");
            table.string("email_footer_text", 255).nullable().defaultTo("Confidential — Infiniforge Technologies NOC");
            table.string("status_page_title", 150).notNullable().defaultTo("System Operational Status");
            table.string("status_page_footer", 255).notNullable().defaultTo("Powered by InfiniNOC Monitoring Engine");
            table.string("custom_domain", 255).nullable();
            table.string("custom_status_domain", 255).nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id"], "unique_org_branding");
            table.index("organization_id", "ob_org_id");
            table.index("custom_domain", "ob_domain");
            table.index("custom_status_domain", "ob_status_domain");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("organization_branding");
};
