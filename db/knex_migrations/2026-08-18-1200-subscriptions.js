exports.up = async function (knex) {
    // 1. saas_plan table
    const hasPlanTable = await knex.schema.hasTable("saas_plan");
    if (!hasPlanTable) {
        await knex.schema.createTable("saas_plan", function (table) {
            table.increments("id").primary();
            table.string("code", 50).unique().notNullable(); // STARTER, BUSINESS, PROFESSIONAL, ENTERPRISE
            table.string("name", 100).notNullable();
            table.integer("max_devices").unsigned().notNullable().defaultTo(25);
            table.integer("max_monitors").unsigned().notNullable().defaultTo(50);
            table.integer("max_probes").unsigned().notNullable().defaultTo(2);
            table.integer("max_users").unsigned().notNullable().defaultTo(5);
            table.integer("metric_retention_days").unsigned().notNullable().defaultTo(14);
            table.integer("max_status_pages").unsigned().notNullable().defaultTo(1);
            table.integer("max_api_rate_limit").unsigned().notNullable().defaultTo(1000); // Requests per hour
            table.integer("monthly_price_inr").unsigned().notNullable().defaultTo(1999);
            table.boolean("is_active").notNullable().defaultTo(true);
            table.datetime("created_at").defaultTo(knex.fn.now());
        });
    }

    // 2. organization_subscription table
    const hasSubTable = await knex.schema.hasTable("organization_subscription");
    if (!hasSubTable) {
        await knex.schema.createTable("organization_subscription", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.integer("plan_id").unsigned().notNullable();
            table.string("status", 30).notNullable().defaultTo("TRIAL"); // TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
            table.string("razorpay_customer_id", 150).nullable();
            table.string("razorpay_subscription_id", 150).nullable();
            table.datetime("current_period_start").nullable();
            table.datetime("current_period_end").nullable();
            table.datetime("trial_ends_at").nullable();
            table.datetime("created_at").defaultTo(knex.fn.now());
            table.datetime("updated_at").defaultTo(knex.fn.now());

            table.unique(["organization_id"], "unique_org_sub");
            table.index("organization_id", "sub_org_id");
            table.index("status", "sub_status");
        });
    }

    // 3. billing_payment_history table
    const hasPayTable = await knex.schema.hasTable("billing_payment_history");
    if (!hasPayTable) {
        await knex.schema.createTable("billing_payment_history", function (table) {
            table.increments("id").primary();
            table.integer("organization_id").unsigned().notNullable();
            table.string("razorpay_payment_id", 150).nullable();
            table.string("razorpay_order_id", 150).nullable();
            table.string("razorpay_signature", 255).nullable();
            table.integer("amount_inr").unsigned().notNullable().defaultTo(0);
            table.string("status", 30).notNullable().defaultTo("SUCCESS"); // SUCCESS, FAILED, PENDING
            table.datetime("created_at").defaultTo(knex.fn.now());

            table.index("organization_id", "bph_org_id");
            table.index("razorpay_order_id", "bph_order_id");
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("billing_payment_history");
    await knex.schema.dropTableIfExists("organization_subscription");
    await knex.schema.dropTableIfExists("saas_plan");
};
