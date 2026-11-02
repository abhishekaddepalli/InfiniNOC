const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const path = require("path");
const fs = require("fs");

describe("InfiniNOC Database Error Fixes & Advanced FTTH Infrastructure Test Suite", () => {
    let Organization;
    let Device;
    let Probe;
    let DependencyCorrelation;
    let FiberInfrastructure;
    let orgA;
    let orgB;
    let devCoreRouter;
    let devAggSwitch;
    let devOlt;

    before(async () => {
        const testDbDir = path.join(__dirname, "../test-data");
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        const testDbPath = path.join(testDbDir, "test-ftth-infrastructure.db");
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knex = require("knex")({
            client: Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        R.setup(knex);
        R.freeze(false);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();

        // Run all migrations up through 2026-11-02-1700-ftth-physical-infrastructure.js
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        Organization = require("../../server/model/organization.js");
        Device = require("../../server/model/device.js");
        Probe = require("../../server/model/probe.js");
        DependencyCorrelation = require("../../server/model/dependency-correlation.js");
        FiberInfrastructure = require("../../server/model/fiber-infrastructure.js");

        await R.exec("INSERT INTO user (username, password, active) VALUES ('ftth_admin', 'pass123', 1)");
        const userAId = await R.getCell("SELECT id FROM user WHERE username = 'ftth_admin'");

        orgA = await Organization.createOrganization("Org FTTH Operations", "org-ftth-ops", userAId);
        orgB = await Organization.createOrganization("Org Isolated Tenant", "org-iso-tenant", userAId);

        // Create devices in Org A
        devCoreRouter = await Device.createDevice(
            { name: "CORE-RT-01", hostname: "core01.isp.net", ip_address: "10.10.0.1", device_type: "Router" },
            orgA.id
        );
        devAggSwitch = await Device.createDevice(
            { name: "AGG-SW-01", hostname: "agg01.isp.net", ip_address: "10.10.0.2", device_type: "Switch" },
            orgA.id
        );
        devOlt = await Device.createDevice(
            { name: "OLT-MA5608T-01", hostname: "olt01.isp.net", ip_address: "10.10.0.3", device_type: "OLT" },
            orgA.id
        );
    });

    after(async () => {
        if (R.knex) {
            await R.knex.destroy();
        }
    });

    // =========================================================================
    // ERROR 1 VERIFICATION: ADD NETWORK LINK / DEPENDENCY (NaN & VALIDATION)
    // =========================================================================
    describe("Phase 1: Fix Error 1 - Network Link NaN & Database Validation", () => {
        it("should reject NaN, missing, or non-integer upstream parent device ID", async () => {
            // Test NaN
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency("NaN", devAggSwitch.id, "UPSTREAM", orgA.id);
                },
                { message: "Please select a valid upstream device." }
            );

            // Test non-integer string ID (e.g. synthetic node ID 'mon-1')
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency("mon-1", devAggSwitch.id, "UPSTREAM", orgA.id);
                },
                { message: "Please select a valid upstream device." }
            );

            // Test null / undefined
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(null, devAggSwitch.id, "UPSTREAM", orgA.id);
                },
                { message: "Please select a valid upstream device." }
            );
        });

        it("should reject NaN, missing, or non-integer downstream child device ID", async () => {
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(devCoreRouter.id, "NaN", "UPSTREAM", orgA.id);
                },
                { message: "Please select a valid downstream device." }
            );

            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(devCoreRouter.id, undefined, "UPSTREAM", orgA.id);
                },
                { message: "Please select a valid downstream device." }
            );
        });

        it("should reject self-connecting loop (parent ID equals child ID)", async () => {
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(devCoreRouter.id, devCoreRouter.id, "UPSTREAM", orgA.id);
                },
                { message: "A device cannot depend on itself." }
            );
        });

        it("should reject device IDs that do not belong to the organization", async () => {
            // Attempt to connect from a non-existent device ID
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(99999, devAggSwitch.id, "UPSTREAM", orgA.id);
                },
                { message: "Parent or child device not found in organization." }
            );
        });

        it("should successfully establish a valid network dependency link", async () => {
            const link = await DependencyCorrelation.addDependency(
                devCoreRouter.id,
                devAggSwitch.id,
                "UPSTREAM",
                orgA.id,
                {
                    link_type: "FIBER",
                    link_speed: "10 Gbps",
                    source_interface: "xe-0/0/1",
                    target_interface: "te1/1"
                }
            );

            assert.ok(link.id);
            assert.strictEqual(link.parent_device_id, devCoreRouter.id);
            assert.strictEqual(link.child_device_id, devAggSwitch.id);
            assert.strictEqual(link.link_type, "FIBER");
            assert.strictEqual(link.link_speed, "10 Gbps");
        });

        it("should prevent duplicate links between the same pair of devices", async () => {
            await assert.rejects(
                async () => {
                    await DependencyCorrelation.addDependency(
                        devCoreRouter.id,
                        devAggSwitch.id,
                        "UPSTREAM",
                        orgA.id
                    );
                },
                { message: "These devices are already connected." }
            );
        });
    });

    // =========================================================================
    // ERROR 2 VERIFICATION: REMOTE PROBE REGISTRATION (DATETIME COMPATIBILITY)
    // =========================================================================
    describe("Phase 1: Fix Error 2 - Probe Registration Datetime Compatibility", () => {
        let probeRecord;

        it("should store token expiration and timestamps in standard MySQL/MariaDB DATETIME format", async () => {
            probeRecord = await Probe.createProbeRegistrationToken(
                { name: "Hyderabad Core NOC Probe", location: "HITEC City DC" },
                orgA.id
            );

            assert.ok(probeRecord.probe.id);
            assert.ok(probeRecord.registrationToken);

            const probeRow = await R.getRow("SELECT token_expires_at, created_at FROM probe WHERE id = ?", [probeRecord.probe.id]);

            // Must match standard SQL UTC datetime format: YYYY-MM-DD HH:mm:ss (no 'T', no 'Z')
            const sqlDatetimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
            assert.ok(
                sqlDatetimePattern.test(probeRow.token_expires_at),
                `token_expires_at should match YYYY-MM-DD HH:mm:ss but got '${probeRow.token_expires_at}'`
            );
            assert.ok(
                sqlDatetimePattern.test(probeRow.created_at),
                `created_at should match YYYY-MM-DD HH:mm:ss but got '${probeRow.created_at}'`
            );
        });

        it("should register probe using valid registration token and transition to online", async () => {
            const regResult = await Probe.registerProbe(
                probeRecord.probe.id,
                probeRecord.registrationToken,
                "103.20.10.5",
                "1.26.31"
            );

            assert.ok(regResult.apiKey);
            assert.strictEqual(regResult.probeId, probeRecord.probe.id);

            const activeProbe = await Probe.getProbe(probeRecord.probe.id, orgA.id);
            assert.strictEqual(activeProbe.status, "online");
            assert.strictEqual(Number(activeProbe.registration_token_used), 1);
        });

        it("should reject token reuse (single-use enforcement)", async () => {
            await assert.rejects(
                async () => {
                    await Probe.registerProbe(
                        probeRecord.probe.id,
                        probeRecord.registrationToken,
                        "103.20.10.6"
                    );
                },
                { message: "Registration token has already been used." }
            );
        });
    });

    // =========================================================================
    // ADVANCED FTTH INFRASTRUCTURE MANAGEMENT
    // =========================================================================
    describe("Phases 2-6: Advanced FTTH Splitter, Cable, Closure & Optical Budget", () => {
        let splitterFdc;
        let splitterFat;
        let cableFeeder;
        let closureFdc;

        it("should create a 1:4 Primary FDC Splitter and auto-initialize 1 input + 4 output ports", async () => {
            splitterFdc = await FiberInfrastructure.saveSplitter(orgA.id, {
                name: "FDC-01 Primary Feeder Splitter (1:4)",
                splitter_type: "1:4",
                tier_level: 1,
                location: "Central Telecom Hut Pole 01",
                manufacturer: "CommScope",
                model: "PLC-104-SCAPC"
            });

            assert.ok(splitterFdc.id);
            assert.strictEqual(splitterFdc.output_port_count, 4);
            assert.strictEqual(splitterFdc.nominal_loss_db, 7.2);
            assert.strictEqual(splitterFdc.used_port_count, 0);

            // Verify ports created in fiber_splitter_port
            const details = await FiberInfrastructure.getSplitterDetails(orgA.id, splitterFdc.id);
            assert.strictEqual(details.ports.length, 5); // 1 input + 4 output

            const inputPort = details.ports.find(p => p.port_type === "INPUT");
            assert.ok(inputPort);
            assert.strictEqual(inputPort.port_number, 0);

            const outputPorts = details.ports.filter(p => p.port_type === "OUTPUT");
            assert.strictEqual(outputPorts.length, 4);
        });

        it("should create a 1:8 Secondary FAT Splitter connected to FDC parent", async () => {
            splitterFat = await FiberInfrastructure.saveSplitter(orgA.id, {
                name: "FAT-01 Distribution Splitter (1:8)",
                splitter_type: "1:8",
                tier_level: 2,
                parent_splitter_id: splitterFdc.id,
                location: "Cross Road Enclosure 14",
                manufacturer: "Corning",
                model: "PLC-108-SCAPC"
            });

            assert.ok(splitterFat.id);
            assert.strictEqual(splitterFat.output_port_count, 8);
            assert.strictEqual(splitterFat.nominal_loss_db, 10.5);
            assert.strictEqual(splitterFat.parent_splitter_id, splitterFdc.id);

            const details = await FiberInfrastructure.getSplitterDetails(orgA.id, splitterFat.id);
            assert.strictEqual(details.ports.length, 9); // 1 input + 8 output
        });

        it("should connect splitter output port and update used port count", async () => {
            const portRes = await FiberInfrastructure.connectSplitterPort(orgA.id, {
                splitter_id: splitterFdc.id,
                port_type: "OUTPUT",
                port_number: 1,
                connected_entity_type: "SPLITTER",
                connected_entity_id: splitterFat.id,
                connected_entity_label: "FAT-01 Trunk Link",
                measured_loss_db: 7.15
            });

            assert.strictEqual(portRes.status, "CONNECTED");
            assert.strictEqual(portRes.connected_entity_label, "FAT-01 Trunk Link");

            const updatedFdc = await FiberInfrastructure.getSplitterDetails(orgA.id, splitterFdc.id);
            assert.strictEqual(updatedFdc.used_port_count, 1);
            assert.strictEqual(updatedFdc.available_ports, 3);
        });

        it("should reject connecting an already occupied splitter port", async () => {
            await assert.rejects(
                async () => {
                    await FiberInfrastructure.connectSplitterPort(orgA.id, {
                        splitter_id: splitterFdc.id,
                        port_type: "OUTPUT",
                        port_number: 1,
                        connected_entity_type: "ONU",
                        connected_entity_id: 101,
                        connected_entity_label: "Another Client"
                    });
                },
                /is already connected/
            );
        });

        it("should create a 24-fiber distribution cable and auto-populate TIA-598 color-coded strands", async () => {
            cableFeeder = await FiberInfrastructure.saveCable(orgA.id, {
                name: "FEEDER-CBL-CORE-TO-FDC01",
                cable_type: "FEEDER",
                strand_count: 24,
                cable_length_meters: 3500.0,
                attenuation_db_per_km: 0.35,
                installation_method: "CONDUIT",
                manufacturer: "Sterlite",
                route_description: "Core NOC through Ring Road duct to FDC-01"
            });

            assert.ok(cableFeeder.id);
            assert.strictEqual(cableFeeder.strand_count, 24);
            assert.strictEqual(cableFeeder.strands.length, 24);

            // Strand 1: Blue
            assert.strictEqual(cableFeeder.strands[0].strand_number, 1);
            assert.strictEqual(cableFeeder.strands[0].color_code, "Blue");

            // Strand 12: Aqua
            assert.strictEqual(cableFeeder.strands[11].strand_number, 12);
            assert.strictEqual(cableFeeder.strands[11].color_code, "Aqua");

            // Strand 13: Blue (Tube 2)
            assert.strictEqual(cableFeeder.strands[12].strand_number, 13);
            assert.strictEqual(cableFeeder.strands[12].color_code, "Blue (Tube 2)");
        });

        it("should allocate fiber strands to network endpoints", async () => {
            const strand1 = cableFeeder.strands[0];
            const allocated = await FiberInfrastructure.allocateStrand(orgA.id, {
                id: strand1.id,
                status: "CONNECTED",
                source_endpoint: "OLT-01 PON Port 0/1/1",
                target_endpoint: "FDC-01 Input Port",
                connected_entity_type: "SPLITTER_PORT",
                connected_entity_id: splitterFdc.id,
                measured_loss_db: 1.22
            });

            assert.strictEqual(allocated.status, "CONNECTED");
            assert.strictEqual(allocated.source_endpoint, "OLT-01 PON Port 0/1/1");
            assert.strictEqual(allocated.measured_loss_db, 1.22);
        });

        it("should create a splice closure and perform strand-to-strand fusion splice", async () => {
            closureFdc = await FiberInfrastructure.saveClosure(orgA.id, {
                name: "FDC-01 Outdoor Splice Cabinet",
                closure_type: "FDC",
                location: "Junction Box Sector 5",
                tray_capacity: 4,
                total_splice_capacity: 48
            });

            assert.ok(closureFdc.id);
            assert.strictEqual(closureFdc.total_splice_capacity, 48);
            assert.strictEqual(closureFdc.used_splice_capacity, 0);

            // Perform fusion splice between strand 1 and strand 2
            const splice = await FiberInfrastructure.addSplice(orgA.id, {
                closure_id: closureFdc.id,
                tray_number: 1,
                incoming_cable_id: cableFeeder.id,
                incoming_strand_number: 1,
                outgoing_cable_id: cableFeeder.id,
                outgoing_strand_number: 2,
                splice_type: "FUSION",
                splice_loss_db: 0.03,
                spliced_by: "Senior Fiber Splicer"
            });

            assert.ok(splice.id);
            assert.strictEqual(splice.splice_loss_db, 0.03);

            const updatedClosure = await R.getRow("SELECT used_splice_capacity FROM splice_closure WHERE id = ?", [closureFdc.id]);
            assert.strictEqual(updatedClosure.used_splice_capacity, 1);
        });

        it("should create and manage fiber patch cords", async () => {
            const patchCord = await FiberInfrastructure.savePatchCord(orgA.id, {
                name: "PatchCord-OLT01-ODF01",
                connector_a_type: "SC/UPC",
                connector_b_type: "SC/APC",
                fiber_type: "OS2_SINGLEMODE",
                length_meters: 3.0,
                source_port: "GPON 0/1/1",
                target_port: "ODF Tray 1 Port 1",
                insertion_loss_db: 0.20
            });

            assert.ok(patchCord.id);
            assert.strictEqual(patchCord.connector_a_type, "SC/UPC");
            assert.strictEqual(patchCord.connector_b_type, "SC/APC");
            assert.strictEqual(patchCord.insertion_loss_db, 0.20);
        });

        it("should accurately calculate optical loss budget and power margin", () => {
            const budget = FiberInfrastructure.calculateOpticalLossBudget({
                wavelength: "1490",
                cable_length_km: 7.5, // 7.5 km * 0.22 = 1.65 dB
                primary_split_ratio: "1:4", // 7.2 dB
                secondary_split_ratio: "1:8", // 10.5 dB
                connector_count: 4, // 4 * 0.35 = 1.40 dB
                splice_count: 4, // 4 * 0.05 = 0.20 dB
                safety_margin_db: 3.0, // 3.0 dB
                olt_tx_power_dbm: 3.0,
                onu_sensitivity_dbm: -27.0
            });

            // Expected calculations:
            // Fiber: 1.65 dB
            // Splitters: 7.2 + 10.5 = 17.7 dB
            // Connectors: 1.40 dB
            // Splices: 0.20 dB
            // Margin: 3.0 dB
            // Total: 1.65 + 17.7 + 1.40 + 0.20 + 3.0 = 23.95 dB
            // Expected Rx: 3.0 - 23.95 = -20.95 dBm
            // Margin: -20.95 - (-27.0) = +6.05 dB
            assert.strictEqual(budget.fiberLossDb, 1.65);
            assert.strictEqual(budget.totalSplitterLossDb, 17.7);
            assert.strictEqual(budget.totalConnectorLossDb, 1.4);
            assert.strictEqual(budget.totalSpliceLossDb, 0.2);
            assert.strictEqual(budget.totalEstimatedLossDb, 23.95);
            assert.strictEqual(budget.expectedRxPowerDbm, -20.95);
            assert.strictEqual(budget.opticalPowerMarginDb, 6.05);
            assert.strictEqual(budget.budgetStatus, "PASS_OPTIMAL");
        });

        it("should maintain immutable audit log of infrastructure changes", async () => {
            const logs = await FiberInfrastructure.getAuditLogs(orgA.id);
            assert.ok(logs.length >= 5);

            const actions = logs.map(l => l.action);
            assert.ok(actions.includes("CREATE"));
            assert.ok(actions.includes("PORT_CONNECT"));
            assert.ok(actions.includes("SPLICE"));
        });
    });
});
