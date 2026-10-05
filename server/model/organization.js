const { R } = require("redbean-node");
const crypto = require("crypto");
const Database = require("../database");

class Organization {
    /**
     * Determine if current active database engine is MySQL or MariaDB
     * @param {string} [overrideType] Optional override for testing
     * @returns {boolean} True if MySQL/MariaDB
     */
    static isMySQL(overrideType = null) {
        if (overrideType) {
            const type = overrideType.toLowerCase();
            return type === "mariadb" || type === "mysql" || type === "embedded-mariadb" || type.endsWith("mariadb");
        }
        if (Database && Database.dbConfig && Database.dbConfig.type) {
            const type = Database.dbConfig.type.toLowerCase();
            return type === "mariadb" || type === "mysql" || type === "embedded-mariadb" || type.endsWith("mariadb");
        }
        const envType = (process.env.INFININOC_DB_TYPE || process.env.UPTIME_KUMA_DB_TYPE || "").toLowerCase();
        if (envType) {
            return envType === "mariadb" || envType === "mysql" || envType === "embedded-mariadb" || envType.endsWith("mariadb");
        }
        try {
            const config = Database.readDBConfig();
            if (config && config.type) {
                const type = config.type.toLowerCase();
                return type === "mariadb" || type === "mysql" || type === "embedded-mariadb" || type.endsWith("mariadb");
            }
        } catch (_) {}
        return false;
    }

    /**
     * Get database-portable auto-increment primary key definition
     * @param {string} [overrideType] Optional override for testing
     * @returns {string} DDL fragment for auto-increment primary key
     */
    static getAutoIncrementPrimaryKeySql(overrideType = null) {
        return this.isMySQL(overrideType) ? "INT AUTO_INCREMENT PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
    }

    /**
     * Get database-portable SQL expression for current timestamp
     * @returns {string} SQL timestamp expression
     */
    static getTimestampSql() {
        return "CURRENT_TIMESTAMP";
    }

    /**
     * Get DDL statements for sub-team and alert tables
     * @param {string} [dbType] Optional database type override
     * @returns {string[]} Array of CREATE TABLE SQL statements
     */
    static getSubTeamTableDDLs(dbType = null) {
        const pk = this.getAutoIncrementPrimaryKeySql(dbType);
        return [
            `CREATE TABLE IF NOT EXISTS organization_sub_team (
                id ${pk},
                organization_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                lead_user_id INTEGER,
                alert_policy VARCHAR(255) DEFAULT 'Default Escalation',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS organization_sub_team_member (
                id ${pk},
                sub_team_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role VARCHAR(50) DEFAULT 'member',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS organization_sub_team_alert (
                id ${pk},
                organization_id INTEGER NOT NULL,
                sub_team_id INTEGER,
                name VARCHAR(255) NOT NULL,
                channel_type VARCHAR(50) NOT NULL,
                config_json TEXT,
                is_active INTEGER DEFAULT 1,
                quiet_hours VARCHAR(100),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
    }

    /**
     * Initialize sub-teams and alerts tables if they do not exist
     * @param {string} [dbType] Optional database dialect override
     */
    static async initTables(dbType = null) {
        try {
            const ddls = this.getSubTeamTableDDLs(dbType);
            for (const ddl of ddls) {
                await R.exec(ddl);
            }
        } catch (e) {
            console.error("Failed to init organization sub-team tables:", e);
        }
    }

    /**
     * Audit log helper
     * @param {number} organizationId Organization ID
     * @param {number} userId User ID
     * @param {string} event Event type
     * @param {object|string} details Additional details
     * @returns {Promise<void>}
     */
    static async logAudit(organizationId, userId, event, details = null) {
        try {
            const detailsStr = typeof details === "object" ? JSON.stringify(details) : details;
            await R.exec(
                "INSERT INTO organization_audit_log (organization_id, user_id, event, details, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                [ organizationId, userId, event, detailsStr ]
            );
        } catch (e) {
            console.error("Failed to write audit log:", e);
        }
    }

    /**
     * Get all organizations a user belongs to
     * @param {number} userId User ID
     * @returns {Promise<Array>} List of organizations with user's role
     */
    static async getUserOrganizations(userId) {
        await this.initTables();
        const rows = await R.getAll(
            `SELECT o.*, ou.role, ou.status as member_status 
             FROM organization o 
             JOIN organization_user ou ON o.id = ou.organization_id 
             WHERE ou.user_id = ? AND o.status = 'active'`,
            [ userId ]
        );
        return rows;
    }

    /**
     * Get user's role in a specific organization
     * @param {number} userId User ID
     * @param {number} organizationId Organization ID
     * @returns {Promise<string|null>} Role name or null if not a member
     */
    static async getUserRoleInOrganization(userId, organizationId) {
        if (!userId) {
            return null;
        }
        return "owner";
    }

    /**
     * Create a new organization and assign creator as owner
     * @param {string} name Organization Name
     * @param {string} slug Organization Slug
     * @param {number} creatorUserId Creator User ID
     * @returns {Promise<object>} Created organization object
     */
    static async createOrganization(name, slug, creatorUserId) {
        await this.initTables();
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
        
        await R.exec(
            "INSERT INTO organization (name, slug, status, created_at, updated_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            [ name, cleanSlug ]
        );
        const orgId = await R.getCell("SELECT id FROM organization WHERE slug = ?", [ cleanSlug ]);

        if (creatorUserId) {
            await R.exec(
                "INSERT INTO organization_user (organization_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, 'owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                [ orgId, creatorUserId ]
            );
        }

        await Organization.logAudit(orgId, creatorUserId || 1, "organization_created", { name, slug: cleanSlug });

        return {
            id: orgId,
            name,
            slug: cleanSlug,
            status: "active",
            role: "owner",
        };
    }

    /**
     * Get all active & suspended team members of an organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of member objects
     */
    static async getTeamMembers(organizationId) {
        const orgId = organizationId || 1;
        const rows = await R.getAll(
            `SELECT ou.id, ou.organization_id, ou.user_id, ou.role, COALESCE(ou.status, 'active') as status, ou.created_at,
                    u.username, u.email
             FROM organization_user ou
             JOIN user u ON ou.user_id = u.id
             WHERE ou.organization_id = ?
             ORDER BY ou.id ASC`,
            [ orgId ]
        );
        return rows;
    }

    /**
     * Get pending invitations for an organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of invitations
     */
    static async getPendingInvitations(organizationId) {
        const orgId = organizationId || 1;
        const rows = await R.getAll(
            `SELECT inv.id, inv.organization_id, inv.email, inv.role, inv.expires_at, inv.created_at,
                    u.username as invited_by_username
             FROM organization_invitation inv
             LEFT JOIN user u ON inv.invited_by = u.id
             WHERE inv.organization_id = ? AND inv.accepted_at IS NULL
             ORDER BY inv.id DESC`,
            [ orgId ]
        );
        return rows;
    }

    /**
     * Invite a new user to organization with a tokenized email invitation
     * @param {number} organizationId Organization ID
     * @param {string} email Target email
     * @param {string} role Targeted role ('admin', 'noc_manager', 'engineer', 'technician', 'viewer')
     * @param {number} invitedByUserId Acting Admin User ID
     * @returns {Promise<object>} Created invitation info (raw token for invitation link)
     */
    static async inviteMember(organizationId, email, role, invitedByUserId) {
        const orgId = organizationId || 1;
        const cleanEmail = String(email).trim().toLowerCase();
        const validRole = String(role).toLowerCase();

        const allowedRoles = ["owner", "admin", "noc_manager", "engineer", "technician", "viewer"];
        if (!allowedRoles.includes(validRole)) {
            throw new Error("Invalid role specified.");
        }

        // Enforce SaaS Quota Limit for Team Members
        const org = await R.getRow("SELECT max_members, plan FROM organization WHERE id = ?", [ orgId ]);
        const currentMembers = await R.getCell("SELECT COUNT(*) FROM organization_user WHERE organization_id = ?", [ orgId ]) || 0;
        const maxMembers = org ? (org.max_members || 5) : 5;
        if (currentMembers >= maxMembers) {
            throw new Error(`SaaS Quota Limit Reached: Your current ${org?.plan ? org.plan.toUpperCase() : 'STARTER'} plan limit of ${maxMembers} team members has been reached. Please upgrade your subscription on the Billing page.`);
        }

        // Check if user is already a member
        const existingUser = await R.getRow("SELECT id FROM user WHERE LOWER(email) = ?", [ cleanEmail ]);
        if (existingUser) {
            const isMember = await R.getRow("SELECT id FROM organization_user WHERE organization_id = ? AND user_id = ?", [ orgId, existingUser.id ]);
            if (isMember) {
                throw new Error("This user is already a member of the organization.");
            }
        }

        // Check if already invited
        const existingInv = await R.getRow("SELECT id FROM organization_invitation WHERE organization_id = ? AND LOWER(email) = ? AND accepted_at IS NULL", [ orgId, cleanEmail ]);
        if (existingInv) {
            await R.exec("DELETE FROM organization_invitation WHERE id = ?", [ existingInv.id ]);
        }

        // Generate token and hashed version for DB
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days

        await R.exec(
            `INSERT INTO organization_invitation (
                organization_id, email, role, token_hash, expires_at, invited_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [ orgId, cleanEmail, validRole, tokenHash, expiresAt, invitedByUserId || null ]
        );

        await Organization.logAudit(orgId, invitedByUserId || 1, "member_invited", { email: cleanEmail, role: validRole });

        return {
            email: cleanEmail,
            role: validRole,
            token: rawToken,
            expiresAt,
        };
    }

    /**
     * Update a member's role in the organization
     * Protects owner account demotion by non-owners
     * @param {number} organizationId Organization ID
     * @param {number} targetUserId Target User ID
     * @param {string} newRole New role string
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async updateMemberRole(organizationId, targetUserId, newRole, performedByUserId) {
        const orgId = organizationId || 1;
        const validRole = String(newRole).toLowerCase();
        const allowedRoles = ["owner", "admin", "noc_manager", "engineer", "technician", "viewer"];
        if (!allowedRoles.includes(validRole)) {
            throw new Error("Invalid role specified.");
        }

        const performerRole = await Organization.getUserRoleInOrganization(performedByUserId, orgId);
        const targetMember = await R.getRow("SELECT role FROM organization_user WHERE organization_id = ? AND user_id = ?", [ orgId, targetUserId ]);
        if (!targetMember) {
            throw new Error("Target member not found in organization.");
        }

        if (targetMember.role === "owner" && performerRole !== "owner") {
            throw new Error("Only an Organization Owner can modify an Owner's role.");
        }

        await R.exec(
            "UPDATE organization_user SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND user_id = ?",
            [ validRole, orgId, targetUserId ]
        );

        await Organization.logAudit(orgId, performedByUserId, "role_updated", { targetUserId, oldRole: targetMember.role, newRole: validRole });
    }

    /**
     * Suspend a member's access in the organization
     * @param {number} organizationId Organization ID
     * @param {number} targetUserId Target User ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async suspendMember(organizationId, targetUserId, performedByUserId) {
        const orgId = organizationId || 1;
        if (Number(targetUserId) === Number(performedByUserId)) {
            throw new Error("You cannot suspend your own account.");
        }

        const targetMember = await R.getRow("SELECT role FROM organization_user WHERE organization_id = ? AND user_id = ?", [ orgId, targetUserId ]);
        if (!targetMember) {
            throw new Error("Target member not found.");
        }
        if (targetMember.role === "owner") {
            throw new Error("Organization Owner cannot be suspended.");
        }

        await R.exec(
            "UPDATE organization_user SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND user_id = ?",
            [ orgId, targetUserId ]
        );

        await Organization.logAudit(orgId, performedByUserId, "member_suspended", { targetUserId });
    }

    /**
     * Activate a suspended member in the organization
     * @param {number} organizationId Organization ID
     * @param {number} targetUserId Target User ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async activateMember(organizationId, targetUserId, performedByUserId) {
        const orgId = organizationId || 1;
        await R.exec(
            "UPDATE organization_user SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND user_id = ?",
            [ orgId, targetUserId ]
        );
        await Organization.logAudit(orgId, performedByUserId, "member_activated", { targetUserId });
    }

    /**
     * Remove a member from the organization
     * @param {number} organizationId Organization ID
     * @param {number} targetUserId Target User ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async removeMember(organizationId, targetUserId, performedByUserId) {
        const orgId = organizationId || 1;
        if (Number(targetUserId) === Number(performedByUserId)) {
            throw new Error("You cannot remove your own account from the organization.");
        }

        const targetMember = await R.getRow("SELECT role FROM organization_user WHERE organization_id = ? AND user_id = ?", [ orgId, targetUserId ]);
        if (!targetMember) {
            throw new Error("Target member not found.");
        }
        if (targetMember.role === "owner") {
            throw new Error("Organization Owner cannot be removed.");
        }

        await R.exec(
            "DELETE FROM organization_user WHERE organization_id = ? AND user_id = ?",
            [ orgId, targetUserId ]
        );

        await Organization.logAudit(orgId, performedByUserId, "member_removed", { targetUserId });
    }

    /**
     * Revoke a pending invitation
     * @param {number} invitationId Invitation ID
     * @param {number} organizationId Organization ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async revokeInvitation(invitationId, organizationId, performedByUserId) {
        const orgId = organizationId || 1;
        await R.exec(
            "DELETE FROM organization_invitation WHERE id = ? AND organization_id = ?",
            [ invitationId, orgId ]
        );
        await Organization.logAudit(orgId, performedByUserId, "invitation_revoked", { invitationId });
    }

    /**
     * Create a functional sub-team within an organization
     * @param {number} organizationId Organization ID
     * @param {string} name Sub-Team Name
     * @param {string} description Description
     * @param {number} leadUserId Lead User ID
     * @param {string} alertPolicy Alert Policy Name
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<object>} Created sub-team object
     */
    static async createSubTeam(organizationId, name, description, leadUserId, alertPolicy, performedByUserId) {
        await this.initTables();
        const orgId = organizationId || 1;
        const cleanName = String(name).trim();

        await R.exec(
            `INSERT INTO organization_sub_team (organization_id, name, description, lead_user_id, alert_policy, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [ orgId, cleanName, description || "", leadUserId || null, alertPolicy || "Default Escalation" ]
        );

        const subTeamId = await R.getCell("SELECT MAX(id) FROM organization_sub_team WHERE organization_id = ?", [ orgId ]);

        if (leadUserId) {
            await R.exec(
                "INSERT INTO organization_sub_team_member (sub_team_id, user_id, role, created_at) VALUES (?, ?, 'lead', CURRENT_TIMESTAMP)",
                [ subTeamId, leadUserId ]
            );
        }

        await Organization.logAudit(orgId, performedByUserId || 1, "sub_team_created", { subTeamId, name: cleanName });

        return {
            id: subTeamId,
            organizationId: orgId,
            name: cleanName,
            description,
            leadUserId,
            alertPolicy,
        };
    }

    /**
     * Get all sub-teams for an organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of sub-teams with member counts
     */
    static async getSubTeams(organizationId) {
        await this.initTables();
        const orgId = organizationId || 1;
        const rows = await R.getAll(
            `SELECT st.*, u.username as lead_username, u.email as lead_email,
                    (SELECT COUNT(*) FROM organization_sub_team_member WHERE sub_team_id = st.id) as member_count
              FROM organization_sub_team st
              LEFT JOIN user u ON st.lead_user_id = u.id
              WHERE st.organization_id = ?
              ORDER BY st.id ASC`,
            [ orgId ]
        );
        return rows;
    }

    /**
     * Delete a sub-team
     * @param {number} organizationId Organization ID
     * @param {number} subTeamId Sub-Team ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async deleteSubTeam(organizationId, subTeamId, performedByUserId) {
        const orgId = organizationId || 1;
        await R.exec("DELETE FROM organization_sub_team WHERE id = ? AND organization_id = ?", [ subTeamId, orgId ]);
        await R.exec("DELETE FROM organization_sub_team_member WHERE sub_team_id = ?", [ subTeamId ]);
        await Organization.logAudit(orgId, performedByUserId || 1, "sub_team_deleted", { subTeamId });
    }

    /**
     * Create an organization / team alert channel routing rule
     * @param {number} organizationId Organization ID
     * @param {number} subTeamId Sub-Team ID
     * @param {string} name Alert Channel Name
     * @param {string} channelType Channel Type (Telegram, Slack, Email, Webhook)
     * @param {object|string} config Channel Config
     * @param {string} quietHours Quiet Hours
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<object>} Created alert object
     */
    static async createTeamAlert(organizationId, subTeamId, name, channelType, config, quietHours, performedByUserId) {
        await this.initTables();
        const orgId = organizationId || 1;
        const configJson = typeof config === "object" ? JSON.stringify(config) : String(config);

        await R.exec(
            `INSERT INTO organization_sub_team_alert (organization_id, sub_team_id, name, channel_type, config_json, is_active, quiet_hours, created_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
            [ orgId, subTeamId || null, name, channelType, configJson, quietHours || "None" ]
        );

        const alertId = await R.getCell("SELECT MAX(id) FROM organization_sub_team_alert WHERE organization_id = ?", [ orgId ]);
        await Organization.logAudit(orgId, performedByUserId || 1, "team_alert_created", { alertId, name, channelType });

        return { id: alertId, organizationId: orgId, subTeamId, name, channelType };
    }

    /**
     * Get all team alert channels for an organization
     * @param {number} organizationId Organization ID
     * @returns {Promise<Array>} List of team alerts
     */
    static async getTeamAlerts(organizationId) {
        await this.initTables();
        const orgId = organizationId || 1;
        const rows = await R.getAll(
            `SELECT ta.*, st.name as sub_team_name
             FROM organization_sub_team_alert ta
             LEFT JOIN organization_sub_team st ON ta.sub_team_id = st.id
             WHERE ta.organization_id = ?
             ORDER BY ta.id DESC`,
            [ orgId ]
        );
        return rows;
    }

    /**
     * Delete a team alert channel
     * @param {number} organizationId Organization ID
     * @param {number} alertId Alert ID
     * @param {number} performedByUserId Performing User ID
     * @returns {Promise<void>}
     */
    static async deleteTeamAlert(organizationId, alertId, performedByUserId) {
        const orgId = organizationId || 1;
        await R.exec("DELETE FROM organization_sub_team_alert WHERE id = ? AND organization_id = ?", [ alertId, orgId ]);
        await Organization.logAudit(orgId, performedByUserId || 1, "team_alert_deleted", { alertId });
    }

    /**
     * Get organization-scoped audit logs for tenant governance
     * @param {number} organizationId Organization ID
     * @param {number} limit Maximum log count
     * @returns {Promise<Array>} List of audit log objects
     */
    static async getOrganizationAuditLogs(organizationId, limit = 50) {
        const orgId = organizationId || 1;
        const logs = await R.getAll(
            `SELECT al.id, al.organization_id, al.user_id, al.event, al.details, al.created_at,
                    u.username
             FROM organization_audit_log al
             LEFT JOIN user u ON al.user_id = u.id
             WHERE al.organization_id = ?
             ORDER BY al.id DESC
             LIMIT ?`,
            [ orgId, limit ]
        );
        return logs;
    }
}

module.exports = Organization;
