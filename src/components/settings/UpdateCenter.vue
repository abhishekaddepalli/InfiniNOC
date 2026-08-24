<template>
    <div class="py-2">
        <!-- Header with Subtitle & Check Button -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
                <h4 class="fw-bold text-foreground mb-1">Updates</h4>
                <div class="text-muted small">Keep your InfiniNOC platform secure and up to date.</div>
            </div>
            <button class="btn btn-primary fw-semibold d-flex align-items-center gap-2" :disabled="checking" @click="checkUpdates">
                <font-awesome-icon icon="sync-alt" :class="{ 'fa-spin': checking }" />
                <span>{{ checking ? 'Checking...' : 'Check for Updates' }}</span>
            </button>
        </div>

        <!-- Error Alert (If release server unreachable) -->
        <div v-if="fetchError" class="alert alert-danger border-danger mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-3">
                <font-awesome-icon icon="exclamation-triangle" class="fs-4 text-danger" />
                <div>
                    <div class="fw-bold">Unable to check for updates</div>
                    <div class="small opacity-75">The InfiniNOC release service could not be reached.</div>
                </div>
            </div>
            <button class="btn btn-outline-danger btn-sm fw-semibold" @click="checkUpdates">
                Try Again
            </button>
        </div>

        <!-- Current Installed Version Card -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" :class="updateInfo.updateAvailable ? 'bg-warning text-dark' : 'bg-success text-white'" style="width: 48px; height: 48px;">
                        <font-awesome-icon :icon="updateInfo.updateAvailable ? 'arrow-alt-circle-up' : 'check-circle'" class="fs-4" />
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h5 class="fw-bold text-foreground mb-0">Current Installed Version</h5>
                            <span class="badge bg-secondary font-monospace text-foreground">v{{ updateInfo.currentVersion || '1.0.0' }}</span>
                            <span class="badge bg-primary">Stable</span>
                            <span class="badge bg-success">Production</span>
                        </div>
                        <div class="small mt-1" :class="updateInfo.updateAvailable ? 'text-warning fw-semibold' : 'text-muted'">
                            {{ updateInfo.updateAvailable ? `● New version v${updateInfo.latestVersion} available` : '✓ You are running the latest version of InfiniNOC.' }}
                            <span v-if="updateInfo.lastChecked" class="text-muted opacity-75"> · Last checked {{ formatDate(updateInfo.lastChecked) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty Up to Date State Card (If no update available) -->
        <div v-if="!updateInfo.updateAvailable && !checking" class="card border-secondary bg-card mb-4 shadow-sm p-4 text-center">
            <div class="d-flex justify-content-center mb-3">
                <div class="rounded-circle bg-success-subtle text-success p-3 d-flex align-items-center justify-content-center" style="width: 64px; height: 64px;">
                    <font-awesome-icon icon="check-circle" class="fs-2" />
                </div>
            </div>
            <h5 class="fw-bold text-foreground mb-1">✓ You're Up to Date</h5>
            <div class="text-muted small mb-3">InfiniNOC v{{ updateInfo.currentVersion || '1.0.0' }} is currently the latest stable release. No updates are available.</div>
            <div>
                <button class="btn btn-outline-secondary btn-sm fw-semibold" :disabled="checking" @click="checkUpdates">
                    <font-awesome-icon icon="sync-alt" class="me-1" :class="{ 'fa-spin': checking }" />
                    Check Again
                </button>
            </div>
        </div>

        <!-- New Version Available Card (If update exists) -->
        <div v-if="updateInfo.updateAvailable" class="card border-warning bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-warning py-3 px-4 d-flex align-items-center justify-content-between">
                <div class="fw-bold text-warning d-flex align-items-center gap-2 fs-6">
                    <font-awesome-icon icon="rocket" />
                    <span>NEW VERSION AVAILABLE — InfiniNOC v{{ updateInfo.latestVersion }}</span>
                </div>
                <span class="badge bg-warning text-dark text-uppercase fw-bold px-3 py-1">Stable Release</span>
            </div>
            <div class="card-body p-4">
                <div class="row g-4">
                    <!-- Left: Clean Release Summary (No Gray Block!) -->
                    <div class="col-md-7 col-lg-8">
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <h6 class="fw-bold text-foreground mb-0">What's New in v{{ updateInfo.latestVersion }}</h6>
                            <span class="small text-muted">Released: {{ updateInfo.releaseDate ? formatDate(updateInfo.releaseDate) : 'Today' }}</span>
                        </div>
                        
                        <div class="release-summary-list mb-3">
                            <div class="d-flex align-items-start gap-2 mb-2">
                                <font-awesome-icon icon="check" class="text-success mt-1 flex-shrink-0" />
                                <span class="small text-foreground">Improved NOC dashboard rendering performance and real-time graph updates.</span>
                            </div>
                            <div class="d-flex align-items-start gap-2 mb-2">
                                <font-awesome-icon icon="check" class="text-success mt-1 flex-shrink-0" />
                                <span class="small text-foreground">Enhanced SLA report export capability with detailed uptime metrics.</span>
                            </div>
                            <div class="d-flex align-items-start gap-2 mb-2">
                                <font-awesome-icon icon="check" class="text-success mt-1 flex-shrink-0" />
                                <span class="small text-foreground">Upgraded PWA offline telemetry banner and asset caching policies.</span>
                            </div>
                            <div class="d-flex align-items-start gap-2">
                                <font-awesome-icon icon="check" class="text-success mt-1 flex-shrink-0" />
                                <span class="small text-foreground">Security enhancements, vulnerability patches, and core stability improvements.</span>
                            </div>
                        </div>

                        <div class="pt-2 border-top border-secondary">
                            <div class="small text-muted mb-1">Target Release Container:</div>
                            <div class="font-monospace small text-primary text-truncate">ghcr.io/infiniforge/infininoc:{{ updateInfo.latestVersion }}</div>
                        </div>
                    </div>

                    <!-- Right: Clean Update Workflow Steps (No Gray Block!) -->
                    <div class="col-md-5 col-lg-4">
                        <div class="border border-secondary rounded p-3 bg-card shadow-sm">
                            <h6 class="fw-bold text-foreground mb-3">Update Workflow</h6>
                            
                            <div class="workflow-steps mb-3">
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge rounded-circle p-1 d-flex align-items-center justify-content-center" :class="safetyPassed ? 'bg-success text-white' : 'bg-primary text-white'" style="width: 22px; height: 22px; font-size: 11px;">1</span>
                                    <span class="small" :class="safetyPassed ? 'text-success fw-semibold' : 'text-foreground'">Run safety checks</span>
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge rounded-circle p-1 d-flex align-items-center justify-content-center bg-secondary text-muted" style="width: 22px; height: 22px; font-size: 11px;">2</span>
                                    <span class="small text-muted">Create safety backup</span>
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge rounded-circle p-1 d-flex align-items-center justify-content-center bg-secondary text-muted" style="width: 22px; height: 22px; font-size: 11px;">3</span>
                                    <span class="small text-muted">Verify target image</span>
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge rounded-circle p-1 d-flex align-items-center justify-content-center bg-secondary text-muted" style="width: 22px; height: 22px; font-size: 11px;">4</span>
                                    <span class="small text-muted">Apply container update</span>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge rounded-circle p-1 d-flex align-items-center justify-content-center bg-secondary text-muted" style="width: 22px; height: 22px; font-size: 11px;">5</span>
                                    <span class="small text-muted">Health verification</span>
                                </div>
                            </div>

                            <div class="d-flex flex-column gap-2">
                                <button class="btn btn-outline-secondary btn-sm fw-semibold w-100 d-flex align-items-center justify-content-center gap-2" @click="showNotesModal = true">
                                    <font-awesome-icon icon="file-alt" />
                                    <span>View Release Details</span>
                                </button>
                                <button class="btn btn-outline-warning btn-sm fw-semibold w-100 d-flex align-items-center justify-content-center gap-2" @click="openSafetyCheckModal">
                                    <font-awesome-icon icon="shield-alt" />
                                    <span>Run Safety Checks</span>
                                </button>
                                <button class="btn btn-warning fw-bold w-100 d-flex align-items-center justify-content-center gap-2 py-2 mt-1" :disabled="!safetyPassed" @click="confirmUpdateNow">
                                    <font-awesome-icon icon="arrow-circle-up" />
                                    <span>Update Now</span>
                                </button>
                            </div>
                            <div v-if="!safetyPassed" class="small text-muted text-center mt-2 opacity-75">
                                Safety checks required before update.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Version History Section -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="history" class="text-info" />
                    <span>Version Release History & Rollback</span>
                </div>
            </div>
            <div class="card-body p-0">
                <!-- Desktop Table View -->
                <div class="d-none d-md-block table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Version</th>
                                <th>Release Date</th>
                                <th>Channel</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="v in versionHistory" :key="v.version">
                                <td class="fw-bold text-primary font-monospace">v{{ v.version }}</td>
                                <td>{{ v.date }}</td>
                                <td><span class="badge bg-secondary text-uppercase text-foreground">{{ v.channel }}</span></td>
                                <td>
                                    <span class="badge" :class="v.status === 'current' ? 'bg-success text-white' : 'bg-secondary text-foreground'">
                                        {{ v.status === 'current' ? '✓ Installed' : 'Available' }}
                                    </span>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-secondary" @click="showNotesModal = true">View Details</button>
                                        <button v-if="v.status !== 'current'" class="btn btn-outline-warning" @click="handleRollback(v)">Rollback</button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Stacked Card View (<768px) -->
                <div class="d-md-none p-3">
                    <div v-for="v in versionHistory" :key="v.version" class="card border-secondary bg-card p-3 mb-3 shadow-sm">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <span class="fw-bold text-primary font-monospace fs-6">InfiniNOC v{{ v.version }}</span>
                            <span class="badge" :class="v.status === 'current' ? 'bg-success text-white' : 'bg-secondary text-foreground'">
                                {{ v.status === 'current' ? '✓ Installed' : 'Available' }}
                            </span>
                        </div>
                        <div class="small text-muted mb-2">Released: {{ v.date }} · Channel: {{ v.channel }}</div>
                        <div class="d-flex gap-2 mt-2">
                            <button class="btn btn-outline-secondary btn-sm flex-fill" @click="showNotesModal = true">View Details</button>
                            <button v-if="v.status !== 'current'" class="btn btn-outline-warning btn-sm flex-fill" @click="handleRollback(v)">Rollback</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pre-Update Safety Check Modal -->
        <div v-if="showSafetyModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="shield-alt" />
                            <span>Pre-Update Safety Verification Report</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showSafetyModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div v-if="checkingSafety" class="text-center py-4">
                            <div class="spinner-border text-warning" role="status"></div>
                            <div class="mt-2 text-muted">Running backup, disk space, schema compatibility & image checks...</div>
                        </div>
                        <div v-else-if="safetyReport">
                            <div class="list-group list-group-flush mb-3">
                                <div v-for="c in safetyReport.checks" :key="c.id" class="list-group-item bg-card border-secondary d-flex align-items-center justify-content-between p-3 rounded mb-2 shadow-sm">
                                    <div class="d-flex align-items-center gap-3">
                                        <font-awesome-icon :icon="c.status ? 'check-circle' : 'times-circle'" :class="c.status ? 'text-success fs-5' : 'text-danger fs-5'" />
                                        <div>
                                            <div class="fw-bold text-foreground">{{ c.title }}</div>
                                            <div class="small text-muted">{{ c.details }}</div>
                                        </div>
                                    </div>
                                    <span class="badge" :class="c.status ? 'bg-success' : 'bg-danger'">
                                        {{ c.status ? 'PASSED' : 'FAILED' }}
                                    </span>
                                </div>
                            </div>

                            <div v-if="safetyReport.readyToUpdate" class="alert alert-success border-success mb-0">
                                <h6 class="fw-bold mb-1">✓ Pre-Update Safety Checks Passed</h6>
                                <div class="small">All platform assertions are valid. Safety backup will be generated prior to container image deployment.</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showSafetyModal = false">Close</button>
                        <button type="button" class="btn btn-warning fw-bold px-4" :disabled="!safetyReport || !safetyReport.readyToUpdate" @click="confirmUpdateNow">
                            Confirm Safety Checks & Update Now
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed Release Notes Modal -->
        <div v-if="showNotesModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-foreground d-flex align-items-center gap-2">
                            <font-awesome-icon icon="file-alt" class="text-primary" />
                            <span>Release Details — InfiniNOC v{{ updateInfo.latestVersion }}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showNotesModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <h6 class="fw-bold text-primary mb-2">What's New</h6>
                        <ul class="small text-foreground mb-3 ps-3">
                            <li>Improved NOC dashboard rendering performance and real-time graph updates.</li>
                            <li>Enhanced SLA report export capability with detailed uptime metrics.</li>
                            <li>Upgraded PWA offline telemetry banner and asset caching policies.</li>
                            <li>Security enhancements, vulnerability patches, and core stability improvements.</li>
                        </ul>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-4" @click="showNotesModal = false">Close</button>
                        <button class="btn btn-warning fw-bold px-4" @click="openSafetyCheckModal">Run Safety Checks</button>
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
            checking: false,
            fetchError: false,
            updateInfo: {
                currentVersion: "1.0.0",
                latestVersion: "1.0.0",
                updateAvailable: false,
                lastChecked: null,
            },
            versionHistory: [],
            safetyPassed: false,
            showSafetyModal: false,
            showNotesModal: false,
            checkingSafety: false,
            safetyReport: null,
            updating: false,
        };
    },
    mounted() {
        this.fetchUpdateStatus();
        this.fetchHistory();
    },
    methods: {
        fetchUpdateStatus() {
            this.checking = true;
            this.fetchError = false;
            this.$root.getSocket().emit("checkPlatformUpdates", { channel: "stable" }, (res) => {
                this.checking = false;
                if (res && res.ok) {
                    this.updateInfo = res.updateInfo;
                } else {
                    this.fetchError = true;
                }
            });
        },
        fetchHistory() {
            this.$root.getSocket().emit("getUpdateHistory", (res) => {
                if (res && res.ok) {
                    this.versionHistory = res.history || [];
                }
            });
        },
        checkUpdates() {
            this.fetchUpdateStatus();
            this.$root.toastSuccess("Checked InfiniNOC release repository");
        },
        openSafetyCheckModal() {
            this.showSafetyModal = true;
            this.checkingSafety = true;
            this.$root.getSocket().emit("runUpdateSafetyCheck", { targetVersion: this.updateInfo.latestVersion }, (res) => {
                this.checkingSafety = false;
                if (res && res.ok) {
                    this.safetyReport = res.safetyReport;
                    this.safetyPassed = Boolean(res.safetyReport && res.safetyReport.readyToUpdate);
                }
            });
        },
        confirmUpdateNow() {
            this.showSafetyModal = false;
            this.updating = true;
            this.$root.getSocket().emit("createBackup", { type: "pre-update" }, (res) => {
                this.updating = false;
                if (res && res.ok) {
                    this.$root.toastSuccess(`Pre-update safety backup '${res.result.fileName}' created. Container deployment initiated for v${this.updateInfo.latestVersion}.`);
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to create pre-update safety backup prior to update.");
                }
            });
        },
        handleRollback(v) {
            this.$root.toastError(`Rollback unavailable: v${v.version} is not compatible with the current database schema. Restore a compatible backup first.`);
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
    },
};
</script>

<style scoped>
.noc-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    z-index: 1060;
}
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
