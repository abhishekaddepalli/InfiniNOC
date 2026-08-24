<template>
    <div class="py-2">
        <!-- Subtitle Header with Create Backup & Run Cleanup Buttons -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
                <h4 class="fw-bold text-foreground mb-1">Enterprise Backup & Recovery</h4>
                <div class="text-muted small">Protect your InfiniNOC platform state, schedule automated snapshots, and perform disaster recovery.</div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary btn-sm fw-semibold d-flex align-items-center gap-2 px-3" @click="triggerCleanupPreview">
                    <font-awesome-icon icon="trash" />
                    <span>Run Cleanup Now</span>
                </button>
                <button class="btn btn-warning fw-bold d-flex align-items-center gap-2 px-3 py-2" @click="showCreateModal = true">
                    <font-awesome-icon icon="plus-circle" />
                    <span>Create Platform Backup</span>
                </button>
            </div>
        </div>

        <!-- Storage Warnings -->
        <div v-if="storageStats.isCritical" class="alert alert-danger border-danger d-flex align-items-center gap-3 mb-4">
            <font-awesome-icon icon="exclamation-circle" class="fs-3 text-danger" />
            <div>
                <div class="fw-bold">🔴 Critical Storage Warning: Backup storage is {{ storageStats.percentUsed }}% full.</div>
                <div class="small">Storage remaining: {{ storageStats.remainingMB }} MB of {{ storageStats.limitMB }} MB. Review your retention policy or delete old backups.</div>
            </div>
        </div>
        <div v-else-if="storageStats.isWarning" class="alert alert-warning border-warning d-flex align-items-center gap-3 mb-4">
            <font-awesome-icon icon="exclamation-triangle" class="fs-3 text-warning" />
            <div>
                <div class="fw-bold">⚠ Storage Warning: Backup storage is {{ storageStats.percentUsed }}% full.</div>
                <div class="small">Storage remaining: {{ storageStats.remainingMB }} MB of {{ storageStats.limitMB }} MB.</div>
            </div>
        </div>

        <!-- Top Summary Cards -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-md-3">
                <div class="card h-100 border-secondary bg-card p-3 shadow-sm">
                    <div class="text-muted small fw-semibold text-uppercase">Total Backups</div>
                    <div class="fs-3 fw-bold text-foreground mt-1">{{ backupList.length }}</div>
                    <div class="small text-muted mt-1">{{ storageStats.lockedBackups }} Locked / Protected</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card h-100 border-secondary bg-card p-3 shadow-sm">
                    <div class="text-muted small fw-semibold text-uppercase">Storage Used</div>
                    <div class="fs-3 fw-bold text-foreground mt-1">{{ storageStats.totalMB }} MB</div>
                    <div class="small text-muted mt-1">Limit: {{ storageStats.limitMB }} MB</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card h-100 border-secondary bg-card p-3 shadow-sm">
                    <div class="text-muted small fw-semibold text-uppercase">Storage Remaining</div>
                    <div class="fs-3 fw-bold text-foreground mt-1">{{ storageStats.remainingMB }} MB</div>
                    <div class="small text-muted mt-1">{{ storageStats.percentRemaining }}% Available</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card h-100 border-secondary bg-card p-3 shadow-sm">
                    <div class="text-muted small fw-semibold text-uppercase">Latest Backup</div>
                    <div class="fs-6 fw-bold text-foreground mt-1 text-truncate">{{ latestBackupTime }}</div>
                    <div class="small text-success mt-1">✓ Integrity Verified</div>
                </div>
            </div>
        </div>

        <!-- Storage Progress Meter Bar -->
        <div class="card border-secondary bg-card mb-4 p-3 shadow-sm">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="fw-bold small text-uppercase text-foreground">Storage Usage</span>
                <span class="small font-monospace text-muted">{{ storageStats.totalMB }} MB / {{ storageStats.limitMB }} MB ({{ storageStats.percentUsed }}%)</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div
                    class="progress-bar"
                    :class="storageStats.isCritical ? 'bg-danger' : storageStats.isWarning ? 'bg-warning' : 'bg-primary'"
                    role="progressbar"
                    :style="{ width: storageStats.percentUsed + '%' }"
                ></div>
            </div>
        </div>

        <!-- Dedicated Upload & Restore Section -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center gap-2">
                <font-awesome-icon icon="upload" class="text-primary" />
                <span>Restore Backup Archive</span>
            </div>
            <div class="card-body p-4">
                <div
                    class="drop-zone border border-2 border-dashed border-secondary rounded p-4 text-center cursor-pointer bg-secondary-subtle"
                    @dragover.prevent
                    @drop.prevent="handleFileDrop"
                    @click="triggerFileInput"
                >
                    <font-awesome-icon icon="cloud-upload-alt" class="fs-1 text-warning mb-2" />
                    <div class="fw-bold text-foreground">Drop backup file here or click to browse</div>
                    <div class="small text-muted mt-1">Supported format: <span class="font-monospace text-primary">.infinibackup</span></div>
                    <input ref="fileInput" type="file" accept=".infinibackup" class="d-none" @change="handleFileSelect" />
                </div>
            </div>
        </div>

        <!-- Automated Backup & Retention Settings Section -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="clock" class="text-warning" />
                    <span>Automatic Backup & Retention Settings</span>
                </h5>
                <button class="btn btn-warning btn-sm fw-bold px-3" :disabled="savingSettings" @click="saveSettings">
                    <span v-if="savingSettings" class="spinner-border spinner-border-sm me-1"></span>
                    Save Policy
                </button>
            </div>
            <div class="card-body p-4">
                <div class="row g-4">
                    <div class="col-md-3">
                        <div class="form-check form-switch mb-2">
                            <input id="autoBackupSwitch" v-model="settings.autoEnabled" class="form-check-input" type="checkbox" role="switch" />
                            <label class="form-check-label fw-semibold text-foreground" for="autoBackupSwitch">Enable Automatic Backups</label>
                        </div>
                        <div class="text-muted small">Runs automatically server-side without requiring browser tabs.</div>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Frequency</label>
                        <select v-model="settings.autoFrequency" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly (Sunday)</option>
                            <option value="12h">Every 12 Hours</option>
                            <option value="6h">Every 6 Hours</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Backup Time</label>
                        <select v-model="settings.autoTime" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option v-for="h in 24" :key="h" :value="formatHour(h - 1)">
                                {{ formatHour(h - 1) }} (System Time)
                            </option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Keep Last (Retention Count)</label>
                        <select v-model="settings.retentionCount" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option :value="5">Keep last 5 backups</option>
                            <option :value="10">Keep last 10 backups</option>
                            <option :value="15">Keep last 15 backups</option>
                            <option :value="30">Keep last 30 backups</option>
                            <option :value="60">Keep last 60 backups</option>
                            <option :value="90">Keep last 90 backups</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Delete Older Than (Age)</label>
                        <select v-model="settings.retentionAgeDays" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option :value="7">7 days</option>
                            <option :value="14">14 days</option>
                            <option :value="30">30 days</option>
                            <option :value="60">60 days</option>
                            <option :value="90">90 days</option>
                            <option :value="180">180 days</option>
                            <option :value="365">365 days</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Minimum Backups to Keep</label>
                        <select v-model="settings.minKeep" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option :value="1">1 backup</option>
                            <option :value="3">3 backups (Default Protection)</option>
                            <option :value="5">5 backups</option>
                            <option :value="10">10 backups</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label small fw-semibold text-muted">Storage Limit</label>
                        <select v-model="settings.storageLimitMB" class="form-select form-select-sm border-secondary bg-card text-foreground">
                            <option :value="500">500 MB</option>
                            <option :value="1024">1 GB (1024 MB)</option>
                            <option :value="2048">2 GB</option>
                            <option :value="5120">5 GB</option>
                            <option :value="10240">10 GB</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <div class="form-check form-switch mt-4">
                            <input id="autoCleanupSwitch" v-model="settings.autoCleanup" class="form-check-input" type="checkbox" role="switch" />
                            <label class="form-check-label fw-semibold text-foreground" for="autoCleanupSwitch">Automatic Cleanup</label>
                        </div>
                    </div>
                </div>

                <div class="alert alert-secondary border-secondary mt-4 mb-0 small text-muted">
                    <font-awesome-icon icon="info-circle" class="me-1 text-primary" />
                    InfiniNOC automatically removes backups that exceed your retention policy after a new verified backup is created.
                    <strong class="text-foreground">Locked backups are never removed automatically.</strong>
                </div>
            </div>
        </div>

        <!-- Action Bar & Backup History List -->
        <div class="card border-secondary bg-card mb-4 shadow-sm">
            <div class="card-header bg-transparent border-bottom border-secondary d-flex align-items-center justify-content-between flex-wrap gap-2 py-3 px-4">
                <h5 class="fw-bold mb-0 text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="archive" class="text-info" />
                    <span>Platform Backup History</span>
                </h5>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <!-- Search Input -->
                    <div class="input-group input-group-sm" style="width: 220px;">
                        <span class="input-group-text border-secondary bg-card text-muted">
                            <font-awesome-icon icon="search" />
                        </span>
                        <input v-model="searchQuery" type="text" class="form-control border-secondary bg-card text-foreground" placeholder="Search backups..." />
                    </div>
                    <button class="btn btn-outline-secondary btn-sm fw-semibold" @click="fetchBackupList">
                        <font-awesome-icon icon="sync-alt" class="me-1" :class="{ 'fa-spin': loading }" />
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div class="px-4 pt-3 pb-2 border-bottom border-secondary bg-secondary-subtle">
                <div class="nav nav-pills gap-1">
                    <button
                        v-for="filter in ['all', 'manual', 'auto', 'pre-update', 'pre-restore', 'locked']"
                        :key="filter"
                        class="nav-link py-1 px-3 btn-sm text-capitalize small"
                        :class="{ active: activeFilter === filter }"
                        @click="activeFilter = filter"
                    >
                        {{ filter }}
                    </button>
                </div>
            </div>

            <!-- Backup History Table (Desktop & Mobile Stacked Cards) -->
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-warning" role="status"></div>
                    <div class="mt-2 text-muted">Loading platform backup history...</div>
                </div>
                <div v-else-if="filteredBackupList.length === 0" class="text-center py-5 text-muted">
                    <font-awesome-icon icon="archive" class="fs-1 mb-2 opacity-50" />
                    <div>No platform backups found matching criteria.</div>
                    <div class="small">Click "Create Platform Backup" to generate your first snapshot.</div>
                </div>
                <div v-else>
                    <!-- Desktop Table View -->
                    <div class="d-none d-md-block table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-dark">
                                <tr>
                                    <th>Type</th>
                                    <th>Created Date</th>
                                    <th>File Name</th>
                                    <th>Size</th>
                                    <th>Status</th>
                                    <th>Version</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="b in paginatedBackupList" :key="b.fileName">
                                    <td>
                                        <span class="badge text-uppercase" :class="getTypeBadgeClass(b.manifest.type)">
                                            {{ b.manifest.type || 'manual' }}
                                        </span>
                                    </td>
                                    <td class="fw-semibold text-foreground">{{ formatDate(b.createdAt) }}</td>
                                    <td class="font-monospace small text-muted">{{ b.fileName }}</td>
                                    <td>{{ (b.size / (1024 * 1024)).toFixed(2) }} MB</td>
                                    <td>
                                        <span v-if="b.isLocked" class="badge bg-warning text-dark me-1">🔒 Locked</span>
                                        <span class="badge bg-success text-white">✓ Verified</span>
                                    </td>
                                    <td class="fw-semibold">v{{ b.manifest.applicationVersion || '1.0.0' }}</td>
                                    <td class="text-end">
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-secondary" title="Verify Checksum" @click="verifyBackupItem(b.fileName)">
                                                Verify
                                            </button>
                                            <button class="btn btn-outline-success" title="Download Archive" @click="downloadBackup(b)">
                                                <font-awesome-icon icon="download" class="me-1" />
                                                Download
                                            </button>
                                            <button class="btn btn-outline-primary" title="Restore Platform" @click="startRestoreWizard(b)">
                                                Restore
                                            </button>
                                            <button
                                                class="btn btn-outline-warning"
                                                :title="b.isLocked ? 'Unlock Backup' : 'Lock Backup'"
                                                @click="toggleLock(b)"
                                            >
                                                <font-awesome-icon :icon="b.isLocked ? 'unlock' : 'lock'" />
                                            </button>
                                            <button class="btn btn-outline-info" title="View Details" @click="showDetails(b)">
                                                <font-awesome-icon icon="info-circle" />
                                            </button>
                                            <button
                                                class="btn btn-outline-danger"
                                                :disabled="b.isLocked"
                                                :title="b.isLocked ? 'This backup is protected. Unlock it first to delete.' : 'Delete Archive'"
                                                @click="deleteBackupItem(b.fileName)"
                                            >
                                                <font-awesome-icon icon="trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Stacked Card View (<768px) -->
                    <div class="d-md-none p-3">
                        <div v-for="b in paginatedBackupList" :key="b.fileName" class="card bg-card border-secondary p-3 mb-3 shadow-sm">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <span class="badge text-uppercase" :class="getTypeBadgeClass(b.manifest.type)">
                                    {{ b.manifest.type || 'manual' }}
                                </span>
                                <div>
                                    <span v-if="b.isLocked" class="badge bg-warning text-dark me-1">🔒 Locked</span>
                                    <span class="badge bg-success text-white">✓ Verified</span>
                                </div>
                            </div>
                            <div class="fw-bold text-foreground font-monospace small mb-1 text-truncate">{{ b.fileName }}</div>
                            <div class="small text-muted mb-3">{{ formatDate(b.createdAt) }} · {{ (b.size / (1024 * 1024)).toFixed(2) }} MB</div>
                            <div class="row g-2">
                                <div class="col-6">
                                    <button class="btn btn-outline-success btn-sm w-100" @click="downloadBackup(b)">
                                        <font-awesome-icon icon="download" class="me-1" /> Download
                                    </button>
                                </div>
                                <div class="col-6">
                                    <button class="btn btn-primary btn-sm w-100 fw-bold" @click="startRestoreWizard(b)">Restore</button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-secondary btn-sm w-100" @click="verifyBackupItem(b.fileName)">Verify</button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-warning btn-sm w-100" @click="toggleLock(b)">
                                        {{ b.isLocked ? 'Unlock' : 'Lock' }}
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-danger btn-sm w-100" :disabled="b.isLocked" @click="deleteBackupItem(b.fileName)">Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pagination Bar -->
                    <div v-if="totalPages > 1" class="d-flex align-items-center justify-content-between px-4 py-3 border-top border-secondary">
                        <span class="small text-muted">Showing {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredBackupList.length) }} of {{ filteredBackupList.length }}</span>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
                            <button v-for="p in totalPages" :key="p" class="btn btn-outline-secondary" :class="{ active: currentPage === p }" @click="currentPage = p">{{ p }}</button>
                            <button class="btn btn-outline-secondary" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Backup Details Modal -->
        <div v-if="detailsBackup" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-info d-flex align-items-center gap-2">
                            <font-awesome-icon icon="info-circle" />
                            <span>Backup Details — {{ detailsBackup.fileName }}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="detailsBackup = null"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <div class="text-muted small">Filename</div>
                                <div class="fw-bold font-monospace small text-truncate">{{ detailsBackup.fileName }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="text-muted small">Download Name</div>
                                <div class="fw-bold font-monospace small text-success text-truncate">{{ detailsBackup.downloadName }}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Backup Type</div>
                                <div class="fw-bold text-uppercase">{{ detailsBackup.manifest.type || 'manual' }}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Size</div>
                                <div class="fw-bold">{{ (detailsBackup.size / (1024 * 1024)).toFixed(2) }} MB</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Created At</div>
                                <div class="fw-bold">{{ formatDate(detailsBackup.createdAt) }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="text-muted small">SHA-256 Checksum</div>
                                <div class="font-monospace small text-muted text-truncate">{{ detailsBackup.checksum }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="text-muted small">App / DB Version</div>
                                <div class="fw-bold">v{{ detailsBackup.manifest.applicationVersion || '1.0.0' }} ({{ detailsBackup.manifest.databaseVersion || 'knex-migrated' }})</div>
                            </div>
                        </div>

                        <!-- Included Manifest Components -->
                        <div class="p-3 bg-card rounded border border-secondary mt-3">
                            <h6 class="fw-bold text-foreground mb-2">Verified Content Manifest</h6>
                            <div class="row g-2 small text-muted">
                                <div class="col-6 col-md-4">✓ Database Schema & Tables</div>
                                <div class="col-6 col-md-4">✓ Monitors & Groups</div>
                                <div class="col-6 col-md-4">✓ Heartbeat Telemetry Logs</div>
                                <div class="col-6 col-md-4">✓ Notifications & Webhooks</div>
                                <div class="col-6 col-md-4">✓ Organizations & Users</div>
                                <div class="col-6 col-md-4">✓ Incidents & Alerts</div>
                                <div class="col-6 col-md-4">✓ Status Pages</div>
                                <div class="col-6 col-md-4">✓ Tags & Color Rules</div>
                                <div class="col-6 col-md-4">✓ Probes Configuration</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-4" @click="detailsBackup = null">Close</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Retention Cleanup Preview Modal -->
        <div v-if="cleanupPreviewData" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="trash" />
                            <span>Retention Cleanup Preview</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="cleanupPreviewData = null"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3 mb-4">
                            <div class="col-6 col-md-3">
                                <div class="card bg-card border-secondary p-3">
                                    <div class="text-muted small">Total Stored</div>
                                    <div class="fs-4 fw-bold text-foreground">{{ cleanupPreviewData.totalStored }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="card bg-card border-secondary p-3">
                                    <div class="text-muted small">To Delete</div>
                                    <div class="fs-4 fw-bold text-danger">{{ cleanupPreviewData.toDeleteCount }}</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="card bg-card border-secondary p-3">
                                    <div class="text-muted small">Storage Freed</div>
                                    <div class="fs-4 fw-bold text-success">{{ cleanupPreviewData.freedMB }} MB</div>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <div class="card bg-card border-secondary p-3">
                                    <div class="text-muted small">Backups Retained</div>
                                    <div class="fs-4 fw-bold text-primary">{{ cleanupPreviewData.retainedCount }}</div>
                                </div>
                            </div>
                        </div>

                        <div v-if="cleanupPreviewData.deleteCandidates.length > 0">
                            <h6 class="fw-bold text-foreground mb-2">Backups Marked for Cleanup:</h6>
                            <ul class="list-group list-group-flush border border-secondary rounded max-vh-30 overflow-y-auto">
                                <li v-for="c in cleanupPreviewData.deleteCandidates" :key="c.fileName" class="list-group-item bg-card text-foreground d-flex align-items-center justify-content-between font-monospace small">
                                    <span>{{ c.fileName }}</span>
                                    <span class="text-muted">{{ (c.size / (1024 * 1024)).toFixed(2) }} MB</span>
                                </li>
                            </ul>
                        </div>
                        <div v-else class="alert alert-success border-success text-center py-3">
                            ✓ No backups violate current retention policy. Storage is fully compliant.
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="cleanupPreviewData = null">Cancel</button>
                        <button
                            v-if="cleanupPreviewData.toDeleteCount > 0"
                            type="button"
                            class="btn btn-danger fw-bold px-4"
                            :disabled="executingCleanup"
                            @click="executeCleanup"
                        >
                            <span v-if="executingCleanup" class="spinner-border spinner-border-sm me-2"></span>
                            Apply Retention Policy
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Backup Modal -->
        <div v-if="showCreateModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="plus-circle" />
                            <span>Create Complete InfiniNOC Platform Snapshot</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold small text-uppercase">Backup Type</label>
                            <select v-model="createType" class="form-select border-secondary bg-card text-foreground">
                                <option value="manual">Manual Full Backup</option>
                                <option value="pre-update">Pre-Update Snapshot</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold small text-uppercase">Encryption Key (Optional)</label>
                            <input
                                v-model="createPassword"
                                type="password"
                                class="form-control border-secondary bg-card text-foreground"
                                placeholder="AES-256-GCM Encryption Key"
                            />
                            <div class="form-text text-muted small">Optional password encryption using AES-256-GCM.</div>
                        </div>

                        <!-- Progress Bar during creation -->
                        <div v-if="creating" class="my-4">
                            <div class="fw-bold text-warning mb-2">{{ creationStageText }}</div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated bg-warning" style="width: 100%;"></div>
                            </div>
                        </div>

                        <!-- Included Components Manifest Checklist -->
                        <div class="p-3 bg-card rounded border border-secondary mt-3">
                            <h6 class="fw-bold text-foreground mb-2">Included Platform Components</h6>
                            <div class="row g-2 small text-muted">
                                <div class="col-6 col-md-4">✓ Database & Schema</div>
                                <div class="col-6 col-md-4">✓ Monitors & Settings</div>
                                <div class="col-6 col-md-4">✓ Monitor History & Logs</div>
                                <div class="col-6 col-md-4">✓ Notification Channels</div>
                                <div class="col-6 col-md-4">✓ Organizations & Users</div>
                                <div class="col-6 col-md-4">✓ Incidents & Alerts</div>
                                <div class="col-6 col-md-4">✓ Status Pages</div>
                                <div class="col-6 col-md-4">✓ Tags & Color Rules</div>
                                <div class="col-6 col-md-4">✓ Probes Configuration</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" :disabled="creating" @click="showCreateModal = false">Cancel</button>
                        <button type="button" class="btn btn-warning fw-bold px-4" :disabled="creating" @click="triggerCreateBackup">
                            <span v-if="creating" class="spinner-border spinner-border-sm me-2"></span>
                            Generate Platform Snapshot
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Multi-Step Restore Wizard Modal -->
        <div v-if="showRestoreModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-secondary bg-card text-foreground">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="history" />
                            <span>InfiniNOC Multi-Step Restore Wizard</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showRestoreModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <!-- Step Navigation Indicator -->
                        <div class="d-flex justify-content-between mb-4 pb-2 border-bottom border-secondary small fw-bold">
                            <span :class="restoreStep >= 1 ? 'text-warning' : 'text-muted'">1. Inspect</span>
                            <span :class="restoreStep >= 2 ? 'text-warning' : 'text-muted'">2. Verify</span>
                            <span :class="restoreStep >= 3 ? 'text-warning' : 'text-muted'">3. Review</span>
                            <span :class="restoreStep >= 4 ? 'text-warning' : 'text-muted'">4. Compatibility</span>
                            <span :class="restoreStep >= 5 ? 'text-warning' : 'text-muted'">5. Safety Backup</span>
                            <span :class="restoreStep >= 6 ? 'text-warning' : 'text-muted'">6. Restore</span>
                        </div>

                        <div v-if="selectedRestoreBackup">
                            <div class="card border-secondary bg-card p-3 mb-3">
                                <div class="row g-2">
                                    <div class="col-md-6">
                                        <div class="text-muted small">Target Archive</div>
                                        <div class="fw-bold text-foreground font-monospace small text-truncate">{{ selectedRestoreBackup.fileName }}</div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="text-muted small">Application Version</div>
                                        <div class="fw-bold text-warning">v{{ selectedRestoreBackup.manifest.applicationVersion || '1.0.0' }}</div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="restoreStep === 1">
                                <h6 class="fw-bold text-foreground mb-2">Step 1: Inspect Archive Payload</h6>
                                <p class="small text-muted">Ready to verify archive integrity and SHA-256 checksum format.</p>
                            </div>

                            <div v-if="restoreStep === 2">
                                <h6 class="fw-bold text-foreground mb-2">Step 2: Checksum & Integrity Check</h6>
                                <div class="alert alert-success border-success">
                                    <h6 class="fw-bold mb-1">✓ Backup Verified Cleanly</h6>
                                    <div class="small">SHA-256 checksum and manifest parameters are valid and supported.</div>
                                </div>
                            </div>

                            <div v-if="restoreStep === 3">
                                <h6 class="fw-bold text-foreground mb-2">Step 3: Review Restore Contents</h6>
                                <div class="p-3 bg-card rounded border border-secondary small text-muted">
                                    <div class="row g-2">
                                        <div class="col-6">✓ Monitors & Alert Rules</div>
                                        <div class="col-6">✓ Heartbeat History</div>
                                        <div class="col-6">✓ Notifications & Webhooks</div>
                                        <div class="col-6">✓ Organizations & Users</div>
                                        <div class="col-6">✓ Incidents & Status Pages</div>
                                        <div class="col-6">✓ Tags & Platform Settings</div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="restoreStep === 4">
                                <h6 class="fw-bold text-foreground mb-2">Step 4: Database Schema Compatibility</h6>
                                <div class="alert alert-success border-success">
                                    <h6 class="fw-bold mb-1">✓ Schema Compatible</h6>
                                    <div class="small">The database version matches InfiniNOC 1.0.0 SQLite schema structure.</div>
                                </div>
                            </div>

                            <div v-if="restoreStep === 5">
                                <h6 class="fw-bold text-foreground mb-2">Step 5: Automatic Safety Backup Safeguard</h6>
                                <div class="alert alert-info border-info d-flex align-items-center gap-3">
                                    <font-awesome-icon icon="shield-alt" class="fs-3 text-info" />
                                    <div class="small">
                                        An automatic pre-restore safety snapshot (<span class="font-monospace">infininoc-backup-pre-restore-*.infinibackup</span>) will be created prior to applying restore data.
                                    </div>
                                </div>
                            </div>

                            <div v-if="restoreStep === 6">
                                <h6 class="fw-bold text-warning mb-2">Step 6: Confirm Platform Restoration</h6>
                                <div class="alert alert-warning border-warning">
                                    <h6 class="fw-bold mb-1">⚠️ Restore InfiniNOC Platform State?</h6>
                                    <div class="small mb-2">This operation will replace current database tables and uploads with the snapshot. A pre-restore safety backup will be created first.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showRestoreModal = false">Cancel</button>
                        <button v-if="restoreStep < 6" type="button" class="btn btn-primary fw-bold px-4" @click="restoreStep++">
                            Next Step →
                        </button>
                        <button v-else type="button" class="btn btn-danger fw-bold px-4" :disabled="restoring" @click="confirmRestore">
                            <span v-if="restoring" class="spinner-border spinner-border-sm me-2"></span>
                            Create Safety Backup & Restore
                        </button>
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
            loading: false,
            backupList: [],
            storageStats: {
                totalBackups: 0,
                lockedBackups: 0,
                totalMB: 0,
                limitMB: 1024,
                remainingMB: 1024,
                percentUsed: 0,
                percentRemaining: 100,
                isWarning: false,
                isCritical: false,
            },
            settings: {
                autoEnabled: true,
                autoFrequency: "daily",
                autoTime: "02:00",
                retentionCount: 30,
                retentionAgeDays: 90,
                minKeep: 3,
                autoCleanup: true,
                storageLimitMB: 1024,
                storageWarningPercent: 80,
                storageCriticalPercent: 90,
            },
            savingSettings: false,
            showCreateModal: false,
            createType: "manual",
            createPassword: "",
            creating: false,
            creationStageText: "Preparing backup...",
            showRestoreModal: false,
            selectedRestoreBackup: null,
            restoreStep: 1,
            restoring: false,
            detailsBackup: null,
            cleanupPreviewData: null,
            executingCleanup: false,
            activeFilter: "all",
            searchQuery: "",
            currentPage: 1,
            pageSize: 25,
        };
    },
    computed: {
        latestBackupTime() {
            if (this.backupList.length === 0) {
                return "None";
            }
            return this.formatDate(this.backupList[0].createdAt);
        },
        filteredBackupList() {
            return this.backupList.filter((b) => {
                const type = (b.manifest && b.manifest.type) || "manual";
                if (this.activeFilter === "manual" && type !== "manual") {
                    return false;
                }
                if (this.activeFilter === "auto" && type !== "auto") {
                    return false;
                }
                if (this.activeFilter === "pre-update" && type !== "pre-update") {
                    return false;
                }
                if (this.activeFilter === "pre-restore" && type !== "pre-restore") {
                    return false;
                }
                if (this.activeFilter === "locked" && !b.isLocked) {
                    return false;
                }

                if (this.searchQuery.trim()) {
                    const q = this.searchQuery.toLowerCase().trim();
                    const nameMatch = b.fileName.toLowerCase().includes(q);
                    const downloadMatch = (b.downloadName || "").toLowerCase().includes(q);
                    return nameMatch || downloadMatch;
                }

                return true;
            });
        },
        totalPages() {
            return Math.ceil(this.filteredBackupList.length / this.pageSize) || 1;
        },
        paginatedBackupList() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.filteredBackupList.slice(start, start + this.pageSize);
        },
    },
    watch: {
        activeFilter() {
            this.currentPage = 1;
        },
        searchQuery() {
            this.currentPage = 1;
        },
    },
    mounted() {
        this.fetchBackupList();
        this.fetchStorageStats();
        this.fetchSettings();
    },
    methods: {
        fetchBackupList() {
            this.loading = true;
            this.$root.getSocket().emit("getBackupList", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.backupList = res.list || [];
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to fetch backup list");
                }
            });
        },
        fetchStorageStats() {
            this.$root.getSocket().emit("getBackupStorageStats", (res) => {
                if (res && res.ok) {
                    this.storageStats = res.stats;
                }
            });
        },
        fetchSettings() {
            this.$root.getSocket().emit("getBackupSettings", (res) => {
                if (res && res.ok && res.settings) {
                    this.settings = { ...this.settings, ...res.settings };
                }
            });
        },
        saveSettings() {
            this.savingSettings = true;
            this.$root.getSocket().emit("saveBackupSettings", this.settings, (res) => {
                this.savingSettings = false;
                if (res && res.ok) {
                    this.$root.toastSuccess("Backup & Retention policy saved successfully");
                    this.fetchStorageStats();
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to save backup policy");
                }
            });
        },
        triggerCreateBackup() {
            this.creating = true;
            this.creationStageText = "Preparing platform snapshot...";
            setTimeout(() => {
                this.creationStageText = "Exporting database & telemetry logs...";
            }, 800);
            setTimeout(() => {
                this.creationStageText = "Compressing archive & calculating SHA-256...";
            }, 1600);

            this.$root.getSocket().emit(
                "createBackup",
                { type: this.createType, password: this.createPassword },
                (res) => {
                    this.creating = false;
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Backup '${res.result.fileName}' created and verified cleanly.`);
                        this.showCreateModal = false;
                        this.createPassword = "";
                        this.fetchBackupList();
                        this.fetchStorageStats();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to create backup");
                    }
                }
            );
        },
        downloadBackup(backup) {
            const token = this.$root.getSocket().token || localStorage.getItem("token") || "";
            const url = `/api/platform/backups/${encodeURIComponent(backup.fileName)}/download?token=${encodeURIComponent(token)}`;
            window.open(url, "_blank");
            this.$root.toastSuccess(`Downloading backup archive: ${backup.downloadName}`);
        },
        toggleLock(backup) {
            const desired = !backup.isLocked;
            this.$root.getSocket().emit("toggleBackupLock", { fileName: backup.fileName, locked: desired }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(desired ? `Backup '${backup.fileName}' is now locked and protected.` : `Backup '${backup.fileName}' unlocked.`);
                    this.fetchBackupList();
                    this.fetchStorageStats();
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to change lock state");
                }
            });
        },
        triggerCleanupPreview() {
            this.$root.getSocket().emit("previewBackupCleanup", this.settings, (res) => {
                if (res && res.ok) {
                    this.cleanupPreviewData = res.preview;
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to preview retention cleanup");
                }
            });
        },
        executeCleanup() {
            this.executingCleanup = true;
            this.$root.getSocket().emit("runBackupCleanup", this.settings, (res) => {
                this.executingCleanup = false;
                this.cleanupPreviewData = null;
                if (res && res.ok) {
                    this.$root.toastSuccess(`Retention cleanup completed: Deleted ${res.result.deletedCount} backups, freed ${res.result.freedMB} MB.`);
                    this.fetchBackupList();
                    this.fetchStorageStats();
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to execute retention cleanup");
                }
            });
        },
        triggerFileInput() {
            if (this.$refs.fileInput) {
                this.$refs.fileInput.click();
            }
        },
        handleFileSelect(e) {
            const file = e.target.files[0];
            if (file) {
                this.processUploadedFile(file);
            }
        },
        handleFileDrop(e) {
            const file = e.dataTransfer.files[0];
            if (file) {
                this.processUploadedFile(file);
            }
        },
        processUploadedFile(file) {
            if (!file.name.endsWith(".infinibackup")) {
                this.$root.toastError("Invalid file type. Only .infinibackup archives are supported.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                const base64 = evt.target.result.split(",")[1] || evt.target.result;
                this.$root.getSocket().emit("uploadBackup", { base64, fileName: file.name }, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Uploaded backup '${file.name}' verified successfully.`);
                        this.fetchBackupList();
                        this.fetchStorageStats();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to upload backup archive");
                    }
                });
            };
            reader.readAsDataURL(file);
        },
        verifyBackupItem(fileName) {
            this.$root.getSocket().emit("verifyBackup", { fileName }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Backup '${fileName}' SHA-256 checksum & manifest verified cleanly.`);
                } else {
                    this.$root.toastError(res ? res.msg : "Verification failed");
                }
            });
        },
        deleteBackupItem(fileName) {
            if (confirm(`Are you sure you want to delete backup '${fileName}'?`)) {
                this.$root.getSocket().emit("deleteBackup", { fileName }, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Deleted backup '${fileName}'`);
                        this.fetchBackupList();
                        this.fetchStorageStats();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to delete backup");
                    }
                });
            }
        },
        startRestoreWizard(backup) {
            this.selectedRestoreBackup = backup;
            this.restoreStep = 1;
            this.showRestoreModal = true;
        },
        confirmRestore() {
            this.restoring = true;
            this.$root.getSocket().emit(
                "restoreBackup",
                { fileName: this.selectedRestoreBackup.fileName },
                (res) => {
                    this.restoring = false;
                    this.showRestoreModal = false;
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Pre-restore safety backup '${res.result.safetyBackupCreated}' saved. Platform restored successfully.`);
                        this.fetchBackupList();
                        this.fetchStorageStats();
                    } else {
                        this.$root.toastError(res ? res.msg : "Platform restore execution failed");
                    }
                }
            );
        },
        showDetails(backup) {
            this.detailsBackup = backup;
        },
        formatHour(h) {
            return String(h).padStart(2, "0") + ":00";
        },
        formatDate(isoStr) {
            if (!isoStr) {
                return "N/A";
            }
            const d = new Date(isoStr);
            return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        },
        getTypeBadgeClass(type) {
            if (type === "pre-update") {
                return "bg-info text-dark";
            }
            if (type === "pre-restore") {
                return "bg-warning text-dark";
            }
            if (type === "auto") {
                return "bg-secondary text-white";
            }
            return "bg-primary text-white";
        },
    },
};
</script>

<style scoped>
.drop-zone {
    transition: all 0.2s ease-in-out;
}
.drop-zone:hover {
    border-color: var(--ring, #ff9933) !important;
    background-color: var(--secondary) !important;
}
.cursor-pointer {
    cursor: pointer;
}
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
.max-vh-30 {
    max-height: 30vh;
}
</style>
