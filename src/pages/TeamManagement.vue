<template>
    <div class="noc-team-page container-fluid py-4">
        <!-- Top Control Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="users" class="text-primary" />
                    <span>Team & Role Access Control</span>
                </h3>
                <div class="text-muted small mb-0">
                    Manage team members, sub-teams, team alert channels, and RBAC permissions for <span class="text-primary fw-bold">{{ activeOrgName }}</span>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2 flex-wrap">
                <button class="btn btn-outline-info fw-bold btn-sm d-flex align-items-center gap-2" @click="showMatrixModal = true">
                    <font-awesome-icon icon="shield-alt" />
                    <span>RBAC Matrix</span>
                </button>
                <button v-if="canManageTeam" class="btn btn-outline-warning fw-bold btn-sm d-flex align-items-center gap-2" @click="showCreateSubTeamModal = true">
                    <font-awesome-icon icon="sitemap" />
                    <span>Create Sub-Team</span>
                </button>
                <button v-if="canManageTeam" class="btn btn-outline-success fw-bold btn-sm d-flex align-items-center gap-2" @click="showCreateAlertModal = true">
                    <font-awesome-icon icon="bell" />
                    <span>Add Alert Channel</span>
                </button>
                <button v-if="canManageTeam" class="btn btn-primary fw-bold btn-sm d-flex align-items-center gap-2" @click="showInviteModal = true">
                    <font-awesome-icon icon="user-plus" />
                    <span>Invite Member</span>
                </button>
            </div>
        </div>

        <!-- 4 KPI Telemetry Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-sm-3">
                <div class="card bg-card border-secondary shadow-sm p-3 h-100 border-start border-4 border-primary">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Total Team Members</div>
                    <div class="fw-bold fs-3 text-foreground font-monospace">{{ members.length }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="card bg-card border-secondary shadow-sm p-3 h-100 border-start border-4 border-info">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Functional Sub-Teams</div>
                    <div class="fw-bold fs-3 text-info font-monospace">{{ subTeams.length }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="card bg-card border-secondary shadow-sm p-3 h-100 border-start border-4 border-warning">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Team Alert Channels</div>
                    <div class="fw-bold fs-3 text-warning font-monospace">{{ teamAlerts.length }}</div>
                </div>
            </div>
            <div class="col-6 col-sm-3">
                <div class="card bg-card border-secondary shadow-sm p-3 h-100 border-start border-4 border-success">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Your Role</div>
                    <div class="fw-bold fs-5 text-success text-uppercase font-monospace mt-1">{{ currentUserRole }}</div>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <ul class="nav nav-tabs border-secondary mb-4">
            <li class="nav-item">
                <button
                    class="nav-link fw-bold text-foreground"
                    :class="{ active: activeTab === 'members' }"
                    @click="activeTab = 'members'"
                >
                    <font-awesome-icon icon="user-shield" class="me-2 text-primary" />
                    Organization Members ({{ members.length }})
                </button>
            </li>
            <li class="nav-item">
                <button
                    class="nav-link fw-bold text-foreground"
                    :class="{ active: activeTab === 'subteams' }"
                    @click="activeTab = 'subteams'"
                >
                    <font-awesome-icon icon="sitemap" class="me-2 text-info" />
                    Sub-Teams & Squads ({{ subTeams.length }})
                </button>
            </li>
            <li class="nav-item">
                <button
                    class="nav-link fw-bold text-foreground"
                    :class="{ active: activeTab === 'alerts' }"
                    @click="activeTab = 'alerts'"
                >
                    <font-awesome-icon icon="bell" class="me-2 text-warning" />
                    Team Alert Channels ({{ teamAlerts.length }})
                </button>
            </li>
            <li class="nav-item">
                <button
                    class="nav-link fw-bold text-foreground"
                    :class="{ active: activeTab === 'audit' }"
                    @click="activeTab = 'audit'"
                >
                    <font-awesome-icon icon="history" class="me-2 text-secondary" />
                    Security & Audit Stream
                </button>
            </li>
        </ul>

        <!-- TAB 1: Organization Members & Invitations -->
        <div v-if="activeTab === 'members'">
            <!-- Active Team Members Section -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold mb-0 text-uppercase text-foreground d-flex align-items-center gap-2">
                        <font-awesome-icon icon="user-shield" class="text-primary" />
                        <span>Active Members in {{ activeOrgName }}</span>
                    </h6>
                    <span class="badge bg-secondary font-monospace">Server-Side RBAC Protected</span>
                </div>

                <div class="card-body p-0">
                    <div v-if="loading" class="text-center py-5 text-muted">
                        <div class="spinner-border text-primary me-2" role="status"></div>
                        <span>Loading team members...</span>
                    </div>

                    <div v-else-if="members.length > 0" class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>USER ID</th>
                                    <th>MEMBER USERNAME</th>
                                    <th>EMAIL ADDRESS</th>
                                    <th>ROLE</th>
                                    <th>STATUS</th>
                                    <th>JOINED DATE</th>
                                    <th v-if="canManageTeam" class="text-end">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="m in members" :key="m.id">
                                    <td class="fw-bold text-muted">#{{ m.user_id }}</td>
                                    <td>
                                        <div class="fw-bold text-foreground">{{ m.username }}</div>
                                    </td>
                                    <td class="text-muted small">{{ m.email || 'N/A' }}</td>
                                    <td>
                                        <span class="badge" :class="getRoleBadgeClass(m.role)">
                                            {{ formatRole(m.role) }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge" :class="m.status === 'suspended' ? 'bg-danger text-white' : 'bg-success text-white'">
                                            {{ (m.status || 'active').toUpperCase() }}
                                        </span>
                                    </td>
                                    <td class="text-muted small">{{ m.created_at || 'N/A' }}</td>
                                    <td v-if="canManageTeam" class="text-end">
                                        <div class="btn-group btn-group-sm">
                                            <button
                                                class="btn btn-outline-secondary dropdown-toggle"
                                                type="button"
                                                data-bs-toggle="dropdown"
                                            >
                                                Role
                                            </button>
                                            <ul class="dropdown-menu dropdown-menu-end shadow">
                                                <li><a class="dropdown-item small" href="#" @click.prevent="changeRole(m.user_id, 'admin')">Set Admin</a></li>
                                                <li><a class="dropdown-item small" href="#" @click.prevent="changeRole(m.user_id, 'noc_manager')">Set NOC Manager</a></li>
                                                <li><a class="dropdown-item small" href="#" @click.prevent="changeRole(m.user_id, 'engineer')">Set Engineer</a></li>
                                                <li><a class="dropdown-item small" href="#" @click.prevent="changeRole(m.user_id, 'technician')">Set Technician</a></li>
                                                <li><a class="dropdown-item small" href="#" @click.prevent="changeRole(m.user_id, 'viewer')">Set Viewer</a></li>
                                            </ul>

                                            <button
                                                v-if="m.status !== 'suspended'"
                                                class="btn btn-outline-warning"
                                                title="Suspend Access"
                                                @click="suspendMember(m.user_id)"
                                            >
                                                Suspend
                                            </button>
                                            <button
                                                v-else
                                                class="btn btn-outline-success"
                                                title="Activate Access"
                                                @click="activateMember(m.user_id)"
                                            >
                                                Activate
                                            </button>
                                            <button
                                                class="btn btn-outline-danger"
                                                title="Remove Member"
                                                @click="removeMember(m.user_id)"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Pending Invitations Section -->
            <div class="card bg-card border-secondary shadow-sm mb-4">
                <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold mb-0 text-uppercase text-foreground d-flex align-items-center gap-2">
                        <font-awesome-icon icon="envelope-open-text" class="text-warning" />
                        <span>Pending Tokenized Invitations ({{ invitations.length }})</span>
                    </h6>
                </div>
                <div class="card-body p-0">
                    <div v-if="invitations.length === 0" class="text-center py-4 text-muted small">
                        No pending email invitations found.
                    </div>
                    <div v-else class="table-responsive">
                        <table class="table table-hover align-middle mb-0 font-monospace">
                            <thead class="table-dark">
                                <tr>
                                    <th>INVITED EMAIL</th>
                                    <th>ASSIGNED ROLE</th>
                                    <th>INVITED BY</th>
                                    <th>EXPIRES AT</th>
                                    <th v-if="canManageTeam" class="text-end">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="inv in invitations" :key="inv.id">
                                    <td class="fw-bold text-foreground">{{ inv.email }}</td>
                                    <td>
                                        <span class="badge" :class="getRoleBadgeClass(inv.role)">{{ formatRole(inv.role) }}</span>
                                    </td>
                                    <td class="text-muted small">{{ inv.invited_by_username || 'Admin' }}</td>
                                    <td class="text-muted small">{{ inv.expires_at }}</td>
                                    <td v-if="canManageTeam" class="text-end">
                                        <button class="btn btn-outline-danger btn-sm" @click="revokeInvitation(inv.id)">
                                            Revoke
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 2: Sub-Teams & Squads -->
        <div v-else-if="activeTab === 'subteams'">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-foreground mb-0">Functional Sub-Teams & Operations Squads</h5>
                <button v-if="canManageTeam" class="btn btn-warning btn-sm fw-bold" @click="showCreateSubTeamModal = true">
                    + Create New Sub-Team
                </button>
            </div>

            <div v-if="subTeams.length === 0" class="card bg-card border-secondary p-5 text-center my-3">
                <font-awesome-icon icon="sitemap" class="fs-1 text-muted mb-3" />
                <h5 class="fw-bold text-foreground">No Sub-Teams Created Yet</h5>
                <p class="text-muted small max-w-md mx-auto">Create functional sub-teams (e.g., L1 Support, DevOps Infrastructure, SecOps) to organize members and assign custom on-call alert escalation policies.</p>
                <button v-if="canManageTeam" class="btn btn-primary btn-sm fw-bold w-auto mx-auto" @click="showCreateSubTeamModal = true">
                    Create First Sub-Team
                </button>
            </div>

            <div v-else class="row g-3">
                <div v-for="st in subTeams" :key="st.id" class="col-12 col-md-6 col-lg-4">
                    <div class="card bg-card border-secondary shadow-sm h-100 p-3 position-relative">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="fw-bold text-primary mb-0">{{ st.name }}</h5>
                            <span class="badge bg-secondary font-monospace">{{ st.member_count || 1 }} Members</span>
                        </div>
                        <p class="text-muted small mb-3">{{ st.description || 'No description provided.' }}</p>
                        <div class="small border-top border-secondary pt-2 text-foreground font-monospace">
                            <div><strong>Lead:</strong> {{ st.lead_username ? '@' + st.lead_username : 'Unassigned' }}</div>
                            <div><strong>Escalation Policy:</strong> <span class="text-warning">{{ st.alert_policy }}</span></div>
                        </div>
                        <div v-if="canManageTeam" class="mt-3 pt-2 border-top border-secondary text-end">
                            <button class="btn btn-outline-danger btn-xs" @click="deleteSubTeam(st.id)">
                                Delete Sub-Team
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 3: Team Alert Channels -->
        <div v-else-if="activeTab === 'alerts'">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-foreground mb-0">Team Alert Channels & Notification Routing</h5>
                <button v-if="canManageTeam" class="btn btn-success btn-sm fw-bold" @click="showCreateAlertModal = true">
                    + Add Alert Channel
                </button>
            </div>

            <div v-if="teamAlerts.length === 0" class="card bg-card border-secondary p-5 text-center my-3">
                <font-awesome-icon icon="bell" class="fs-1 text-muted mb-3" />
                <h5 class="fw-bold text-foreground">No Team Alert Channels Configured</h5>
                <p class="text-muted small">Configure Slack, Telegram, PagerDuty, or Webhook notification routing for organization sub-teams.</p>
                <button v-if="canManageTeam" class="btn btn-success btn-sm fw-bold w-auto mx-auto" @click="showCreateAlertModal = true">
                    Configure Alert Channel
                </button>
            </div>

            <div v-else class="table-responsive">
                <table class="table table-hover bg-card border-secondary align-middle font-monospace">
                    <thead class="table-dark">
                        <tr>
                            <th>CHANNEL NAME</th>
                            <th>TYPE</th>
                            <th>ASSIGNED SUB-TEAM</th>
                            <th>QUIET HOURS</th>
                            <th>STATUS</th>
                            <th v-if="canManageTeam" class="text-end">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="a in teamAlerts" :key="a.id">
                            <td class="fw-bold text-foreground">{{ a.name }}</td>
                            <td>
                                <span class="badge bg-primary text-uppercase">{{ a.channel_type }}</span>
                            </td>
                            <td>{{ a.sub_team_name || 'All Organization Teams' }}</td>
                            <td class="text-muted small">{{ a.quiet_hours || 'None' }}</td>
                            <td>
                                <span class="badge bg-success">ACTIVE</span>
                            </td>
                            <td v-if="canManageTeam" class="text-end">
                                <button class="btn btn-outline-danger btn-sm" @click="deleteTeamAlert(a.id)">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 4: Security Audit Stream -->
        <div v-else-if="activeTab === 'audit'" class="card bg-card border-secondary shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0 text-uppercase text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="history" class="text-warning" />
                    <span>Organization Security & Audit Log</span>
                </h6>
                <span class="badge bg-secondary font-monospace">Immutable Event Stream</span>
            </div>
            <div class="card-body p-0">
                <div v-if="auditLogs.length === 0" class="text-center py-4 text-muted small">
                    No security audit events logged yet.
                </div>
                <div v-else class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>LOG ID</th>
                                <th>EVENT TYPE</th>
                                <th>PERFORMED BY</th>
                                <th>DETAILS</th>
                                <th>TIMESTAMP</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="log in auditLogs" :key="log.id">
                                <td class="fw-bold text-muted">#{{ log.id }}</td>
                                <td>
                                    <span class="badge bg-secondary text-uppercase">{{ log.event }}</span>
                                </td>
                                <td class="fw-bold text-foreground">{{ log.username || 'System' }}</td>
                                <td class="text-muted small text-truncate" style="max-width: 300px;">{{ log.details }}</td>
                                <td class="text-muted small">{{ log.created_at }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL 1: Invite Member -->
        <div v-if="showInviteModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold">Invite Team Member</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showInviteModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Email Address</label>
                            <input v-model="inviteForm.email" type="email" class="form-control bg-card border-secondary text-foreground" placeholder="colleague@company.com" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Role</label>
                            <select v-model="inviteForm.role" class="form-select bg-card border-secondary text-foreground">
                                <option value="admin">Admin — Full operational & billing access</option>
                                <option value="noc_manager">NOC Manager — Escalation & team management</option>
                                <option value="engineer">Engineer — Monitor, device, & site management</option>
                                <option value="technician">Technician — Diagnostics & tool execution</option>
                                <option value="viewer">Viewer — Read-only telemetry access</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showInviteModal = false">Cancel</button>
                        <button class="btn btn-primary fw-bold" @click="submitInvite">Send Invitation</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 2: Create Sub-Team -->
        <div v-if="showCreateSubTeamModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold">Create Functional Sub-Team</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateSubTeamModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Sub-Team Name</label>
                            <input v-model="subTeamForm.name" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="e.g. Cloud DevOps, SecOps, L1 Desk" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Description</label>
                            <textarea v-model="subTeamForm.description" class="form-control bg-card border-secondary text-foreground" rows="2" placeholder="Responsibilities and scope"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Escalation Policy</label>
                            <select v-model="subTeamForm.alertPolicy" class="form-select bg-card border-secondary text-foreground">
                                <option value="Default Escalation">Default Escalation (Email + Slack)</option>
                                <option value="24/7 Urgent PagerDuty">24/7 Urgent PagerDuty & Call</option>
                                <option value="Business Hours Only">Business Hours Only (09:00 - 18:00)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showCreateSubTeamModal = false">Cancel</button>
                        <button class="btn btn-warning fw-bold" @click="submitCreateSubTeam">Create Sub-Team</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 3: Create Alert Channel -->
        <div v-if="showCreateAlertModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold">Add Team Alert Channel</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateAlertModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Channel Name</label>
                            <input v-model="alertForm.name" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="e.g. Slack #noc-critical, Telegram Urgent" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Channel Type</label>
                            <select v-model="alertForm.channelType" class="form-select bg-card border-secondary text-foreground">
                                <option value="Slack">Slack Webhook</option>
                                <option value="Telegram">Telegram Bot</option>
                                <option value="PagerDuty">PagerDuty Integration</option>
                                <option value="Email">Team Email Group</option>
                                <option value="Webhook">Custom REST Webhook</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted text-uppercase">Assign to Sub-Team</label>
                            <select v-model="alertForm.subTeamId" class="form-select bg-card border-secondary text-foreground">
                                <option :value="null">All Organization Teams</option>
                                <option v-for="st in subTeams" :key="st.id" :value="st.id">{{ st.name }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showCreateAlertModal = false">Cancel</button>
                        <button class="btn btn-success fw-bold" @click="submitCreateAlert">Save Alert Channel</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 4: RBAC Matrix Modal -->
        <div v-if="showMatrixModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content bg-card border-secondary text-foreground">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title fw-bold">Server-Side RBAC Permission Matrix</h5>
                        <button type="button" class="btn-close btn-close-white" @click="showMatrixModal = false"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="table-responsive">
                            <table class="table table-bordered align-middle mb-0 font-monospace small">
                                <thead class="table-dark">
                                    <tr>
                                        <th>PERMISSION RESOURCE</th>
                                        <th>OWNER</th>
                                        <th>ADMIN</th>
                                        <th>NOC MANAGER</th>
                                        <th>ENGINEER</th>
                                        <th>TECHNICIAN</th>
                                        <th>VIEWER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="fw-bold">Billing & Subscription</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                    </tr>
                                    <tr>
                                        <td class="fw-bold">Team Member Management</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                    </tr>
                                    <tr>
                                        <td class="fw-bold">Sub-Team & Alert Routing</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                    </tr>
                                    <tr>
                                        <td class="fw-bold">Monitor & Device Create/Delete</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-danger">✗</td>
                                        <td class="text-danger">✗</td>
                                    </tr>
                                    <tr>
                                        <td class="fw-bold">Tool Execution & Diagnostics</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-danger">✗</td>
                                    </tr>
                                    <tr>
                                        <td class="fw-bold">View Telemetry & Status Pages</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                        <td class="text-success fw-bold">✓</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button class="btn btn-secondary" @click="showMatrixModal = false">Close Matrix</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            loading: true,
            activeTab: "members",
            members: [],
            invitations: [],
            subTeams: [],
            teamAlerts: [],
            auditLogs: [],
            currentUserRole: "viewer",
            activeOrgName: "Default Organization",
            showInviteModal: false,
            showCreateSubTeamModal: false,
            showCreateAlertModal: false,
            showMatrixModal: false,
            inviteForm: { email: "", role: "engineer" },
            subTeamForm: { name: "", description: "", alertPolicy: "Default Escalation" },
            alertForm: { name: "", channelType: "Slack", subTeamId: null },
        };
    },
    computed: {
        canManageTeam() {
            return ["owner", "admin", "noc_manager"].includes(this.currentUserRole.toLowerCase());
        },
        activeMembersCount() {
            return this.members.filter((m) => m.status !== "suspended").length;
        },
    },
    mounted() {
        this.fetchData();
    },
    methods: {
        fetchData() {
            this.loading = true;
            const socket = this.$root.getSocket();

            socket.emit("getTeamMembers", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.members = res.members || [];
                    this.currentUserRole = res.userRole || "viewer";
                }
            });

            socket.emit("getPendingInvitations", (res) => {
                if (res && res.ok) {
                    this.invitations = res.invitations || [];
                }
            });

            socket.emit("getSubTeams", (res) => {
                if (res && res.ok) {
                    this.subTeams = res.subTeams || [];
                }
            });

            socket.emit("getTeamAlerts", (res) => {
                if (res && res.ok) {
                    this.teamAlerts = res.alerts || [];
                }
            });

            socket.emit("getOrganizationAuditLogs", (res) => {
                if (res && res.ok) {
                    this.auditLogs = res.logs || [];
                }
            });
        },
        submitInvite() {
            if (!this.inviteForm.email.trim()) {
                this.$root.toastError("Please enter an email address.");
                return;
            }
            this.$root.getSocket().emit("inviteTeamMember", this.inviteForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Invitation sent to ${this.inviteForm.email}`);
                    this.showInviteModal = false;
                    this.inviteForm.email = "";
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to invite member.");
                }
            });
        },
        submitCreateSubTeam() {
            if (!this.subTeamForm.name.trim()) {
                this.$root.toastError("Please enter a sub-team name.");
                return;
            }
            this.$root.getSocket().emit("createSubTeam", this.subTeamForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Created sub-team '${this.subTeamForm.name}'`);
                    this.showCreateSubTeamModal = false;
                    this.subTeamForm.name = "";
                    this.subTeamForm.description = "";
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to create sub-team.");
                }
            });
        },
        deleteSubTeam(subTeamId) {
            if (!confirm("Are you sure you want to delete this sub-team?")) {
                return;
            }
            this.$root.getSocket().emit("deleteSubTeam", subTeamId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Sub-team deleted.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to delete sub-team.");
                }
            });
        },
        submitCreateAlert() {
            if (!this.alertForm.name.trim()) {
                this.$root.toastError("Please enter a channel name.");
                return;
            }
            this.$root.getSocket().emit("createTeamAlert", this.alertForm, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Added alert channel '${this.alertForm.name}'`);
                    this.showCreateAlertModal = false;
                    this.alertForm.name = "";
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to create alert channel.");
                }
            });
        },
        deleteTeamAlert(alertId) {
            if (!confirm("Are you sure you want to delete this team alert channel?")) {
                return;
            }
            this.$root.getSocket().emit("deleteTeamAlert", alertId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Team alert channel deleted.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to delete team alert channel.");
                }
            });
        },
        changeRole(userId, newRole) {
            this.$root.getSocket().emit("updateTeamMemberRole", { userId, role: newRole }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Member role updated.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to update role.");
                }
            });
        },
        suspendMember(userId) {
            this.$root.getSocket().emit("suspendTeamMember", userId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Member suspended.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to suspend member.");
                }
            });
        },
        activateMember(userId) {
            this.$root.getSocket().emit("activateTeamMember", userId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Member activated.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to activate member.");
                }
            });
        },
        removeMember(userId) {
            if (!confirm("Are you sure you want to remove this member from the organization?")) {
                return;
            }
            this.$root.getSocket().emit("removeTeamMember", userId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Member removed.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to remove member.");
                }
            });
        },
        revokeInvitation(invitationId) {
            this.$root.getSocket().emit("revokeTeamInvitation", invitationId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Invitation revoked.");
                    this.fetchData();
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to revoke invitation.");
                }
            });
        },
        getRoleBadgeClass(role) {
            switch (String(role).toLowerCase()) {
                case "owner": return "bg-danger text-white";
                case "admin": return "bg-primary text-white";
                case "noc_manager": return "bg-warning text-dark";
                case "engineer": return "bg-info text-dark";
                case "technician": return "bg-secondary text-white";
                default: return "bg-light text-dark";
            }
        },
        formatRole(role) {
            return String(role || "viewer").toUpperCase();
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.btn-xs {
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
}
</style>
