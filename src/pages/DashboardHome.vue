<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'" class="noc-dashboard p-2 p-md-4">
            <!-- Header Bar with NOC Accent and Time Range Window -->
            <div class="noc-header-bar d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <div class="d-flex align-items-center">
                    <div class="noc-header-indicator me-3 flex-shrink-0"></div>
                    <div>
                        <h1 class="h3 fw-bold mb-1 text-foreground d-flex align-items-center gap-2" style="letter-spacing: -0.02em;">
                            <span>Network Operations Center</span>
                        </h1>
                        <p class="text-muted small mb-0 font-monospace">
                            Real-time Telemetry & Infrastructure Monitoring
                        </p>
                    </div>
                </div>

                <!-- Time Range Filter Pills & Controls -->
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="text-muted small fw-semibold me-1">Time Window</span>
                    <div class="btn-group btn-group-sm flex-wrap noc-time-window-group" role="group" aria-label="Time Window Range">
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

                    <button class="btn btn-sm btn-icon btn-outline-secondary text-muted" title="Custom Date Filter">
                        <font-awesome-icon icon="calendar-alt" />
                    </button>

                    <button
                        class="btn btn-sm btn-icon btn-outline-danger"
                        :disabled="clearingAllEvents"
                        title="Clear Heartbeat Event History"
                        @click="clearAllEventsDialog"
                    >
                        <font-awesome-icon icon="trash-alt" />
                    </button>
                </div>
            </div>

            <!-- Critical Infrastructure Alert Banner (Only displayed when active critical outages or degraded targets exist) -->
            <div
                v-if="downCount > 0 || pendingCount > 0 || activeIncidentCount > 0"
                class="noc-alert-banner outage p-3 p-md-4 mb-4 rounded-4 d-flex align-items-center justify-content-between flex-wrap gap-3"
            >
                <div class="d-flex align-items-center gap-3">
                    <div class="alert-icon-box d-flex align-items-center justify-content-center flex-shrink-0 rounded-3">
                        <font-awesome-icon icon="exclamation-triangle" class="fs-4 text-danger" />
                    </div>
                    <div>
                        <div class="fw-bold mb-1 text-foreground fs-6">
                            <span v-if="downCount > 0">{{ downCount }} Critical Infrastructure Outage{{ downCount > 1 ? 's' : '' }} Active</span>
                            <span v-else-if="activeIncidentCount > 0">{{ activeIncidentCount }} Active Incident{{ activeIncidentCount > 1 ? 's' : '' }} Under Investigation</span>
                            <span v-else>{{ pendingCount }} Monitoring Target{{ pendingCount > 1 ? 's' : '' }} in Degraded State</span>
                        </div>
                        <div class="small alert-subtext">
                            Active automated alerting and escalation engaged. Verify target connectivity.
                        </div>
                    </div>
                </div>

                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <router-link to="/incidents?status=OPEN&severity=P1" class="btn btn-danger fw-semibold px-3 py-2 rounded-3 d-flex align-items-center gap-2 shadow-sm">
                        <span>View Outages</span>
                        <font-awesome-icon icon="chevron-down" style="transform: rotate(-90deg); font-size: 0.75rem;" />
                    </router-link>
                    <button class="btn btn-secondary border text-foreground fw-medium px-3 py-2 rounded-3 d-flex align-items-center gap-2" @click="openLiveTelemetry">
                        <font-awesome-icon icon="heartbeat" class="text-danger" />
                        <span>Live Telemetry</span>
                    </button>
                </div>
            </div>

            <!-- 8 KPI Cards (2 Rows of 4 on Desktop, 2-Col Grid on Mobile) with Functional Filter & Page Navigation -->
            <div class="row g-3 mb-4">
                <!-- 1. Total Monitors -->
                <div class="col-6 col-md-3">
                    <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" @click="filterTargets('all')" title="View all configured targets">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="kpi-icon-box kpi-blue d-flex align-items-center justify-content-center rounded-3">
                                <font-awesome-icon icon="desktop" />
                            </div>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style="font-size: 0.65rem;">VIEW ALL</span>
                        </div>
                        <div>
                            <div class="kpi-label">Total Monitors</div>
                            <div class="kpi-value text-foreground">{{ totalMonitors }}</div>
                            <div class="kpi-subtext">Configured targets</div>
                        </div>
                    </div>
                </div>

                <!-- 2. Online -->
                <div class="col-6 col-md-3">
                    <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" @click="filterTargets('up')" title="Filter targets to UP">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="kpi-icon-box kpi-green d-flex align-items-center justify-content-center rounded-3">
                                <font-awesome-icon icon="check-circle" />
                            </div>
                            <span class="badge bg-success-subtle text-success border border-success-subtle font-monospace" style="font-size: 0.65rem;">FILTER UP</span>
                        </div>
                        <div>
                            <div class="kpi-label">Online</div>
                            <div class="kpi-value text-success" style="color: #10B981 !important;">{{ upCount }}</div>
                            <div class="kpi-subtext">Healthy targets</div>
                        </div>
                    </div>
                </div>

                <!-- 3. Warning -->
                <div class="col-6 col-md-3">
                    <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" @click="filterTargets('pending')" title="Filter targets to Degraded / Warning">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="kpi-icon-box kpi-amber d-flex align-items-center justify-content-center rounded-3">
                                <font-awesome-icon icon="exclamation-triangle" />
                            </div>
                            <span class="badge bg-warning-subtle text-warning border border-warning-subtle font-monospace" style="font-size: 0.65rem;">DEGRADED</span>
                        </div>
                        <div>
                            <div class="kpi-label">Warning</div>
                            <div class="kpi-value text-warning" style="color: #F59E0B !important;">{{ pendingCount }}</div>
                            <div class="kpi-subtext">Pending / Degraded</div>
                        </div>
                    </div>
                </div>

                <!-- 4. Down -->
                <div class="col-6 col-md-3">
                    <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" @click="filterTargets('down')" title="Filter targets to Outages / DOWN">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="kpi-icon-box kpi-red d-flex align-items-center justify-content-center rounded-3">
                                <font-awesome-icon icon="times-circle" />
                            </div>
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle font-monospace" style="font-size: 0.65rem;">OUTAGES</span>
                        </div>
                        <div>
                            <div class="kpi-label">Down</div>
                            <div class="kpi-value text-danger" style="color: #EF4444 !important;">{{ downCount }}</div>
                            <div class="kpi-subtext">Critical outages</div>
                        </div>
                    </div>
                </div>

                <!-- 5. Maintenance -->
                <div class="col-6 col-md-3">
                    <router-link to="/maintenance" class="text-decoration-none d-block h-100">
                        <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" title="View scheduled maintenance windows">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="kpi-icon-box kpi-purple d-flex align-items-center justify-content-center rounded-3">
                                    <font-awesome-icon icon="wrench" />
                                </div>
                                <span class="badge bg-purple-subtle text-purple border border-purple-subtle font-monospace" style="font-size: 0.65rem;">SCHEDULE</span>
                            </div>
                            <div>
                                <div class="kpi-label">Maintenance</div>
                                <div class="kpi-value text-purple" style="color: #8B5CF6 !important;">{{ maintenanceCount }}</div>
                                <div class="kpi-subtext">Scheduled work</div>
                            </div>
                        </div>
                    </router-link>
                </div>

                <!-- 6. Active Alerts -->
                <div class="col-6 col-md-3">
                    <router-link to="/alerts" class="text-decoration-none d-block h-100">
                        <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" title="View active firing alerts">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="kpi-icon-box kpi-indigo d-flex align-items-center justify-content-center rounded-3">
                                    <font-awesome-icon icon="bell" />
                                </div>
                                <span class="badge bg-indigo-subtle text-indigo border border-indigo-subtle font-monospace" style="font-size: 0.65rem;">ALERTS</span>
                            </div>
                            <div>
                                <div class="kpi-label">Active Alerts</div>
                                <div class="kpi-value text-indigo" style="color: #6366F1 !important;">{{ activeAlertsCount > 0 ? activeAlertsCount : (downCount > 0 ? downCount : 0) }}</div>
                                <div class="kpi-subtext">Firing alerts</div>
                            </div>
                        </div>
                    </router-link>
                </div>

                <!-- 7. Active Incidents -->
                <div class="col-6 col-md-3">
                    <router-link to="/incidents?status=OPEN" class="text-decoration-none d-block h-100">
                        <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" title="View open and unresolved incidents">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="kpi-icon-box kpi-darkblue d-flex align-items-center justify-content-center rounded-3">
                                    <font-awesome-icon icon="layer-group" />
                                </div>
                                <span class="badge font-monospace" :class="(activeIncidentCount > 0 || downCount > 0) ? 'bg-danger text-white' : 'bg-secondary-subtle text-secondary'" style="font-size: 0.65rem;">INCIDENTS</span>
                            </div>
                            <div>
                                <div class="kpi-label">Active Incidents</div>
                                <div class="kpi-value" :class="(activeIncidentCount > 0 || downCount > 0) ? 'text-danger' : 'text-foreground'">
                                    {{ Math.max(activeIncidentCount, downCount) }}
                                </div>
                                <div class="kpi-subtext">System outages</div>
                            </div>
                        </div>
                    </router-link>
                </div>

                <!-- 8. Overall Availability -->
                <div class="col-6 col-md-3">
                    <router-link to="/reports" class="text-decoration-none d-block h-100">
                        <div class="kpi-card p-3 rounded-4 h-100 d-flex flex-column justify-content-between interactive-kpi" title="View SLA and availability reports">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="kpi-icon-box kpi-cyan d-flex align-items-center justify-content-center rounded-3">
                                    <font-awesome-icon icon="chart-line" />
                                </div>
                                <span class="badge bg-info-subtle text-info border border-info-subtle font-monospace" style="font-size: 0.65rem;">SLA REPORT</span>
                            </div>
                            <div>
                                <div class="kpi-label">Availability</div>
                                <div class="kpi-value text-info" style="color: #06B6D4 !important;">{{ overallAvailability }}%</div>
                                <div class="kpi-subtext">Avg 30-day uptime</div>
                            </div>
                        </div>
                    </router-link>
                </div>
            </div>

            <!-- Master 2-Column Grid (Left ~65%, Right ~35% on Desktop) -->
            <div class="row g-3">
                <!-- ================= LEFT COLUMN ================= -->
                <div class="col-12 col-xl-8 d-flex flex-column gap-3">
                    <!-- 1. Live Infrastructure Targets -->
                    <div id="live-targets-panel" class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                            <div class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="layer-group" class="text-success" style="color: #10B981 !important;" />
                                <h2 class="h6 fw-bold mb-0 text-foreground" style="letter-spacing: -0.01em;">
                                    Live Infrastructure Targets ({{ totalMonitors }})
                                </h2>
                            </div>

                            <!-- Fast Status Filter Tabs -->
                            <div class="d-flex align-items-center gap-1 flex-wrap">
                                <button
                                    type="button"
                                    class="btn btn-sm noc-filter-pill"
                                    :class="{ active: monitorFilterStatus === 'all' }"
                                    @click="monitorFilterStatus = 'all'"
                                >
                                    All ({{ totalMonitors }})
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm noc-filter-pill"
                                    :class="{ active: monitorFilterStatus === 'up' }"
                                    @click="monitorFilterStatus = 'up'"
                                >
                                    <span class="status-dot dot-green me-1"></span> Up ({{ upCount }})
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm noc-filter-pill"
                                    :class="{ active: monitorFilterStatus === 'down' }"
                                    @click="monitorFilterStatus = 'down'"
                                >
                                    <span class="status-dot dot-red me-1"></span> Down ({{ downCount }})
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm noc-filter-pill"
                                    :class="{ active: monitorFilterStatus === 'pending' }"
                                    @click="monitorFilterStatus = 'pending'"
                                >
                                    <span class="status-dot dot-amber me-1"></span> Warning ({{ pendingCount }})
                                </button>
                            </div>
                        </div>

                        <!-- Instant Filter Search Input -->
                        <div class="mb-3">
                            <div class="noc-search-box d-flex align-items-center px-3 py-2 rounded-3">
                                <font-awesome-icon icon="search" class="text-muted me-2" />
                                <input
                                    v-model="monitorSearchQuery"
                                    type="text"
                                    class="noc-search-input w-100"
                                    placeholder="Filter by target name, IP or hostname..."
                                />
                                <button
                                    v-if="monitorSearchQuery"
                                    class="btn btn-sm p-0 text-muted border-0 bg-transparent"
                                    type="button"
                                    @click="monitorSearchQuery = ''"
                                >
                                    <font-awesome-icon icon="times" />
                                </button>
                            </div>
                        </div>

                        <!-- Target List Rows -->
                        <div v-if="filteredMonitors.length > 0" class="target-matrix-list d-flex flex-column gap-2" style="max-height: 380px; overflow-y: auto;">
                            <div
                                v-for="m in filteredMonitors"
                                :key="m.id"
                                class="target-row p-2 p-md-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                            >
                                <div class="d-flex align-items-center gap-3 overflow-hidden">
                                    <!-- Status Dot Beacon -->
                                    <span class="noc-pulse-indicator flex-shrink-0" :class="getMonitorStatusClass(m.id)"></span>

                                    <!-- Protocol/Target Icon Circle -->
                                    <div class="target-icon-circle d-flex align-items-center justify-content-center rounded-circle flex-shrink-0">
                                        <font-awesome-icon :icon="getMonitorTypeIcon(m.type)" class="small text-muted" />
                                    </div>

                                    <div class="d-flex flex-column overflow-hidden" style="line-height: 1.25;">
                                        <div class="d-flex align-items-center gap-2 flex-wrap">
                                            <router-link :to="`/dashboard/${m.id}`" class="target-name fw-bold text-truncate text-decoration-none">
                                                {{ m.name }}
                                            </router-link>
                                            <span class="badge protocol-tag font-monospace" style="font-size: 0.65rem;">
                                                {{ getProtocolLabel(m.type) }}
                                            </span>
                                            <span v-if="m.probe_id" class="badge bg-dark border border-secondary text-info font-monospace" style="font-size: 0.65rem;">
                                                <font-awesome-icon icon="satellite-dish" class="me-1" />Probe #{{ m.probe_id }}
                                            </span>
                                        </div>
                                        <span class="target-url text-muted text-truncate font-monospace small">
                                            {{ getTargetDisplay(m) }}
                                        </span>
                                    </div>
                                </div>

                                <div class="d-flex align-items-center gap-2 ms-auto">
                                    <!-- Latency & Packet Loss -->
                                    <div class="d-flex flex-column align-items-end" style="line-height: 1.1;">
                                        <span class="latency-badge font-monospace">
                                            {{ getMonitorPing(m.id) }}
                                        </span>
                                        <span v-if="m.type === 'ping'" class="text-success font-monospace" style="font-size: 0.65rem;">
                                            0% loss
                                        </span>
                                    </div>

                                    <!-- Status Badge Pill -->
                                    <span class="status-pill text-uppercase font-monospace fw-bold" :class="getStatusBadgeClass(m.id)">
                                        {{ getMonitorStatusText(m.id) }}
                                    </span>

                                    <!-- Contextual Action Dropdown -->
                                    <div class="dropdown">
                                        <button class="btn btn-sm btn-outline-secondary p-1 rounded-2 text-muted dropdown-toggle no-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Target Operations">
                                            <font-awesome-icon icon="ellipsis-v" />
                                        </button>
                                        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                            <li>
                                                <router-link :to="`/dashboard/${m.id}`" class="dropdown-item small">
                                                    <font-awesome-icon icon="info-circle" class="me-2 text-info" />View Details
                                                </router-link>
                                            </li>
                                            <li>
                                                <button class="dropdown-item small" @click="openTelemetryModalForMonitor(m.id)">
                                                    <font-awesome-icon icon="history" class="me-2 text-primary" />View Telemetry
                                                </button>
                                            </li>
                                            <li>
                                                <router-link :to="`/edit/${m.id}`" class="dropdown-item small">
                                                    <font-awesome-icon icon="edit" class="me-2 text-warning" />Edit Monitor
                                                </router-link>
                                            </li>
                                            <li><hr class="dropdown-divider my-1"></li>
                                            <li v-if="m.active">
                                                <button class="dropdown-item small text-warning" @click="toggleMonitorPause(m.id, true)">
                                                    <font-awesome-icon icon="pause" class="me-2" />Pause Monitoring
                                                </button>
                                            </li>
                                            <li v-else>
                                                <button class="dropdown-item small text-success" @click="toggleMonitorPause(m.id, false)">
                                                    <font-awesome-icon icon="play" class="me-2" />Resume Monitoring
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Empty State -->
                        <div v-else class="text-center py-4 text-muted">
                            <font-awesome-icon icon="search" class="fs-4 mb-2 text-secondary" />
                            <div class="small">No monitoring targets matched your search or status filter.</div>
                            <button class="btn btn-outline-secondary btn-sm mt-2 rounded-pill" @click="monitorFilterStatus = 'all'; monitorSearchQuery = '';">
                                Reset Filters
                            </button>
                        </div>
                    </div>

                    <!-- 2. Middle 3-Card Summary Strip -->
                    <div class="row g-3">
                        <!-- Card A: Active Notification Channels -->
                        <div class="col-12 col-md-4">
                            <div class="noc-panel p-3 rounded-4 h-100 d-flex flex-column justify-content-between">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                        <font-awesome-icon icon="bell" class="text-success" style="color: #10B981 !important;" />
                                        <span>Active Notification Channels</span>
                                    </div>
                                    <router-link to="/settings/notifications" class="text-decoration-none small text-muted hover-underline">
                                        Manage
                                    </router-link>
                                </div>
                                <div class="d-flex align-items-center justify-content-between mt-2 pt-2 border-top border-secondary">
                                    <span class="fw-semibold text-foreground small text-truncate">
                                        {{ $root.notificationList.length > 0 ? $root.notificationList[0].name : 'Default Channel' }}
                                    </span>
                                    <span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle" style="font-size: 0.65rem;">
                                        ACTIVE
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Card B: Active Incidents -->
                        <div class="col-12 col-md-4">
                            <div class="noc-panel p-3 rounded-4 h-100 d-flex flex-column justify-content-between">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                        <font-awesome-icon icon="exclamation-triangle" class="text-danger" style="color: #EF4444 !important;" />
                                        <span>Active Incidents</span>
                                    </div>
                                    <span class="badge rounded-pill" :class="(activeIncidentCount > 0 || downCount > 0) ? 'bg-danger text-white' : 'bg-secondary text-muted'" style="font-size: 0.65rem;">
                                        {{ Math.max(activeIncidentCount, downCount) }} Active
                                    </span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between mt-2 pt-2 border-top border-secondary">
                                    <span class="fw-semibold text-foreground small text-truncate">
                                        {{ (activeIncidentCount > 0 || downCount > 0) ? (activeIncidents.length > 0 ? activeIncidents[0].name : 'Active Outage Incident') : 'All systems nominal' }}
                                    </span>
                                    <span class="badge rounded-pill" :class="(activeIncidentCount > 0 || downCount > 0) ? 'bg-danger text-white' : 'bg-success-subtle text-success'" style="font-size: 0.65rem;">
                                        {{ (activeIncidentCount > 0 || downCount > 0) ? 'CRITICAL OUTAGE' : 'OPERATIONAL' }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Card C: Top Failed Targets -->
                        <div class="col-12 col-md-4">
                            <div class="noc-panel p-3 rounded-4 h-100 d-flex flex-column justify-content-between">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                        <font-awesome-icon icon="times-circle" class="text-warning" style="color: #F59E0B !important;" />
                                        <span>Top Failed Targets</span>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center justify-content-between mt-2 pt-2 border-top border-secondary">
                                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                                        <span class="badge bg-danger text-white" style="font-size: 0.65rem;">#1</span>
                                        <span class="fw-semibold text-foreground small text-truncate">
                                            {{ topFailedMonitors.length > 0 ? topFailedMonitors[0].name : 'None' }}
                                        </span>
                                    </div>
                                    <span class="badge rounded-pill bg-secondary border border-secondary text-muted font-monospace" style="font-size: 0.65rem;">
                                        {{ topFailedMonitors.length > 0 ? topFailedMonitors[0].failCount + ' Failures' : '0 Failures' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Recent Telemetry Events Table -->
                    <div id="events" class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <div class="d-flex align-items-center gap-2">
                                <font-awesome-icon icon="history" class="text-success" style="color: #10B981 !important;" />
                                <h2 class="h6 fw-bold mb-0 text-foreground">Recent Telemetry Events</h2>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <div class="btn-group btn-group-sm" role="group">
                                    <button
                                        type="button"
                                        class="btn btn-sm"
                                        :class="telemetryFilter === 'all' ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'"
                                        @click="telemetryFilter = 'all'"
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-sm"
                                        :class="telemetryFilter === 'up' ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'"
                                        @click="telemetryFilter = 'up'"
                                    >
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-sm"
                                        :class="telemetryFilter === 'down' ? 'btn-danger text-white fw-bold' : 'btn-outline-secondary'"
                                        @click="telemetryFilter = 'down'"
                                    >
                                        Down
                                    </button>
                                </div>
                                <span class="small text-muted font-monospace d-none d-md-inline">Window: {{ selectedTimeRangeLabel }}</span>
                            </div>
                        </div>

                        <!-- Telemetry Search Filter -->
                        <div class="mb-3">
                            <input
                                v-model="telemetrySearch"
                                type="text"
                                class="form-control form-control-sm noc-search-input"
                                placeholder="Search telemetry message, error reason, or target name..."
                            />
                        </div>

                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0 small table-hover">
                                <thead>
                                    <tr class="text-muted border-bottom border-secondary font-monospace" style="font-size: 0.7rem; text-transform: uppercase;">
                                        <th scope="col" class="pb-2">TARGET NAME</th>
                                        <th scope="col" class="pb-2">STATUS</th>
                                        <th scope="col" class="pb-2">TIMESTAMP</th>
                                        <th scope="col" class="pb-2">DIAGNOSTIC DETAILS / MESSAGE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(event, idx) in displayedEvents"
                                        :key="idx"
                                        class="border-bottom border-secondary cursor-pointer hover-row"
                                        @click="openEventDetailsModal(event)"
                                        title="Click to inspect full diagnostic telemetry"
                                    >
                                        <td class="fw-bold text-foreground py-2 text-nowrap">
                                            <div class="d-flex align-items-center gap-2">
                                                <span>{{ $root.monitorList[event.monitorID] ? $root.monitorList[event.monitorID].name : 'Target #' + event.monitorID }}</span>
                                                <span v-if="$root.monitorList[event.monitorID]" class="badge protocol-tag font-monospace" style="font-size: 0.6rem;">
                                                    {{ getProtocolLabel($root.monitorList[event.monitorID].type) }}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="py-2">
                                            <span class="status-pill text-uppercase font-monospace fw-bold" :class="event.status === 1 ? 'status-up' : 'status-down'">
                                                {{ event.status === 1 ? 'Up' : 'Down' }}
                                            </span>
                                        </td>
                                        <td class="text-muted font-monospace py-2 text-nowrap" style="font-size: 0.75rem;">
                                            {{ new Date(event.time).toISOString().replace('T', ' ').substring(0, 19) }}
                                        </td>
                                        <td class="text-muted text-truncate font-monospace py-2" style="max-width: 320px; font-size: 0.75rem;">
                                            {{ getTelemetryMessage(event) }}
                                        </td>
                                    </tr>
                                    <tr v-if="displayedEvents.length === 0">
                                        <td colspan="4" class="text-center text-muted py-4">
                                            No events recorded matching your filter criteria.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 4. Bottom 2-Card Row -->
                    <div class="row g-3">
                        <!-- Latency & Response Time -->
                        <div class="col-12 col-md-6">
                            <div class="noc-panel p-3 p-md-4 rounded-4 h-100">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                        <font-awesome-icon icon="heartbeat" class="text-success" style="color: #10B981 !important;" />
                                        <span>Latency & Response Time</span>
                                    </div>
                                    <span class="badge rounded-pill bg-info-subtle text-info font-monospace">
                                        {{ avgResponseTime }} ms
                                    </span>
                                </div>
                                <div class="row g-2 text-center pt-2">
                                    <div class="col-4">
                                        <div class="fs-5 fw-bold text-foreground font-monospace">{{ avgResponseTime }} <span class="small text-muted" style="font-size: 0.65rem;">ms</span></div>
                                        <div class="small text-muted" style="font-size: 0.7rem;">Average Latency</div>
                                    </div>
                                    <div class="col-4 border-start border-end border-secondary">
                                        <div class="fs-5 fw-bold text-success font-monospace" style="color: #10B981 !important;">{{ minResponseTime }} <span class="small text-muted" style="font-size: 0.65rem;">ms</span></div>
                                        <div class="small text-muted" style="font-size: 0.7rem;">Best Latency</div>
                                    </div>
                                    <div class="col-4">
                                        <div class="fs-5 fw-bold text-warning font-monospace" style="color: #F59E0B !important;">{{ maxResponseTime }} <span class="small text-muted" style="font-size: 0.65rem;">ms</span></div>
                                        <div class="small text-muted" style="font-size: 0.7rem;">Max Latency</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sites & Status Pages -->
                        <div class="col-12 col-md-6">
                            <div class="noc-panel p-3 p-md-4 rounded-4 h-100 d-flex flex-column justify-content-between">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                        <font-awesome-icon icon="globe" class="text-success" style="color: #10B981 !important;" />
                                        <span>Sites & Status Pages</span>
                                    </div>
                                    <router-link to="/manage-status-page" class="btn btn-sm btn-outline-secondary rounded-pill py-1 px-3 text-muted" style="font-size: 0.75rem;">
                                        Manage
                                    </router-link>
                                </div>
                                <div v-if="$root.statusPageList && $root.statusPageList.length > 0" class="d-flex flex-column gap-2">
                                    <div v-for="sp in $root.statusPageList.slice(0, 2)" :key="sp.id" class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-secondary border">
                                        <span class="small text-foreground text-truncate">{{ sp.title }}</span>
                                        <a :href="`/status/${sp.slug}`" target="_blank" class="badge bg-success-subtle text-success text-decoration-none">PUBLISHED</a>
                                    </div>
                                </div>
                                <div v-else class="text-center text-muted py-3">
                                    <font-awesome-icon icon="file-alt" class="fs-3 text-secondary mb-2 opacity-50" />
                                    <div class="small">No public status pages configured for this organization.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================= RIGHT COLUMN ================= -->
                <div class="col-12 col-xl-4 d-flex flex-column gap-3">
                    <!-- 1. Network Health Overview -->
                    <div class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                <font-awesome-icon icon="heartbeat" class="text-success" style="color: #10B981 !important;" />
                                <span>Network Health Overview</span>
                            </div>
                        </div>

                        <!-- Donut Gauge & Legend -->
                        <div class="d-flex align-items-center justify-content-around py-3">
                            <div class="position-relative d-flex align-items-center justify-content-center" style="width: 120px; height: 120px;">
                                <svg viewBox="0 0 36 36" class="w-100 h-100" style="transform: rotate(-90deg);">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="var(--border)"
                                        stroke-width="3.5"
                                    />
                                    <path
                                        :stroke-dasharray="`${healthPercent}, 100`"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        :stroke="healthPercent === 100 ? '#10B981' : (healthPercent >= 80 ? '#F59E0B' : '#EF4444')"
                                        stroke-width="3.5"
                                        stroke-linecap="round"
                                    />
                                </svg>
                                <div class="position-absolute text-center" style="transform: none;">
                                    <div class="fw-bold fs-4 text-foreground lh-1">{{ healthPercent }}%</div>
                                    <div class="text-muted small mt-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">HEALTH</div>
                                </div>
                            </div>

                            <div class="d-flex flex-column gap-2 ms-3 small">
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-2">
                                        <span class="p-1 rounded-circle bg-success d-inline-block"></span> Online
                                    </span>
                                    <span class="fw-bold text-success">{{ upCount }}</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-2">
                                        <span class="p-1 rounded-circle bg-warning d-inline-block"></span> Degraded
                                    </span>
                                    <span class="fw-bold text-warning">{{ pendingCount }}</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-2">
                                        <span class="p-1 rounded-circle bg-danger d-inline-block"></span> Down
                                    </span>
                                    <span class="fw-bold text-danger">{{ downCount }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Multi-Segment Colored Bar -->
                        <div class="progress mt-2 rounded-pill overflow-hidden" style="height: 6px; background-color: var(--secondary); border: 1px solid var(--border);">
                            <div class="progress-bar bg-success" :style="{ width: upPercent + '%' }"></div>
                            <div class="progress-bar bg-warning" :style="{ width: pendingPercent + '%' }"></div>
                            <div class="progress-bar bg-danger" :style="{ width: downPercent + '%' }"></div>
                        </div>
                    </div>

                    <!-- 2. Availability SLA -->
                    <div class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                <font-awesome-icon icon="award" class="text-success" style="color: #10B981 !important;" />
                                <span>Availability SLA</span>
                            </div>
                        </div>

                        <div class="d-flex flex-column gap-3">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1 small">
                                    <span class="text-muted">Selected Window ({{ selectedTimeRangeLabel }})</span>
                                    <span class="fw-bold text-success" style="color: #10B981 !important;">{{ windowUptimePercent }}%</span>
                                </div>
                                <div class="progress rounded-pill overflow-hidden" style="height: 6px; background-color: var(--secondary); border: 1px solid var(--border);">
                                    <div class="progress-bar bg-success" :style="{ width: windowUptimePercent + '%' }"></div>
                                </div>
                            </div>

                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1 small">
                                    <span class="text-muted">24-Hour SLA Target</span>
                                    <span class="fw-bold text-info" style="color: #06B6D4 !important;">99.9%</span>
                                </div>
                                <div class="progress rounded-pill overflow-hidden" style="height: 6px; background-color: var(--secondary); border: 1px solid var(--border);">
                                    <div class="progress-bar" style="width: 99.9%; background-color: #06B6D4;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Monitor Status Breakdown -->
                    <div class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                <font-awesome-icon icon="layer-group" class="text-success" style="color: #10B981 !important;" />
                                <span>Monitor Status Breakdown</span>
                            </div>
                            <span class="badge rounded-pill bg-secondary border border-secondary text-muted" style="font-size: 0.65rem;">
                                {{ monitorTypesCount }} Protocol Types
                            </span>
                        </div>

                        <!-- Protocol Type Pills -->
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                            <span
                                v-for="(count, type) in monitorTypeBreakdown"
                                :key="type"
                                class="badge rounded-pill bg-warning text-dark fw-bold px-2 py-1"
                                style="font-size: 0.7rem;"
                            >
                                {{ type }} {{ count }}
                            </span>
                        </div>

                        <!-- Donut Breakdown -->
                        <div class="d-flex align-items-center justify-content-around py-2">
                            <div class="position-relative d-flex align-items-center justify-content-center" style="width: 100px; height: 100px;">
                                <svg viewBox="0 0 36 36" class="w-100 h-100" style="transform: rotate(-90deg);">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="var(--border)"
                                        stroke-width="4"
                                    />
                                    <path
                                        :stroke-dasharray="`${upPercent}, 100`"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#10B981"
                                        stroke-width="4"
                                    />
                                </svg>
                                <div class="position-absolute text-center" style="transform: none;">
                                    <div class="fw-bold fs-5 text-foreground lh-1">{{ totalMonitors }}</div>
                                    <div class="text-muted small" style="font-size: 0.6rem;">Total</div>
                                </div>
                            </div>

                            <div class="d-flex flex-column gap-1 small">
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-success d-inline-block"></span> Up
                                    </span>
                                    <span class="fw-semibold text-foreground">{{ upCount }} ({{ upPercent }}%)</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-danger d-inline-block"></span> Down
                                    </span>
                                    <span class="fw-semibold text-foreground">{{ downCount }} ({{ downPercent }}%)</span>
                                </div>
                                <div class="d-flex align-items-center justify-content-between gap-3">
                                    <span class="text-muted d-flex align-items-center gap-1">
                                        <span class="p-1 rounded-circle bg-warning d-inline-block"></span> Warning
                                    </span>
                                    <span class="fw-semibold text-foreground">{{ pendingCount }} ({{ pendingPercent }}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Probe Health & Telemetry -->
                    <div class="noc-panel p-3 p-md-4 rounded-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center gap-2 text-foreground small fw-bold">
                                <font-awesome-icon icon="satellite-dish" class="text-success" style="color: #10B981 !important;" />
                                <span>Probe Health & Telemetry</span>
                            </div>
                            <span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle" style="font-size: 0.65rem;">
                                1 Probe Active
                            </span>
                        </div>

                        <div class="probe-box p-3 rounded-3 border border-secondary">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <div class="fw-bold text-foreground small">Primary Local Probe Agent</div>
                                    <div class="text-muted font-monospace" style="font-size: 0.7rem;">Node: 127.0.0.1 (Internal Engine)</div>
                                </div>
                                <span class="badge rounded-pill bg-success text-white px-2 py-1" style="font-size: 0.65rem;">
                                    HEALTHY
                                </span>
                            </div>
                            <div class="row g-2 text-center mt-2 pt-2 border-top border-secondary font-monospace" style="font-size: 0.72rem;">
                                <div class="col-4">
                                    <div class="text-muted" style="font-size: 0.65rem;">Engine Status</div>
                                    <div class="fw-bold text-success" style="color: #10B981 !important;">ONLINE</div>
                                </div>
                                <div class="col-4">
                                    <div class="text-muted" style="font-size: 0.65rem;">Internal Latency</div>
                                    <div class="fw-bold text-info" style="color: #06B6D4 !important;">&lt; 1 ms</div>
                                </div>
                                <div class="col-4">
                                    <div class="text-muted" style="font-size: 0.65rem;">Multi-Region Slot</div>
                                    <div class="fw-bold text-warning" style="color: #F59E0B !important;">READY</div>
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

        <!-- Telemetry Event Details Modal -->
        <div v-if="showEventModal && selectedEvent" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); z-index: 1055;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content noc-modal-content border border-secondary shadow-lg">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <font-awesome-icon icon="history" class="text-success" />
                            <h5 class="modal-title fw-bold text-foreground mb-0">Telemetry Diagnostic Inspector</h5>
                        </div>
                        <button type="button" class="btn-close btn-close-white" @click="showEventModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-3 mb-3">
                            <div class="col-12 col-md-6">
                                <label class="text-secondary small fw-bold text-uppercase">Target Name</label>
                                <div class="fw-bold text-foreground fs-5">
                                    {{ $root.monitorList[selectedEvent.monitorID] ? $root.monitorList[selectedEvent.monitorID].name : 'Target #' + selectedEvent.monitorID }}
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="text-secondary small fw-bold text-uppercase">Protocol</label>
                                <div>
                                    <span class="badge protocol-tag font-monospace">
                                        {{ $root.monitorList[selectedEvent.monitorID] ? getProtocolLabel($root.monitorList[selectedEvent.monitorID].type) : 'UNKNOWN' }}
                                    </span>
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="text-secondary small fw-bold text-uppercase">Health State</label>
                                <div>
                                    <span class="status-pill text-uppercase font-monospace fw-bold" :class="selectedEvent.status === 1 ? 'status-up' : 'status-down'">
                                        {{ selectedEvent.status === 1 ? 'Operational (UP)' : 'Outage (DOWN)' }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-12 col-md-6">
                                <label class="text-secondary small fw-bold text-uppercase">Target Address</label>
                                <div class="font-monospace small text-light bg-dark p-2 rounded border border-secondary">
                                    {{ $root.monitorList[selectedEvent.monitorID] ? getTargetDisplay($root.monitorList[selectedEvent.monitorID]) : '--' }}
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="text-secondary small fw-bold text-uppercase">Latency / Ping</label>
                                <div class="font-monospace fw-bold text-info fs-6">
                                    {{ selectedEvent.ping !== undefined && selectedEvent.ping !== null ? selectedEvent.ping + ' ms' : '--' }}
                                </div>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="text-secondary small fw-bold text-uppercase">Reporting Node</label>
                                <div class="small text-muted font-monospace">
                                    <span v-if="selectedEvent.probe_id">Distributed Probe #{{ selectedEvent.probe_id }}</span>
                                    <span v-else>Central NOC Engine</span>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="text-secondary small fw-bold text-uppercase">Event Diagnostic Details</label>
                            <div class="p-3 bg-dark rounded border border-secondary font-monospace small text-success-subtle">
                                {{ getTelemetryMessage(selectedEvent) }}
                            </div>
                        </div>

                        <div class="row g-2 small text-muted font-monospace border-top border-secondary pt-3">
                            <div class="col-6">Timestamp: {{ new Date(selectedEvent.time).toISOString() }}</div>
                            <div class="col-6 text-end">Monitor ID: #{{ selectedEvent.monitorID }}</div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-2">
                        <router-link :to="`/dashboard/${selectedEvent.monitorID}`" class="btn btn-sm btn-outline-info" @click="showEventModal = false">
                            <font-awesome-icon icon="external-link-alt" class="me-1" /> View Full Monitor
                        </router-link>
                        <button type="button" class="btn btn-sm btn-secondary" @click="showEventModal = false">Close</button>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import { getMonitorTargetDisplay, getMonitorProtocolLabel, formatTelemetryMessage } from "../util-frontend";

export default {
    components: {
        Status,
        Datetime,
    },

    data() {
        return {
            selectedTimeRange: 24, // default 24 hours
            timeRanges: [
                { label: "1h", value: 1 },
                { label: "6h", value: 6 },
                { label: "24h", value: 24 },
                { label: "7d", value: 168 },
                { label: "30d", value: 720 },
            ],
            clearingAllEvents: false,
            nocStats: null,
            activeIncidentCount: 0,
            activeAlertsCount: 0,
            activeAlertsList: [],
            monitorFilterStatus: "all",
            monitorSearchQuery: "",
            telemetryFilter: "all",
            telemetrySearch: "",
            selectedEvent: null,
            showEventModal: false,
        };
    },

    watch: {
        "$root.activeOrganizationId"() {
            this.loadNocStats();
            this.loadIncidentStats();
            this.loadActiveAlerts();
        },
        "$route.query.status"(newStatus) {
            if (newStatus) {
                this.monitorFilterStatus = newStatus.toLowerCase();
            }
        },
    },

    mounted() {
        if (this.$route.query.status) {
            this.monitorFilterStatus = this.$route.query.status.toLowerCase();
        }
        this.loadNocStats();
        this.loadIncidentStats();
        this.loadActiveAlerts();
        if (this.$root.getSocket()) {
            this.$root.getSocket().on("updateNocStats", this.loadNocStats);
            this.$root.getSocket().on("updateProbeList", this.loadNocStats);
            this.$root.getSocket().on("updateIncidentStats", this.loadIncidentStats);
            this.$root.getSocket().on("updateActiveAlerts", this.loadActiveAlerts);
        }
    },

    beforeUnmount() {
        if (this.$root.getSocket()) {
            this.$root.getSocket().off("updateNocStats", this.loadNocStats);
            this.$root.getSocket().off("updateProbeList", this.loadNocStats);
            this.$root.getSocket().off("updateIncidentStats", this.loadIncidentStats);
            this.$root.getSocket().off("updateActiveAlerts", this.loadActiveAlerts);
        }
    },

    computed: {
        filteredMonitors() {
            const list = Object.values(this.$root.monitorList || {});
            return list.filter((m) => {
                if (this.monitorFilterStatus !== "all") {
                    const beat = (this.$root.lastHeartbeatList || {})[m.id];
                    const status = beat ? beat.status : -1;
                    if (this.monitorFilterStatus === "up" && status !== 1) return false;
                    if (this.monitorFilterStatus === "down" && status !== 0) return false;
                    if (this.monitorFilterStatus === "pending" && status !== 2) return false;
                    if (this.monitorFilterStatus === "maintenance" && status !== 3) return false;
                }
                if (this.monitorSearchQuery && this.monitorSearchQuery.trim()) {
                    const q = this.monitorSearchQuery.toLowerCase().trim();
                    const name = (m.name || "").toLowerCase();
                    const target = (m.url || m.hostname || "").toLowerCase();
                    return name.includes(q) || target.includes(q);
                }
                return true;
            });
        },
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        selectedTimeRangeLabel() {
            const found = this.timeRanges.find((r) => r.value === this.selectedTimeRange);
            return found ? found.label : "24h";
        },
        totalMonitors() {
            return this.nocStats?.monitors?.total ?? Object.keys(this.$root.monitorList).length;
        },
        upCount() {
            return this.nocStats?.monitors?.up ?? (this.$root.stats.up || 0);
        },
        downCount() {
            return this.nocStats?.monitors?.down ?? (this.$root.stats.down || 0);
        },
        pendingCount() {
            return this.nocStats?.monitors?.warning ?? (this.$root.stats.pending || 0);
        },
        maintenanceCount() {
            return this.nocStats?.monitors?.paused ?? (this.$root.stats.maintenance || 0);
        },
        activeProbes() {
            return this.nocStats?.probes?.online ?? (this.upCount + this.downCount);
        },
        upPercent() {
            if (this.totalMonitors === 0) return 100;
            return Math.round((this.upCount / this.totalMonitors) * 100);
        },
        pendingPercent() {
            if (this.totalMonitors === 0) return 0;
            return Math.round((this.pendingCount / this.totalMonitors) * 100);
        },
        downPercent() {
            if (this.totalMonitors === 0) return 0;
            return Math.round((this.downCount / this.totalMonitors) * 100);
        },
        healthPercent() {
            if (this.totalMonitors === 0) return 100;
            return Math.round((this.upCount / this.totalMonitors) * 100);
        },
        overallAvailability() {
            if (this.windowUptimePercent) return this.windowUptimePercent;
            return this.healthPercent ? this.healthPercent.toFixed(1) : "99.0";
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
            if (beats.length === 0) return 0;
            const total = beats.reduce((acc, b) => acc + b.ping, 0);
            return Math.round(total / beats.length);
        },

        minResponseTime() {
            const pings = this.allHeartbeatsInWindow
                .filter((b) => typeof b.ping === "number" && b.ping > 0)
                .map((b) => b.ping);
            if (pings.length === 0) return 0;
            return Math.min(...pings);
        },

        maxResponseTime() {
            const pings = this.allHeartbeatsInWindow
                .filter((b) => typeof b.ping === "number" && b.ping > 0)
                .map((b) => b.ping);
            if (pings.length === 0) return 0;
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

            let filtered = events;
            if (this.telemetryFilter === "up") {
                filtered = filtered.filter((e) => e.status === 1);
            } else if (this.telemetryFilter === "down") {
                filtered = filtered.filter((e) => e.status === 0);
            }

            if (this.telemetrySearch && this.telemetrySearch.trim()) {
                const q = this.telemetrySearch.trim().toLowerCase();
                filtered = filtered.filter((e) => {
                    const mon = this.$root.monitorList[e.monitorID];
                    const name = (mon ? mon.name : "").toLowerCase();
                    const target = (mon ? (mon.hostname || mon.url || "") : "").toLowerCase();
                    const msg = (e.msg || "").toLowerCase();
                    return name.includes(q) || target.includes(q) || msg.includes(q);
                });
            }

            filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return filtered.slice(0, 15);
        },
    },

    methods: {
        getTargetDisplay(m) {
            return getMonitorTargetDisplay(m);
        },
        getProtocolLabel(type) {
            return getMonitorProtocolLabel(type);
        },
        getTelemetryMessage(event) {
            return formatTelemetryMessage(event, this.$root.monitorList[event.monitorID]);
        },
        filterTargets(st) {
            this.monitorFilterStatus = st;
            this.$router.replace({ query: { ...this.$route.query, status: st } });
            const el = document.getElementById("live-targets-panel");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        },
        openEventDetailsModal(event) {
            this.selectedEvent = event;
            this.showEventModal = true;
        },
        openTelemetryModalForMonitor(monitorId) {
            const beats = this.$root.heartbeatList[monitorId];
            const event = Array.isArray(beats) && beats.length > 0
                ? { ...beats[beats.length - 1], monitorID: monitorId }
                : { monitorID: monitorId, status: 1, ping: 0, time: new Date().toISOString() };
            this.openEventDetailsModal(event);
        },
        toggleMonitorPause(monitorId, pause) {
            const socket = this.$root.getSocket();
            if (!socket) return;
            socket.emit(pause ? "pauseMonitor" : "resumeMonitor", monitorId, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(pause ? "Monitoring paused" : "Monitoring resumed");
                } else {
                    this.$root.toastError(res ? res.msg : "Operation failed");
                }
            });
        },
        getMonitorStatusClass(id) {
            const beat = (this.$root.lastHeartbeatList || {})[id];
            if (!beat) return "bg-secondary";
            if (beat.status === 1) return "bg-success";
            if (beat.status === 0) return "bg-danger";
            if (beat.status === 2) return "bg-warning";
            if (beat.status === 3) return "bg-info";
            return "bg-secondary";
        },
        getMonitorTypeIcon(type) {
            switch (type) {
                case "http":
                case "keyword":
                case "json-query":
                    return "globe";
                case "ping":
                    return "network-wired";
                case "port":
                    return "plug";
                case "dns":
                    return "search";
                case "snmp":
                    return "server";
                default:
                    return "globe";
            }
        },
        getMonitorPing(id) {
            const beat = (this.$root.lastHeartbeatList || {})[id];
            if (beat && typeof beat.ping === "number" && beat.ping > 0) {
                return `${beat.ping} ms`;
            }
            return "—";
        },
        getStatusBadgeClass(id) {
            const beat = (this.$root.lastHeartbeatList || {})[id];
            if (!beat) return "status-pending";
            if (beat.status === 1) return "status-up";
            if (beat.status === 0) return "status-down";
            if (beat.status === 2) return "status-warning";
            if (beat.status === 3) return "status-maint";
            return "status-pending";
        },
        getMonitorStatusText(id) {
            const beat = (this.$root.lastHeartbeatList || {})[id];
            if (!beat) return "Pending";
            if (beat.status === 1) return "UP";
            if (beat.status === 0) return "DOWN";
            if (beat.status === 2) return "WARN";
            if (beat.status === 3) return "MAINT";
            return "UNKNOWN";
        },
        lastHeartbeat(monitorId) {
            const beats = this.$root.heartbeatList[monitorId];
            if (Array.isArray(beats) && beats.length > 0) {
                return beats[beats.length - 1];
            }
            return null;
        },

        loadNocStats() {
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getNocStats", (res) => {
                    if (res && res.ok && res.stats) {
                        this.nocStats = res.stats;
                        if (res.stats.incidents) {
                            this.activeIncidentCount = res.stats.incidents.total || 0;
                        }
                        if (res.stats.alerts) {
                            this.activeAlertsCount = res.stats.alerts.total || 0;
                        }
                    }
                });
            }
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

        loadActiveAlerts() {
            if (this.$root.getSocket()) {
                this.$root.getSocket().emit("getActiveAlerts", (res) => {
                    if (res && res.ok && Array.isArray(res.alerts)) {
                        this.activeAlertsList = res.alerts;
                        this.activeAlertsCount = res.alerts.length;
                    }
                });
            }
        },

        openLiveTelemetry() {
            if (this.downCount > 0) {
                const list = Object.values(this.$root.monitorList || {});
                const downMon = list.find((m) => {
                    const beat = (this.$root.lastHeartbeatList || {})[m.id];
                    return beat && beat.status === 0;
                });
                if (downMon) {
                    this.$router.push(`/dashboard/${downMon.id}`);
                    return;
                }
            }
            this.monitorFilterStatus = this.downCount > 0 ? "down" : "all";
            const el = document.getElementById("live-targets-panel");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
}

.noc-header-indicator {
    width: 4px;
    height: 38px;
    background: var(--accent);
    border-radius: 4px;
    box-shadow: 0 0 10px var(--glow-success);
}

.noc-time-window-group {
    background-color: var(--secondary);
    padding: 3px;
    border-radius: 50rem;
    border: 1px solid var(--border);
}

.noc-time-btn {
    border-radius: 50rem !important;
    border: none;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    background: transparent;
    transition: all 0.15s ease-in-out;
}

.noc-time-btn:hover {
    color: var(--foreground);
}

.noc-time-btn.active {
    background-color: var(--accent);
    color: #FFFFFF;
    font-weight: 700;
    box-shadow: 0 2px 8px var(--glow-success);
}

/* Alert Banner */
.noc-alert-banner {
    border: 1px solid var(--border);
    transition: all 0.25s ease-in-out;
}

body.light .noc-alert-banner.outage,
[data-theme="light"] .noc-alert-banner.outage {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(254, 242, 242, 0.95) 100%);
    border-color: rgba(239, 68, 68, 0.35);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.08);
}

body.dark .noc-alert-banner.outage,
[data-theme="dark"] .noc-alert-banner.outage {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.18) 0%, rgba(17, 29, 48, 0.95) 100%);
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.12);
}

.noc-alert-banner.outage .alert-icon-box {
    background: rgba(239, 68, 68, 0.2);
    color: #EF4444;
    border: 1px solid rgba(239, 68, 68, 0.35);
    width: 48px;
    height: 48px;
}

.noc-alert-banner.outage .alert-subtext {
    color: var(--muted-foreground);
}

body.light .noc-alert-banner.nominal,
[data-theme="light"] .noc-alert-banner.nominal {
    background: linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(240, 253, 244, 0.95) 100%);
    border-color: rgba(16, 185, 129, 0.35);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.06);
}

body.dark .noc-alert-banner.nominal,
[data-theme="dark"] .noc-alert-banner.nominal {
    background: linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(17, 29, 48, 0.95) 100%);
    border-color: rgba(16, 185, 129, 0.35);
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.08);
}

.noc-alert-banner.nominal .alert-icon-box {
    background: rgba(16, 185, 129, 0.2);
    color: #10B981;
    border: 1px solid rgba(16, 185, 129, 0.35);
    width: 48px;
    height: 48px;
}

.noc-alert-banner.nominal .alert-subtext {
    color: var(--muted-foreground);
}

/* KPI Cards */
.kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
    border-radius: 12px;
    min-height: 124px;
    min-width: 0;
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.kpi-card:hover {
    transform: translateY(-2px);
    border-color: var(--ring);
}

.kpi-icon-box {
    width: 38px;
    height: 38px;
    font-size: 1.05rem;
}

.kpi-blue { background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); }
.kpi-green { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
.kpi-amber { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
.kpi-red { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
.kpi-purple { background: rgba(139, 92, 246, 0.15); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.3); }
.kpi-indigo { background: rgba(99, 102, 241, 0.15); color: #6366F1; border: 1px solid rgba(99, 102, 241, 0.3); }
.kpi-darkblue { background: rgba(30, 58, 138, 0.2); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); }
.kpi-cyan { background: rgba(6, 182, 212, 0.15); color: #06B6D4; border: 1px solid rgba(6, 182, 212, 0.3); }

.kpi-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-bottom: 2px;
}

.kpi-value {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 2px;
}

.kpi-subtext {
    font-size: 0.68rem;
    color: var(--muted-foreground);
}

/* NOC Panels */
.noc-panel {
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
}

.noc-filter-pill {
    background-color: transparent;
    border: 1px solid var(--border);
    color: var(--muted-foreground);
    border-radius: 50rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.65rem;
    transition: all 0.15s ease-in-out;
}

.noc-filter-pill:hover {
    color: var(--foreground);
    border-color: var(--ring);
}

.noc-filter-pill.active {
    background-color: var(--ring);
    border-color: var(--ring);
    color: #FFFFFF;
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
}

.dot-green { background-color: #10B981; box-shadow: 0 0 6px #10B981; }
.dot-red { background-color: #EF4444; box-shadow: 0 0 6px #EF4444; }
.dot-amber { background-color: #F59E0B; box-shadow: 0 0 6px #F59E0B; }

.noc-search-box {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
}

.noc-search-input {
    background: transparent;
    border: none;
    color: var(--input-text);
    outline: none;
    font-size: 0.85rem;
}

.noc-search-input::placeholder {
    color: var(--muted-foreground);
}

/* Target Row */
.target-row {
    background: var(--secondary);
    border: 1px solid var(--border);
    transition: all 0.15s ease-in-out;
}

.target-row:hover {
    background: var(--surface-elevated);
    border-color: var(--ring);
}

.target-icon-circle {
    width: 32px;
    height: 32px;
    background: var(--card);
    border: 1px solid var(--border);
}

.target-name {
    color: var(--foreground);
    font-size: 0.88rem;
}

.target-name:hover {
    color: var(--primary);
}

.target-url {
    font-size: 0.72rem;
    color: var(--muted-foreground);
}

.latency-badge {
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--muted-foreground);
    font-size: 0.75rem;
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
}

/* Status Pills */
.status-pill {
    font-size: 0.72rem;
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    letter-spacing: 0.04em;
}

.status-up {
    background-color: #10B981 !important;
    color: #FFFFFF !important;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

.status-down {
    background-color: #EF4444 !important;
    color: #FFFFFF !important;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
}

.status-warning {
    background-color: #F59E0B !important;
    color: #080F1D !important;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
}

.status-maint {
    background-color: #8B5CF6 !important;
    color: #FFFFFF !important;
}

.status-pending {
    background-color: var(--secondary) !important;
    color: var(--muted-foreground) !important;
    border: 1px solid var(--border);
}

.hover-underline:hover {
    text-decoration: underline !important;
    color: var(--accent) !important;
}

.probe-box {
    background: var(--secondary);
    border: 1px solid var(--border);
}

.interactive-kpi {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.interactive-kpi:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    border-color: var(--accent) !important;
}

.protocol-tag {
    background-color: var(--secondary);
    color: var(--foreground);
    border: 1px solid var(--border);
}

.cursor-pointer {
    cursor: pointer;
}

.hover-row:hover {
    background-color: var(--secondary) !important;
}

.no-arrow::after {
    display: none !important;
}
</style>