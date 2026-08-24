exports.up = async function (knex) {
    // Create organization_billing table for payment history
    const hasBillingTable = await knex.schema.hasTable("organization_billing");
    if (!hasBillingTable) {
        await knex.schema.createTable("organization_billing", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("razorpay_order_id", 255).nullable();
            table.string("razorpay_payment_id", 255).nullable();
            table.string("razorpay_signature", 255).nullable();
            table.string("plan", 50).notNullable();
            table.integer("amount").notNullable(); // in paise (e.g. 299900 for ₹2,999)
            table.string("currency", 10).notNullable().defaultTo("INR");
            table.string("status", 50).notNullable().defaultTo("created");
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.index("organization_id", "billing_org_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("organization_billing");
};
