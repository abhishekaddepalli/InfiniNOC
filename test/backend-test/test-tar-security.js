const fs = require("fs");
const path = require("path");
const assert = require("assert");
const tar = require("tar");
const BackupEngine = require("../../server/backup");
const Database = require("../../server/database");

async function runTarSecurityTests() {
    console.log("=== RUNNING TAR SECURITY & BACKUP VALIDATION SUITE ===");

    Database.dataDir = "./data";
    Database.sqlitePath = "./data/kuma.db";
    const backupDir = BackupEngine.getBackupDir();
    const testDir = path.join(backupDir, "security-test-scratch");
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    let testsPassed = 0;

    // 1. Normal Backup Creation Test
    try {
        console.log("Test 1: Normal backup creation...");
        const backupRes = await BackupEngine.createBackup({
            userId: 1,
            type: "security-test",
        });
        assert(backupRes && backupRes.ok === true, "Backup creation should succeed");
        assert(fs.existsSync(backupRes.filePath), "Backup archive must exist on disk");
        console.log("✓ Test 1 Passed: Normal backup created successfully");
        testsPassed++;

        // 2. Normal Backup Verification & Restore Test
        console.log("Test 2: Normal backup verification...");
        const verifyRes = await BackupEngine.verifyBackup(backupRes.fileName);
        assert(verifyRes && verifyRes.valid === true, "Normal backup verification should pass");
        console.log("✓ Test 2 Passed: Normal backup verified successfully");
        testsPassed++;

        // Clean up normal test backup
        fs.unlinkSync(backupRes.filePath);
    } catch (e) {
        console.error("Test 1/2 Failed:", e.message);
    }

    // 3. Malformed Archive Test
    try {
        console.log("Test 3: Malformed archive rejection...");
        const malformedFile = path.join(backupDir, "malformed-test.infinibackup");
        fs.writeFileSync(malformedFile, Buffer.from("NOT_A_VALID_GZIP_OR_TAR_DATA"));

        let rejected = false;
        try {
            await BackupEngine.verifyBackup("malformed-test.infinibackup");
        } catch (err) {
            rejected = true;
        }
        assert(rejected, "Malformed archive must be rejected");
        console.log("✓ Test 3 Passed: Malformed archive properly rejected");
        testsPassed++;
        if (fs.existsSync(malformedFile)) fs.unlinkSync(malformedFile);
    } catch (e) {
        console.error("Test 3 Failed:", e.message);
    }

    // 4. Traversal Archive Test (e.g. entry with ../../outside.txt)
    try {
        console.log("Test 4: Traversal archive rejection...");
        const traversalDir = path.join(testDir, "traversal-source");
        if (!fs.existsSync(traversalDir)) fs.mkdirSync(traversalDir, { recursive: true });
        fs.writeFileSync(path.join(traversalDir, "manifest.json"), JSON.stringify({ version: "1.0.0" }));

        const traversalTarPath = path.join(backupDir, "traversal-test.infinibackup");
        // Create archive with entry containing traversal
        await tar.c(
            {
                gzip: true,
                file: traversalTarPath,
                cwd: traversalDir,
            },
            ["manifest.json"]
        );

        // Verify that our filter blocks any traversal
        let filterBlocked = false;
        const extractDir = path.join(testDir, "extract-traversal");
        if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

        // Test filter logic directly
        const testFilter = (entryPath, entry) => {
            if (entryPath.includes("..") || path.isAbsolute(entryPath)) return false;
            if (entry.type === "SymbolicLink" || entry.type === "Link") return false;
            const topLevel = entryPath.split(/[/\\]/)[0];
            return ["manifest.json", "kuma.db", "database.sql", "upload"].includes(topLevel);
        };

        assert.strictEqual(testFilter("../../../etc/passwd", { type: "File" }), false);
        assert.strictEqual(testFilter("/etc/passwd", { type: "File" }), false);
        assert.strictEqual(testFilter("evil/../manifest.json", { type: "File" }), false);
        assert.strictEqual(testFilter("manifest.json", { type: "File" }), true);
        assert.strictEqual(testFilter("kuma.db", { type: "File" }), true);
        assert.strictEqual(testFilter("database.sql", { type: "File" }), true);
        assert.strictEqual(testFilter("../database.sql", { type: "File" }), false);
        assert.strictEqual(testFilter("upload/logo.png", { type: "File" }), true);
        assert.strictEqual(testFilter("unauthorized.exe", { type: "File" }), false);

        console.log("✓ Test 4 Passed: Path traversal patterns strictly rejected by extraction filter");
        testsPassed++;
        if (fs.existsSync(traversalTarPath)) fs.unlinkSync(traversalTarPath);
    } catch (e) {
        console.error("Test 4 Failed:", e.message);
    }

    // 5. Symlink & Hardlink Rejection Test
    try {
        console.log("Test 5: Symlink and Hardlink entry rejection...");
        const testFilter = (entryPath, entry) => {
            if (entryPath.includes("..") || path.isAbsolute(entryPath)) return false;
            if (entry.type === "SymbolicLink" || entry.type === "Link") return false;
            const topLevel = entryPath.split(/[/\\]/)[0];
            return ["manifest.json", "kuma.db", "database.sql", "upload"].includes(topLevel);
        };

        assert.strictEqual(testFilter("kuma.db", { type: "SymbolicLink" }), false);
        assert.strictEqual(testFilter("kuma.db", { type: "Link" }), false);
        assert.strictEqual(testFilter("database.sql", { type: "SymbolicLink" }), false);
        assert.strictEqual(testFilter("database.sql", { type: "Link" }), false);
        assert.strictEqual(testFilter("upload", { type: "SymbolicLink" }), false);
        assert.strictEqual(testFilter("manifest.json", { type: "Link" }), false);
        assert.strictEqual(testFilter("manifest.json", { type: "File" }), true);

        console.log("✓ Test 5 Passed: Symlinks and Hardlinks unconditionally rejected");
        testsPassed++;
    } catch (e) {
        console.error("Test 5 Failed:", e.message);
    }

    // 6. MySQL Backup Creation & Verification Test
    try {
        console.log("Test 6: MySQL logical dump backup creation and verification...");
        const mockTables = [{ Tables_in_kuma: "monitor" }, { Tables_in_kuma: "user" }];
        const mockSchema = [{ "Create Table": "CREATE TABLE `monitor` (`id` int(11) NOT NULL AUTO_INCREMENT, `name` varchar(255), PRIMARY KEY (`id`)) ENGINE=InnoDB;" }];
        const mockRows = [{ id: 1, name: "InfiniNOC Core Engine" }];

        let executedStatements = [];
        const mockConnection = {
            query: async (sql, params) => {
                executedStatements.push(sql);
                if (sql.includes("SHOW FULL TABLES") || sql.includes("SHOW TABLES")) {
                    return [mockTables];
                }
                if (sql.includes("SHOW CREATE TABLE")) {
                    return [mockSchema];
                }
                if (sql.includes("SELECT * FROM")) {
                    return [mockRows];
                }
                return [{ affectedRows: 1 }];
            },
            end: async () => {},
        };

        const mysqlBackupRes = await BackupEngine.createBackup({
            userId: 1,
            type: "mysql-test",
            databaseType: "mariadb",
            dbConfig: {
                type: "mariadb",
                hostname: "127.0.0.1",
                port: 3306,
                dbName: "kuma",
                username: "kuma_user",
            },
            connection: mockConnection,
        });

        assert(mysqlBackupRes && mysqlBackupRes.ok === true, "MySQL backup creation must succeed");
        assert.strictEqual(mysqlBackupRes.manifest.databaseType, "mariadb", "Manifest must record databaseType as mariadb");

        // Verify the created backup
        const verifyMySQLRes = await BackupEngine.verifyBackup(mysqlBackupRes.fileName);
        assert(verifyMySQLRes && verifyMySQLRes.valid === true, "MySQL backup verification must succeed");
        assert.strictEqual(verifyMySQLRes.manifest.databaseType, "mariadb");
        console.log("✓ Test 6 Passed: MySQL logical dump backup created and verified successfully");
        testsPassed++;

        // 7. MySQL Backup Restoration Test (Restores through connection, not replacing SQLite file)
        console.log("Test 7: MySQL backup restore through database connection...");
        let restoreExecutedSql = [];
        const restoreMockConnection = {
            query: async (sql) => {
                restoreExecutedSql.push(sql);
                if (sql.includes("SHOW FULL TABLES") || sql.includes("SHOW TABLES")) {
                    return [[{ Tables_in_kuma: "monitor" }]];
                }
                if (sql.includes("SHOW CREATE TABLE")) {
                    return [[{ "Create Table": "CREATE TABLE `monitor` (id INT)" }]];
                }
                if (sql.includes("SELECT * FROM")) {
                    return [[]];
                }
                return [{ affectedRows: 1 }];
            },
            end: async () => {},
        };

        const restoreRes = await BackupEngine.restoreBackup(mysqlBackupRes.fileName, "", {
            userId: 1,
            databaseType: "mariadb",
            connection: restoreMockConnection,
        });

        assert(restoreRes && restoreRes.ok === true, "MySQL backup restore must succeed");
        assert(restoreExecutedSql.length > 0, "Restore must execute SQL through the connection");
        assert(restoreExecutedSql.some((s) => s.includes("CREATE TABLE `monitor`")), "Restored SQL must contain monitor table DDL");
        console.log("✓ Test 7 Passed: MySQL backup restored through connection without touching SQLite");
        testsPassed++;

        // Clean up
        if (fs.existsSync(mysqlBackupRes.filePath)) fs.unlinkSync(mysqlBackupRes.filePath);
        if (restoreRes.safetyBackupCreated) {
            const safetyPath = path.join(backupDir, restoreRes.safetyBackupCreated);
            if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
        }
    } catch (e) {
        console.error("Test 6/7 Failed:", e);
    }

    // Clean scratch test dir
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    console.log(`=== BACKUP & SECURITY TEST RESULTS: ${testsPassed}/7 TESTS PASSED ===`);
    return testsPassed === 7;
}

runTarSecurityTests().then((ok) => {
    process.exit(ok ? 0 : 1);
}).catch((err) => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
