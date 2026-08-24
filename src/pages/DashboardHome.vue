<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'" class="noc-dashboard p-1 p-md-3">
            <!-- Top Control Bar with Time Range Filter -->
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
                <div>
                    <h1 class="h4 h3-md fw-bold mb-1 d-flex align-items-center gap-2" style="color: #ff9933;">
                        <font-awesome-icon icon="tachometer-alt" />
                        <span>Network Operations Center</span>
                    </h1>
                    <p class="text-secondary small mb-0">
                        Real-time Telemetry Scoped to <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                    </p>
                </div>

                <!-- Time Range Filter Pills & Controls -->
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="text-secondary small fw-bold text-uppercase me-1" style="letter-spacing: 0.05em;">Time Window:</span>
                    <div class="btn-group btn-group-sm flex-wrap" role="group" aria-label="Time Window Range">
                        <button
                            v-for="range in timeRanges"
                            :key="range.value"
                            type="button"
                            class="btn noc-time-btn"
                            :class="{ active: selectedTimeRange === range.value }"
                            @click="selectedTimeRange = range.value"
                        >
                            {{ range.label }}
                        </button>
                    </div>

                    <button
                        class="btn btn-sm btn-outline-danger ms-auto ms-sm-2"
                        :disabled="clearingAllEvents"
                        @click="clearAllEventsDialog"
                    >
                        <font-awesome-icon icon="trash-alt" class="me-1" />
                        <span class="d-none d-sm-inline">{{ $t("Clear Events") }}</span>
                    </button>
                </div>
            </div>

            <!-- 8 Summary Telemetry Cards in Fluid Grid -->
            <div class="row g-2 g-md-3 mb-4">
                <!-- 1. Total Monitors -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-amber">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">{{ $t("Total Monitors") }}</span>
                            <font-awesome-icon icon="desktop" class="text-warning fs-5" />
                        </div>
                        <div class="noc-card-value">{{ totalMonitors }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Configured targets</div>
                    </div>
                </div>

                <!-- 2. Up -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-success">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">{{ $t("Online") }}</span>
                            <font-awesome-icon icon="check-circle" class="fs-5" style="color: #2ecc71;" />
                        </div>
                        <div class="noc-card-value" style="color: #2ecc71;">{{ upCount }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Healthy targets</div>
                    </div>
                </div>

                <!-- 3. Pending -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-warning">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">{{ $t("Warning") }}</span>
                            <font-awesome-icon icon="exclamation-triangle" class="fs-5" style="color: #ff9933;" />
                        </div>
                        <div class="noc-card-value" style="color: #ff9933;">{{ pendingCount }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Pending / Degraded</div>
                    </div>
                </div>

                <!-- 4. Down -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-danger">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">{{ $t("Down") }}</span>
                            <font-awesome-icon icon="times-circle" class="fs-5" style="color: #dc2626;" />
                        </div>
                        <div class="noc-card-value" style="color: #dc2626;">{{ downCount }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Critical outages</div>
                    </div>
                </div>

                <!-- 5. Maintenance -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-info">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">{{ $t("Maintenance") }}</span>
                            <font-awesome-icon icon="wrench" class="fs-5" style="color: #3b82f6;" />
                        </div>
                        <div class="noc-card-value" style="color: #3b82f6;">{{ maintenanceCount }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Scheduled work</div>
                    </div>
                </div>

                <!-- 6. Active Alerts -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-purple">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">Active Alerts</span>
                            <font-awesome-icon icon="bell" class="fs-5" style="color: #a855f7;" />
                        </div>
                        <div class="noc-card-value" style="color: #a855f7;">{{ activeAlertsCount }}</div>
                        <div class="noc-card-footer text-muted small mt-1">Notification rules</div>
                    </div>
                </div>

                <!-- 7. Active Incidents -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm" :class="activeIncidentCount > 0 ? 'border-left-danger' : 'border-left-secondary'">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">Active Incidents</span>
                            <font-awesome-icon icon="exclamation-triangle" class="fs-5" :class="activeIncidentCount > 0 ? 'text-danger' : 'text-secondary'" />
                        </div>
                        <div class="noc-card-value" :class="activeIncidentCount > 0 ? 'text-danger' : 'text-secondary'">
                            {{ activeIncidentCount }}
                        </div>
                        <div class="noc-card-footer text-muted small mt-1">System outages</div>
                    </div>
                </div>

                <!-- 8. Org SLA -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="noc-card p-3 shadow-sm border-left-blue">
                        <div class="noc-card-header d-flex justify-content-between align-items-center mb-2">
                            <span class="noc-card-title">Overall Availability</span>
                            <font-awesome-icon icon="chart-line" class="fs-5 text-info" />
                        </div>
                        <div class="noc-card-value text-info">{{ overallAvailability }}%</div>
                        <div class="noc-card-footer text-muted small mt-1">Avg 30-day uptime</div>
                    </div>
                </div>
            </div>

            <!-- Dashboard Grid: 10 Telemetry Sections -->
            <div class="row g-3">
                <!-- Section 1: Network Health & Operational Status -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="heartbeat" />
                                <span>Network Health Overview</span>
                            </h2>
                            <span class="badge" :class="healthStatusBadgeClass">
                                {{ healthStatusLabel }}
                            </span>
                        </div>
                        <div class="d-flex align-items-center justify-content-around py-2">
                            <!-- SVG Donut Health Ring Visualizer -->
                            <div class="position-relative d-flex align-items-center justify-content-center" style="width: 110px; height: 110px;">
                                <svg viewBox="0 0 36 36" class="w-100 h-100">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="var(--secondary)"
                                        stroke-width="3.6"
                                    />
                                    <path
                                        :stroke-dasharray="`${healthPercent}, 100`"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        :stroke="healthPercent === 100 ? '#10b981' : (healthPercent >= 80 ? '#f59e0b' : '#ef4444')"
                                        stroke-width="3.6"
                                        stroke-linecap="round"
                                    />
                                </svg>
                                <div class="position-absolute text-center">
                                    <div class="fw-bold fs-5 lh-1" :class="healthStatusTextClass">{{ healthPercent }}%</div>
                                    <div class="text-muted small" style="font-size: 0.62rem;">HEALTH</div>
                                </div>
                            </div>

                            <div class="vr bg-secondary opacity-25" style="height: 70px;"></div>

                            <div class="d-flex flex-column gap-2 ms-3">
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="small text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-success d-inline-block"></span> Online:
                                    </span>
                                    <span class="fw-bold text-success">{{ upCount }}</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="small text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-warning d-inline-block"></span> Degraded:
                                    </span>
                                    <span class="fw-bold text-warning">{{ pendingCount }}</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="small text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-danger d-inline-block"></span> Down:
                                    </span>
                                    <span class="fw-bold text-danger">{{ downCount }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="progress noc-progress mt-3" style="height: 8px;">
                            <div
                                class="progress-bar bg-success"
                                role="progressbar"
                                :style="{ width: upPercent + '%' }"
                                title="Up"
                            ></div>
                            <div
                                class="progress-bar bg-warning"
                                role="progressbar"
                                :style="{ width: pendingPercent + '%' }"
                                title="Pending"
                            ></div>
                            <div
                                class="progress-bar bg-danger"
                                role="progressbar"
                                :style="{ width: downPercent + '%' }"
                                title="Down"
                            ></div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Monitor Status Categorized Breakdown -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="layer-group" />
                                <span>2. Monitor Status Breakdown</span>
                            </h2>
                            <span class="badge bg-dark text-muted border border-secondary">{{ monitorTypesCount }} Protocol Types</span>
                        </div>
                        <div class="row g-2">
                            <div v-for="(count, type) in monitorTypeBreakdown" :key="type" class="col-6 col-sm-4">
                                <div class="p-2 rounded noc-subcard border d-flex justify-content-between align-items-center">
                                    <span class="text-uppercase small fw-bold text-secondary">{{ type }}</span>
                                    <span class="badge bg-warning text-dark fw-bold">{{ count }}</span>
                                </div>
                            </div>
                            <div v-if="Object.keys(monitorTypeBreakdown).length === 0" class="col-12 text-center text-muted py-3">
                                No monitors configured yet in this organization.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 3: Active Alerts -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="bell" />
                                <span>3. Active Notification Channels</span>
                            </h2>
                            <router-link to="/settings/notifications" class="btn btn-xs btn-outline-warning">
                                Manage Alerts
                            </router-link>
                        </div>
                        <div v-if="$root.notificationList.length > 0" class="d-flex flex-column gap-2">
                            <div
                                v-for="notif in $root.notificationList"
                                :key="notif.id"
                                class="p-2 rounded noc-subcard border d-flex justify-content-between align-items-center"
                            >
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="envelope" class="text-warning" />
                                    <span class="fw-semibold">{{ notif.name }}</span>
                                </div>
                                <span class="badge" :class="notif.active ? 'bg-success' : 'bg-secondary'">
                                    {{ notif.active ? 'ACTIVE' : 'DISABLED' }}
                                </span>
                            </div>
                        </div>
                        <div v-else class="text-center text-muted py-4">
                            No notification alert channels configured for this organization.
                        </div>
                    </div>
                </div>

                <!-- Section 4: Active Incidents -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="exclamation-triangle" class="text-danger" />
                                <span>4. Active Incidents</span>
                            </h2>
                            <span class="badge" :class="activeIncidents.length > 0 ? 'bg-danger' : 'bg-success'">
                                {{ activeIncidents.length }} Active
                            </span>
                        </div>
                        <div v-if="activeIncidents.length > 0" class="d-flex flex-column gap-2">
                            <div
                                v-for="inc in activeIncidents"
                                :key="inc.id"
                                class="p-2 rounded border border-danger bg-dark d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <router-link :to="`/dashboard/${inc.id}`" class="fw-bold text-danger text-decoration-none">
                                        {{ inc.name }}
                                    </router-link>
                                    <div class="small text-muted text-truncate" style="max-width: 280px;">
                                        {{ lastHeartbeat(inc.id)?.msg || 'Target unreachable' }}
                                    </div>
                                </div>
                                <span class="badge bg-danger">CRITICAL OUTAGE</span>
                            </div>
                        </div>
                        <div v-else class="text-center text-success py-4 fw-semibold">
                            <font-awesome-icon icon="check-circle" class="me-2 fs-5" />
                            All infrastructure monitors operating normally. No active incidents.
                        </div>
                    </div>
                </div>

                <!-- Section 5: Recent Events Feed -->
                <div class="col-12 col-lg-8">
                    <div class="noc-section-box p-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="list-alt" />
                                <span>5. Recent Telemetry Events</span>
                            </h2>
                            <span class="text-muted small">Window: {{ selectedTimeRangeLabel }}</span>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-dark-noc table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Target Name</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th>Details / Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(beat, index) in displayedEvents" :key="index">
                                        <td class="name-column">
                                            <router-link :to="`/dashboard/${beat.monitorID}`" class="noc-link fw-semibold">
                                                {{ $root.monitorList[beat.monitorID]?.name || `Monitor #${beat.monitorID}` }}
                                            </router-link>
                                        </td>
                                        <td><Status :status="beat.status" /></td>
                                        <td><Datetime :value="beat.time" /></td>
                                        <td class="text-muted text-break small">{{ beat.msg }}</td>
                                    </tr>
                                    <tr v-if="displayedEvents.length === 0">
                                        <td colspan="4" class="text-center py-4 text-muted">
                                            No events logged in the selected {{ selectedTimeRangeLabel }} time range.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Section 6: Availability & SLA Breakdown -->
                <div class="col-12 col-lg-4">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="chart-pie" />
                                <span>6. Availability SLA</span>
                            </h2>
                        </div>
                        <div class="d-flex flex-column gap-3 py-2">
                            <div class="p-3 rounded noc-subcard border">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="text-secondary small fw-bold">Selected Window ({{ selectedTimeRangeLabel }})</span>
                                    <span class="fw-bold text-success">{{ windowUptimePercent }}%</span>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-success" :style="{ width: windowUptimePercent + '%' }"></div>
                                </div>
                            </div>

                            <div class="p-3 rounded noc-subcard border">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="text-secondary small fw-bold">24-Hour SLA Target</span>
                                    <span class="fw-bold text-info">99.9%</span>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-info" style="width: 99.9%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 7: Response Time & Latency Metrics -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="stopwatch" />
                                <span>7. Latency & Response Time</span>
                            </h2>
                            <span class="badge bg-primary fs-7">{{ avgResponseTime }} ms</span>
                        </div>
                        <div class="d-flex align-items-center justify-content-around py-3">
                            <div class="text-center">
                                <div class="h3 fw-bold mb-0">{{ avgResponseTime }} <span class="fs-6 text-muted">ms</span></div>
                                <div class="text-muted small">Average Latency</div>
                            </div>
                            <div class="vr bg-secondary opacity-25" style="height: 50px;"></div>
                            <div class="text-center">
                                <div class="h3 fw-bold text-success mb-0">{{ minResponseTime }} <span class="fs-6 text-muted">ms</span></div>
                                <div class="text-muted small">Best Latency</div>
                            </div>
                            <div class="vr bg-secondary opacity-25" style="height: 50px;"></div>
                            <div class="text-center">
                                <div class="h3 fw-bold text-warning mb-0">{{ maxResponseTime }} <span class="fs-6 text-muted">ms</span></div>
                                <div class="text-muted small">Max Latency</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 8: Top Failed Monitors -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="exclamation-circle" />
                                <span>8. Top Failed Targets</span>
                            </h2>
                            <span class="text-muted small">Window: {{ selectedTimeRangeLabel }}</span>
                        </div>
                        <div v-if="topFailedMonitors.length > 0" class="d-flex flex-column gap-2">
                            <div
                                v-for="(item, idx) in topFailedMonitors"
                                :key="item.id"
                                class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center"
                            >
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge bg-danger text-light">#{{ idx + 1 }}</span>
                                    <router-link :to="`/dashboard/${item.id}`" class="noc-link fw-semibold">
                                        {{ item.name }}
                                    </router-link>
                                </div>
                                <span class="badge bg-outline-danger">{{ item.failCount }} Failures</span>
                            </div>
                        </div>
                        <div v-else class="text-center text-muted py-4">
                            No failed targets recorded in this time range.
                        </div>
                    </div>
                </div>

                <!-- Section 9: Sites & Status Pages -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="globe" />
                                <span>9. Sites & Status Pages</span>
                            </h2>
                            <router-link to="/manage-status-page" class="btn btn-xs btn-outline-warning">
                                Manage Status Pages
                            </router-link>
                        </div>
                        <div v-if="$root.statusPageList.length > 0" class="d-flex flex-column gap-2">
                            <div
                                v-for="sp in $root.statusPageList"
                                :key="sp.id"
                                class="p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-center"
                            >
                                <div class="d-flex align-items-center gap-2">
                                    <font-awesome-icon icon="stream" class="text-warning" />
                                    <a :href="`/status/${sp.slug}`" target="_blank" class="noc-link fw-semibold">
                                        {{ sp.title }}
                                    </a>
                                </div>
                                <span class="badge bg-success">PUBLISHED</span>
                            </div>
                        </div>
                        <div v-else class="text-center text-muted py-4">
                            No public status pages configured for this organization.
                        </div>
                    </div>
                </div>

                <!-- Section 10: Probe Health (Architecture Placeholder) -->
                <div class="col-12 col-lg-6">
                    <div class="noc-section-box p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h2 class="h6 fw-bold mb-0 text-uppercase tracking-wider text-warning d-flex align-items-center gap-2">
                                <font-awesome-icon icon="network-wired" />
                                <span>10. Probe Health Telemetry</span>
                            </h2>
                            <span class="badge bg-success">1 Probe Active</span>
                        </div>
                        <div class="p-3 rounded bg-dark border border-secondary">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <div class="fw-bold text-light">Primary Local Probe Agent</div>
                                    <div class="small text-muted">Node: 127.0.0.1 (Internal Engine)</div>
                                </div>
                                <span class="badge bg-success px-3 py-2">HEALTHY</span>
                            </div>
                            <div class="row g-2 text-center mt-2 pt-2 border-top border-secondary">
                                <div class="col-4">
                                    <div class="small text-muted">Engine Status</div>
                                    <div class="fw-semibold text-success">ONLINE</div>
                                </div>
                                <div class="col-4">
                                    <div class="small text-muted">Internal Latency</div>
                                    <div class="fw-semibold text-info">&lt; 1 ms</div>
                                </div>
                                <div class="col-4">
                                    <div class="small text-muted">Multi-Region Slot</div>
                                    <div class="fw-semibold text-warning">READY</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else>
            <router-view :key="$route.fullPath" />
        </div>
    </transition>
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";

export default {
    components: {
        Status,
        Datetime,
    },

    data() {
        return {
            selectedTimeRange: 24, // default 24 hours
            timeRanges: [
                { label: "1 hour", value: 1 },
                { label: "6 hours", value: 6 },
                { label: "24 hours", value: 24 },
                { label: "7 days", value: 168 },
                { label: "30 days", value: 720 },
            ],
            clearingAllEvents: false,
            activeIncidentCount: 0,
        };
    },

    watch: {
        "$root.activeOrganizationId"() {
            this.loadIncidentStats();
        },
    },

    mounted() {
        this.loadIncidentStats();
        if (this.$root.getSocket()) {
            this.$root.getSocket().on("updateIncidentStats", this.loadIncidentStats);
        }
    },

    beforeUnmount() {
        if (this.$root.getSocket()) {
            this.$root.getSocket().off("updateIncidentStats", this.loadIncidentStats);
        }
    },

    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        selectedTimeRangeLabel() {
            const found = this.timeRanges.find((r) => r.value === this.selectedTimeRange);
            return found ? found.label : "24 hours";
        },
        totalMonitors() {
            return Object.keys(this.$root.monitorList).length;
        },
        upCount() {
            return this.$root.stats.up || 0;
        },
        downCount() {
            return this.$root.stats.down || 0;
        },
        pendingCount() {
            return this.$root.stats.pending || 0;
        },
        maintenanceCount() {
            return this.$root.stats.maintenance || 0;
        },
        activeAlertsCount() {
            return this.$root.notificationList.length;
        },
        activeProbes() {
            return this.upCount + this.downCount + this.pendingCount + this.maintenanceCount;
        },
        upPercent() {
            if (this.totalMonitors === 0) {
                return 100;
            }
            return Math.round((this.upCount / this.totalMonitors) * 100);
        },
        pendingPercent() {
            if (this.totalMonitors === 0) {
                return 0;
            }
            return Math.round((this.pendingCount / this.totalMonitors) * 100);
        },
        downPercent() {
            if (this.totalMonitors === 0) {
                return 0;
            }
            return Math.round((this.downCount / this.totalMonitors) * 100);
        },
        healthPercent() {
            if (this.totalMonitors === 0) {
                return 100;
            }
            return Math.round((this.upCount / this.totalMonitors) * 100);
        },
        healthStatusLabel() {
            if (this.healthPercent === 100) {
                return "OPERATIONAL";
            }
            if (this.healthPercent >= 80) {
                return "DEGRADED";
            }
            return "CRITICAL OUTAGE";
        },
        healthStatusBadgeClass() {
            if (this.healthPercent === 100) {
                return "bg-success";
            }
            if (this.healthPercent >= 80) {
                return "bg-warning text-dark";
            }
            return "bg-danger";
        },
        healthStatusTextClass() {
            if (this.healthPercent === 100) {
                return "text-success";
            }
            if (this.healthPercent >= 80) {
                return "text-warning";
            }
            return "text-danger";
        },

        // Time Range Filtered Heartbeats
        timeWindowCutoff() {
            return Date.now() - this.selectedTimeRange * 3600 * 1000;
        },

        allHeartbeatsInWindow() {
            const result = [];
            const cutoff = this.timeWindowCutoff;
            Object.values(this.$root.heartbeatList).forEach((beats) => {
                if (Array.isArray(beats)) {
                    beats.forEach((b) => {
                        const t = new Date(b.time).getTime();
                        if (t >= cutoff) {
                            result.push(b);
                        }
                    });
                }
            });
            return result;
        },

        windowUptimePercent() {
            const beats = this.allHeartbeatsInWindow;
            if (beats.length === 0) {
                return this.healthPercent;
            }
            const upBeats = beats.filter((b) => b.status === 1).length;
            return Math.round((upBeats / beats.length) * 100);
        },

        avgResponseTime() {
            const beats = this.allHeartbeatsInWindow.filter((b) => typeof b.ping === "number" && b.ping > 0);
            if (beats.length === 0) {
                return 0;
            }
            const total = beats.reduce((acc, b) => acc + b.ping, 0);
            return Math.round(total / beats.length);
        },

        minResponseTime() {
            const pings = this.allHeartbeatsInWindow
                .filter((b) => typeof b.ping === "number" && b.ping > 0)
                .map((b) => b.ping);
            if (pings.length === 0) {
                return 0;
            }
            return Math.min(...pings);
        },

        maxResponseTime() {
            const pings = this.allHeartbeatsInWindow
                .filter((b) => typeof b.ping === "number" && b.ping > 0)
                .map((b) => b.ping);
            if (pings.length === 0) {
                return 0;
            }
            return Math.max(...pings);
        },

        // Monitor Type Breakdown
        monitorTypeBreakdown() {
            const breakdown = {};
            Object.values(this.$root.monitorList).forEach((m) => {
                const t = m.type ? m.type.toUpperCase() : "HTTP";
                breakdown[t] = (breakdown[t] || 0) + 1;
            });
            return breakdown;
        },

        monitorTypesCount() {
            return Object.keys(this.monitorTypeBreakdown).length;
        },

        // Active Incidents
        activeIncidents() {
            return Object.values(this.$root.monitorList).filter((m) => {
                const lastBeat = this.lastHeartbeat(m.id);
                return lastBeat && lastBeat.status === 0;
            });
        },

        // Top Failed Monitors in Window
        topFailedMonitors() {
            const failMap = {};
            this.allHeartbeatsInWindow.forEach((b) => {
                if (b.status === 0 && b.monitor_id) {
                    failMap[b.monitor_id] = (failMap[b.monitor_id] || 0) + 1;
                }
            });

            return Object.entries(failMap)
                .map(([mId, failCount]) => {
                    const monitor = this.$root.monitorList[mId];
                    return {
                        id: mId,
                        name: monitor ? monitor.name : `Monitor #${mId}`,
                        failCount,
                    };
                })
                .sort((a, b) => b.failCount - a.failCount)
                .slice(0, 5);
        },

        // Displayed Events
        displayedEvents() {
            const events = [];
            Object.entries(this.$root.heartbeatList).forEach(([mId, beats]) => {
                if (Array.isArray(beats)) {
                    beats.forEach((b) => {
                        const t = new Date(b.time).getTime();
                        if (t >= this.timeWindowCutoff) {
                            events.push({
                                ...b,
                                monitorID: Number(mId),
                            });
                        }
                    });
                }
            });

            events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return events.slice(0, 10);
        },
    },

    methods: {
        lastHeartbeat(monitorId) {
            const beats = this.$root.heartbeatList[monitorId];
            if (Array.isArray(beats) && beats.length > 0) {
                return beats[beats.length - 1];
            }
            return null;
        },

        loadIncidentStats() {
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getIncidentDashboardStats", (res) => {
                    if (res && res.ok && res.stats) {
                        this.activeIncidentCount = res.stats.activeCount || 0;
                    }
                });
            }
        },

        clearAllEventsDialog() {
            if (confirm("Are you sure you want to clear all heartbeat events?")) {
                this.clearingAllEvents = true;
                this.$root.getSocket().emit("clearStatistics", (res) => {
                    this.clearingAllEvents = false;
                    if (res && res.ok) {
                        this.$root.toastSuccess("All events cleared");
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to clear events");
                    }
                });
            }
        },
    },
};
</script>

<style scoped>
.noc-dashboard {
    background-color: var(--card);
    color: var(--foreground);
    border-radius: 12px;
}

.noc-time-btn {
    background-color: var(--secondary);
    border-color: var(--border);
    color: var(--foreground);
    font-weight: 600;
    font-size: 0.8rem;
    padding: 0.3rem 0.65rem;
    transition: all 0.2s ease-in-out;
}

.noc-time-btn:hover {
    border-color: #ff9933;
    color: var(--foreground);
    background-color: var(--border);
}

.noc-time-btn.active {
    background-color: #ff9933;
    border-color: #e68a2e;
    color: #0f172a;
    font-weight: 800;
    box-shadow: 0 0 10px rgba(255, 153, 51, 0.3);
}

.noc-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    height: 100%;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.noc-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    border-color: var(--ring);
}

.border-left-amber { border-left: 4px solid #ff9933; }
.border-left-success { border-left: 4px solid #2ecc71; }
.border-left-danger { border-left: 4px solid #dc2626; }
.border-left-warning { border-left: 4px solid #ff9933; }
.border-left-info { border-left: 4px solid #3b82f6; }
.border-left-purple { border-left: 4px solid #a855f7; }
.border-left-blue { border-left: 4px solid #3b82f6; }
.border-left-secondary { border-left: 4px solid #64748b; }

.noc-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
}

.noc-card-value {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--card-foreground);
}

.noc-section-box {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.noc-link {
    color: var(--accent);
    text-decoration: none;
    transition: color 0.15s ease-in-out;
}

.noc-link:hover {
    color: var(--foreground);
    text-decoration: underline;
}

.table-dark-noc {
    --bs-table-bg: var(--card);
    --bs-table-color: var(--card-foreground);
    --bs-table-hover-bg: var(--secondary);
    border-color: var(--border);
}

.table-dark-noc th {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    border-bottom: 2px solid var(--border);
}
</style>
