const assert = require("assert");
const { R } = require("redbean-node");
const knex = require("knex");
const Organization = require("../../server/model/organization");
const Database = require("../../server/database");

async function runOrganizationMariaDBTests() {
    console.log("=================================================================");
    console.log("  InfiniNOC MariaDB & SQLite Organization Compatibility Tests    ");
    console.log("=================================================================\n");

    let testsPassed = 0;
    const totalTests = 5;

    // 1. Dialect Detection and Portability Helpers
    console.log("Test 1: Dialect detection and SQL portability helpers...");
    assert.strictEqual(Organization.isMySQL("mariadb"), true, "mariadb must be identified as MySQL family");
    assert.strictEqual(Organization.isMySQL("mysql"), true, "mysql must be identified as MySQL family");
    assert.strictEqual(Organization.isMySQL("embedded-mariadb"), true, "embedded-mariadb must be identified as MySQL family");
    assert.strictEqual(Organization.isMySQL("sqlite"), false, "sqlite must not be identified as MySQL family");

    const sqlitePk = Organization.getAutoIncrementPrimaryKeySql("sqlite");
    assert.strictEqual(sqlitePk, "INTEGER PRIMARY KEY AUTOINCREMENT", "SQLite must use AUTOINCREMENT");

    const mariaPk = Organization.getAutoIncrementPrimaryKeySql("mariadb");
    assert.strictEqual(mariaPk, "INT AUTO_INCREMENT PRIMARY KEY", "MariaDB must use AUTO_INCREMENT");

    const tsExpr = Organization.getTimestampSql();
    assert.strictEqual(tsExpr, "CURRENT_TIMESTAMP", "Timestamp must be standard CURRENT_TIMESTAMP");
    console.log("✓ Test 1 Passed: Dialect detection and PK/timestamp helpers verified");
    testsPassed++;

    // 2. MariaDB DDL Syntax and Structure Validation
    console.log("Test 2: MariaDB organization sub-team table DDL validation...");
    const mariaDDLs = Organization.getSubTeamTableDDLs("mariadb");
    assert(Array.isArray(mariaDDLs) && mariaDDLs.length === 3, "Must generate 3 DDL statements");

    for (const ddl of mariaDDLs) {
        assert(!ddl.includes("AUTOINCREMENT"), "MariaDB DDL must NEVER contain SQLite AUTOINCREMENT keyword");
        assert(ddl.includes("INT AUTO_INCREMENT PRIMARY KEY"), "MariaDB DDL must use INT AUTO_INCREMENT PRIMARY KEY");
        assert(ddl.includes("CURRENT_TIMESTAMP"), "MariaDB DDL must use CURRENT_TIMESTAMP");
    }
    console.log("✓ Test 2 Passed: MariaDB DDL statements strictly conform to MySQL/MariaDB syntax");
    testsPassed++;

    // Setup an in-memory SQLite database via Knex and RedBean for live SQL execution tests
    const Dialect = require("knex/lib/dialects/sqlite3/index.js");
    Dialect.prototype._driver = () => require("@louislam/sqlite3");

    const inMemoryKnex = knex({
        client: Dialect,
        connection: {
            filename: ":memory:",
        },
        useNullAsDefault: true,
    });
    R.setup(inMemoryKnex);

    // Setup base organization table required by sub-team foreign relations
    await R.exec(`
        CREATE TABLE IF NOT EXISTS organization (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE,
            status VARCHAR(50) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await R.exec(`
        CREATE TABLE IF NOT EXISTS organization_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id INTEGER NOT NULL,
            user_id INTEGER,
            event VARCHAR(100) NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await R.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255)
        );
    `);

    await R.exec(`
        INSERT INTO user (id, username, email)
        VALUES (1, 'nocadmin', 'nocadmin@infiniforge.cloud');
    `);

    await R.exec(`
        INSERT INTO organization (name, slug, status, created_at, updated_at)
        VALUES ('InfiniNOC NOC Org', 'infininoc-noc', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // 3. SQLite Sub-Team Table Creation
    console.log("Test 3: SQLite sub-team table creation and schema validation...");
    Database.dbConfig = { type: "sqlite" };
    await Organization.initTables("sqlite");

    const subTeamTable = await R.getAll("PRAGMA table_info(organization_sub_team);");
    assert(subTeamTable && subTeamTable.length > 0, "organization_sub_team table must exist in SQLite");
    const subTeamMemberTable = await R.getAll("PRAGMA table_info(organization_sub_team_member);");
    assert(subTeamMemberTable && subTeamMemberTable.length > 0, "organization_sub_team_member table must exist");
    const subTeamAlertTable = await R.getAll("PRAGMA table_info(organization_sub_team_alert);");
    assert(subTeamAlertTable && subTeamAlertTable.length > 0, "organization_sub_team_alert table must exist");
    console.log("✓ Test 3 Passed: SQLite sub-team tables created successfully");
    testsPassed++;

    // 4. Sub-Team Creation & Timestamp Inserts
    console.log("Test 4: Sub-team creation with portable timestamp inserts...");
    const subTeam = await Organization.createSubTeam(
        1,
        "Network Operations Tier-1",
        "Primary NOC triage & monitoring",
        1,
        "Escalate to On-Call",
        1
    );

    assert(subTeam && subTeam.id, "Created sub-team must have a valid generated ID");
    assert.strictEqual(subTeam.name, "Network Operations Tier-1");

    const createdTeamRow = await R.getRow("SELECT * FROM organization_sub_team WHERE id = ?", [ subTeam.id ]);
    assert(createdTeamRow, "Sub-team row must exist in DB");
    assert(createdTeamRow.created_at, "created_at timestamp must be populated");
    assert(createdTeamRow.updated_at, "updated_at timestamp must be populated");

    const subTeamsList = await Organization.getSubTeams(1);
    assert(Array.isArray(subTeamsList) && subTeamsList.length >= 1, "getSubTeams must return created sub-teams");
    console.log("✓ Test 4 Passed: Sub-team created and verified with CURRENT_TIMESTAMP");
    testsPassed++;

    // 5. Team Alert Creation & Timestamp Inserts
    console.log("Test 5: Team alert creation with portable timestamp inserts...");
    const teamAlert = await Organization.createTeamAlert(
        1,
        subTeam.id,
        "NOC Critical Slack Webhook",
        "Slack",
        { webhookUrl: "https://hooks.slack.com/services/test" },
        "00:00-06:00",
        1
    );

    assert(teamAlert && teamAlert.id, "Created team alert must have a valid generated ID");
    assert.strictEqual(teamAlert.name, "NOC Critical Slack Webhook");

    const alertRow = await R.getRow("SELECT * FROM organization_sub_team_alert WHERE id = ?", [ teamAlert.id ]);
    assert(alertRow, "Alert channel row must exist in DB");
    assert(alertRow.created_at, "created_at timestamp must be populated via CURRENT_TIMESTAMP");

    const alertsList = await Organization.getTeamAlerts(1);
    assert(Array.isArray(alertsList) && alertsList.length >= 1, "getTeamAlerts must return created alert rule");
    console.log("✓ Test 5 Passed: Team alert created and verified with CURRENT_TIMESTAMP");
    testsPassed++;

    // Teardown in-memory DB connection
    await inMemoryKnex.destroy();

    console.log(`\n=================================================================`);
    console.log(`  ORGANIZATION MARIADB COMPATIBILITY: ${testsPassed}/${totalTests} TESTS PASSED`);
    console.log(`=================================================================`);

    return testsPassed === totalTests;
}

runOrganizationMariaDBTests().then((ok) => {
    process.exit(ok ? 0 : 1);
}).catch((err) => {
    console.error("Test failed with exception:", err);
    process.exit(1);
});
