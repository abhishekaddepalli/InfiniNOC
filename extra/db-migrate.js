const args = require("args-parser")(process.argv);
const Database = require("../server/database");
const { log } = require("../src/util");

(async () => {
    try {
        log.info("migrate", "Initializing data directory and database connection...");
        Database.initDataDir(args);
        await Database.connect();

        log.info("migrate", "Applying latest Knex database migrations...");
        await Database.patch();

        log.info("migrate", "All database migrations applied successfully!");
        await Database.close();
        process.exit(0);
    } catch (err) {
        console.error("Database migration error:", err.message);
        process.exit(1);
    }
})();
