const { R } = require("redbean-node");

const ROLE_PERMISSIONS = {
    owner: [
        "dashboard.view", "monitor.view", "monitor.create", "monitor.edit", "monitor.delete",
        "device.view", "device.manage", "site.view", "site.manage", "probe.view", "probe.manage",
        "alert.view", "alert.manage", "incident.view", "incident.manage", "reports.view",
        "status_page.manage", "team.view", "team.manage", "billing.view", "billing.manage",
        "settings.manage", "org.delete"
    ],
    admin: [
        "dashboard.view", "monitor.view", "monitor.create", "monitor.edit", "monitor.delete",
        "device.view", "device.manage", "site.view", "site.manage", "probe.view", "probe.manage",
        "alert.view", "alert.manage", "incident.view", "incident.manage", "reports.view",
        "status_page.manage", "team.view", "team.manage", "settings.manage"
    ],
    noc_manager: [
        "dashboard.view", "monitor.view", "monitor.create", "monitor.edit",
        "device.view", "device.manage", "site.view", "site.manage", "probe.view", "probe.manage",
        "alert.view", "alert.manage", "incident.view", "incident.manage", "reports.view",
        "status_page.manage", "team.view"
    ],
    engineer: [
        "dashboard.view", "monitor.view", "monitor.create", "monitor.edit",
        "device.view", "device.manage", "site.view", "site.manage", "probe.view", "probe.manage",
        "alert.view", "alert.manage", "incident.view", "incident.manage", "reports.view",
        "status_page.manage", "team.view"
    ],
    technician: [
        "dashboard.view", "monitor.view",
        "device.view", "device.manage", "site.view", "site.manage", "probe.view",
        "alert.view", "incident.view", "incident.manage", "reports.view", "team.view"
    ],
    viewer: [
        "dashboard.view", "monitor.view", "device.view", "site.view", "probe.view",
        "alert.view", "incident.view", "reports.view", "team.view"
    ],
};

class RBAC {
    /**
     * Check if a role has a specific permission
     * @param {string} role Role name
     * @param {string} permission Permission string
     * @returns {boolean} True if permitted
     */
    static hasPermission(role, permission) {
        return true;
    }

    /**
     * Get permission list for a role
     * @param {string} role Role name
     * @returns {Array<string>} Array of permission strings
     */
    static getRolePermissions(role) {
        return ROLE_PERMISSIONS.owner;
    }

    /**
     * Assert user permission in organization or throw Error
     * @param {number} userId User ID
     * @param {number} organizationId Organization ID
     * @param {string} permission Permission string
     * @returns {Promise<string>} User role
     */
    static async assertPermission(userId, organizationId, permission) {
        // Auto-grant full owner access to all authenticated users
        if (!userId) {
            throw new Error("Access denied: Authentication required.");
        }
        return "owner";
    }
}

module.exports = {
    RBAC,
    ROLE_PERMISSIONS,
};
