<template>
    <div class="noc-topology-page p-2 p-md-4" :class="{ 'fullscreen-mode': isFullscreen }">
        <!-- Top Toolbar -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h4 fw-bold mb-1 text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="project-diagram" class="text-primary" />
                    <span>Fiber NOC & Intelligent Network Topology</span>
                </h1>
                <p class="text-muted small mb-0 font-monospace">
                    The Dude-style network graph, GPON OLT/PON hierarchy, and fiber telemetry for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <div class="d-flex align-items-center gap-2 flex-wrap">
                <!-- View Mode Tabs -->
                <div class="btn-group btn-group-sm" role="group">
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'canvas' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'canvas'"
                    >
                        <font-awesome-icon icon="sitemap" class="me-1" /> Canvas
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'splitters' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'splitters'"
                    >
                        <font-awesome-icon icon="code-branch" class="me-1" /> Splitters ({{ splittersList.length }})
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'cables' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'cables'"
                    >
                        <font-awesome-icon icon="project-diagram" class="me-1" /> Cables ({{ cablesList.length }})
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'closures' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'closures'"
                    >
                        <font-awesome-icon icon="box" class="me-1" /> Closures ({{ closuresList.length }})
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'calculator' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'calculator'"
                    >
                        <font-awesome-icon icon="calculator" class="me-1" /> Loss Budget
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'table' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'table'"
                    >
                        <font-awesome-icon icon="list" class="me-1" /> Links ({{ dependencyList.length }})
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="viewMode === 'faults' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'faults'"
                    >
                        <font-awesome-icon icon="exclamation-triangle" class="me-1" />
                        Faults <span v-if="activeFaults.length > 0" class="badge bg-danger ms-1">{{ activeFaults.length }}</span>
                    </button>
                </div>

                <!-- Map Mode Selector -->
                <select v-model="mapMode" class="form-select form-select-sm bg-surface border-secondary text-foreground" style="width: auto;">
                    <option value="LOGICAL">🗺️ Logical Network Map</option>
                    <option value="FIBER">⚡ Physical Fiber Map</option>
                    <option value="OLT_PON">📡 OLT & PON View</option>
                    <option value="SWITCH">🔀 Switch & Interface View</option>
                    <option value="FAULTS">🚨 Faults & Incident View</option>
                    <option value="PROBES">🛰️ Probe Coverage View</option>
                </select>

                <!-- Action Buttons -->
                <button class="btn btn-sm btn-outline-warning fw-semibold d-flex align-items-center gap-1" title="Arrange in Hierarchical Tiers" @click="autoLayoutNodes">
                    <font-awesome-icon icon="magic" />
                    <span class="d-none d-sm-inline">Auto Layout</span>
                </button>

                <button class="btn btn-sm btn-outline-success fw-semibold d-flex align-items-center gap-1" title="Save Node Coordinates" @click="saveNodePositions">
                    <font-awesome-icon icon="save" />
                    <span class="d-none d-sm-inline">Save</span>
                </button>

                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <font-awesome-icon icon="cog" class="me-1" /> Tools
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end bg-card border-secondary shadow">
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showSplitterModal = true">
                                <font-awesome-icon icon="code-branch" class="me-2 text-warning" /> Add Fiber Splitter
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showCableModal = true">
                                <font-awesome-icon icon="project-diagram" class="me-2 text-info" /> Add Fiber Cable
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showClosureModal = true">
                                <font-awesome-icon icon="box" class="me-2 text-primary" /> Add Splice Closure
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="viewMode = 'calculator'">
                                <font-awesome-icon icon="calculator" class="me-2 text-success" /> Optical Loss Calculator
                            </a>
                        </li>
                        <li><hr class="dropdown-divider border-secondary" /></li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="exportTopologyFile">
                                <font-awesome-icon icon="download" class="me-2 text-info" /> Export Topology JSON
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showImportModal = true">
                                <font-awesome-icon icon="upload" class="me-2 text-success" /> Import Topology JSON
                            </a>
                        </li>
                    </ul>
                </div>

                <button class="btn btn-sm noc-create-btn fw-bold px-3 d-flex align-items-center gap-2 shadow-sm" @click="showAddModal = true">
                    <font-awesome-icon icon="plus-circle" />
                    <span>Add Link</span>
                </button>
            </div>
        </div>

        <!-- Live Fiber Fault HUD Alert Banner (if faults detected) -->
        <div v-if="activeFaults.length > 0" class="alert alert-danger d-flex justify-content-between align-items-center p-2 px-3 mb-3 rounded-3 shadow-sm border border-danger">
            <div class="d-flex align-items-center gap-2">
                <font-awesome-icon icon="exclamation-triangle" class="fs-5 text-danger animate-pulse" />
                <div>
                    <strong class="text-uppercase font-monospace">[{{ activeFaults[0].confidence_level }}] {{ activeFaults[0].fault_category.replace(/_/g, ' ') }}</strong>
                    <span class="ms-2 small text-secondary">{{ activeFaults[0].evidence }}</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-danger fw-bold" @click="viewMode = 'faults'">
                    Inspect Active Faults ({{ activeFaults.length }})
                </button>
            </div>
        </div>

        <!-- Real-Time Operational Health & Synchronization Bar -->
        <div class="topology-health-bar d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded-3 bg-surface border border-secondary shadow-sm flex-wrap gap-2">
            <div class="d-flex align-items-center gap-3 flex-wrap">
                <div class="d-flex align-items-center gap-2">
                    <span class="status-indicator-dot" :class="syncIndicatorClass"></span>
                    <span class="small fw-bold text-foreground">Sync: <span :class="syncStatusText === 'Live' ? 'text-success' : 'text-warning'">{{ syncStatusText }}</span></span>
                    <span class="badge bg-dark text-muted font-monospace small border border-secondary">{{ lastSyncTimeAgo }}</span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="network-wired" class="text-info" />
                    <span>Probes:</span>
                    <strong class="text-foreground">{{ onlineProbeCount }} Online</strong>
                    <span v-if="offlineProbeCount > 0" class="badge bg-danger small ms-1">{{ offlineProbeCount }} Offline</span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="bolt" class="text-warning" />
                    <span>Event Stream:</span>
                    <span class="badge" :class="$root.socket && $root.socket.connected ? 'bg-success' : 'bg-danger'">
                        {{ $root.socket && $root.socket.connected ? 'Connected' : 'Disconnected' }}
                    </span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="check-circle" class="text-success" />
                    <span>Freshness:</span>
                    <span class="text-success fw-bold font-monospace">Verified</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center gap-1" title="Force Reconciliation" @click="loadData">
                    <font-awesome-icon icon="sync-alt" :class="{ 'fa-spin': isRefreshing }" />
                    <span>Reconcile</span>
                </button>
            </div>
        </div>

        <!-- Real-Time Operational Health & Synchronization Bar -->
        <div class="topology-health-bar d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded-3 bg-surface border border-secondary shadow-sm flex-wrap gap-2">
            <div class="d-flex align-items-center gap-3 flex-wrap">
                <div class="d-flex align-items-center gap-2">
                    <span class="status-indicator-dot" :class="syncIndicatorClass"></span>
                    <span class="small fw-bold text-foreground">Sync: <span :class="syncStatusText === 'Live' ? 'text-success' : 'text-warning'">{{ syncStatusText }}</span></span>
                    <span class="badge bg-dark text-muted font-monospace small border border-secondary">{{ lastSyncTimeAgo }}</span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="network-wired" class="text-info" />
                    <span>Probes:</span>
                    <strong class="text-foreground">{{ onlineProbeCount }} Online</strong>
                    <span v-if="offlineProbeCount > 0" class="badge bg-danger small ms-1">{{ offlineProbeCount }} Offline</span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="bolt" class="text-warning" />
                    <span>Event Stream:</span>
                    <span class="badge" :class="$root.socket && $root.socket.connected ? 'bg-success' : 'bg-danger'">
                        {{ $root.socket && $root.socket.connected ? 'Connected' : 'Disconnected' }}
                    </span>
                </div>
                <div class="vr bg-secondary d-none d-sm-block"></div>
                <div class="small text-muted d-flex align-items-center gap-1">
                    <font-awesome-icon icon="check-circle" class="text-success" />
                    <span>Freshness:</span>
                    <span class="text-success fw-bold font-monospace">Verified</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center gap-1" title="Force Reconciliation" @click="loadData">
                    <font-awesome-icon icon="sync-alt" :class="{ 'fa-spin': isRefreshing }" />
                    <span>Reconcile</span>
                </button>
            </div>
        </div>

        <!-- CANVAS VIEW MODE -->
        <div v-show="viewMode === 'canvas'" class="topology-canvas-container position-relative rounded-4 overflow-hidden border border-secondary shadow-sm">
            <!-- Canvas HUD Toolbar (Zoom, Search, Filter) -->
            <div class="canvas-hud d-flex justify-content-between align-items-center p-2 px-3 gap-2 flex-wrap">
                <!-- Search & Type Filter -->
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <div class="input-group input-group-sm" style="width: 220px;">
                        <span class="input-group-text bg-surface border-secondary text-muted">
                            <font-awesome-icon icon="search" />
                        </span>
                        <input
                            v-model="searchQuery"
                            type="text"
                            class="form-control bg-surface border-secondary text-foreground form-control-sm"
                            placeholder="Find device, IP, or OLT..."
                        />
                    </div>

                    <!-- Category Filter Buttons -->
                    <div class="btn-group btn-group-sm">
                        <button
                            v-for="type in ['ALL', 'ROUTER', 'SWITCH', 'OLT', 'SPLITTER', 'SERVER', 'PROBE', 'MONITOR']"
                            :key="type"
                            type="button"
                            class="btn btn-sm"
                            :class="filterType === type ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                            @click="filterType = type"
                        >
                            {{ type }}
                        </button>
                    </div>

                    <!-- Site Selector -->
                    <select v-if="sitesList.length > 0" v-model="selectedSiteId" class="form-select form-select-sm bg-surface border-secondary text-foreground" style="width: auto;">
                        <option :value="null">All Sites</option>
                        <option v-for="s in sitesList" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </div>

                <!-- Zoom & Screen Controls -->
                <div class="d-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-icon btn-outline-secondary" title="Zoom Out" @click="zoomOut">
                        <font-awesome-icon icon="search-minus" />
                    </button>
                    <span class="badge bg-surface border border-secondary text-muted font-monospace px-2 py-1" style="font-size: 0.75rem;">
                        {{ Math.round(zoomLevel * 100) }}%
                    </span>
                    <button class="btn btn-sm btn-icon btn-outline-secondary" title="Zoom In" @click="zoomIn">
                        <font-awesome-icon icon="search-plus" />
                    </button>
                    <button class="btn btn-sm btn-icon btn-outline-secondary" title="Fit to Screen" @click="fitToScreen">
                        <font-awesome-icon icon="expand" />
                    </button>
                    <button class="btn btn-sm btn-icon btn-outline-secondary" title="Reset View" @click="resetView">
                        <font-awesome-icon icon="compress-arrows-alt" />
                    </button>
                    <button class="btn btn-sm btn-icon btn-outline-secondary" title="Toggle Fullscreen" @click="isFullscreen = !isFullscreen">
                        <font-awesome-icon :icon="isFullscreen ? 'compress' : 'expand-arrows-alt'" />
                    </button>
                </div>
            </div>

            <!-- SVG Vector Canvas Area -->
            <div
                ref="canvasViewport"
                class="canvas-viewport"
                @mousedown="handleCanvasMouseDown"
                @mousemove="handleCanvasMouseMove"
                @mouseup="handleCanvasMouseUp"
                @mouseleave="handleCanvasMouseUp"
                @wheel.prevent="handleCanvasWheel"
            >
                <svg
                    class="network-svg-layer"
                    :style="{
                        transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                        transformOrigin: '0 0'
                    }"
                    width="4500"
                    height="3500"
                >
                    <defs>
                        <!-- Grid Pattern Background -->
                        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="20" cy="20" r="1" class="grid-dot" />
                        </pattern>

                        <!-- Marker: Healthy Green Directed Arrow -->
                        <marker id="arrow-healthy" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                        </marker>
                        <!-- Marker: Down Red Directed Arrow -->
                        <marker id="arrow-down" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                        </marker>
                        <!-- Marker: Amber Degraded Arrow -->
                        <marker id="arrow-degraded" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
                        </marker>
                        <!-- Marker: Orange Suspected Cut Arrow -->
                        <marker id="arrow-suspected" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#F97316" />
                        </marker>
                    </defs>

                    <!-- Background Grid Rect -->
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                    <!-- Connection Links Layer -->
                    <g class="links-layer">
                        <g v-for="link in renderedLinks" :key="link.id" class="link-group" @click.stop="selectLink(link)">
                            <path
                                :d="link.path"
                                class="network-link-path"
                                :class="{
                                    'link-healthy': link.status === 'UP',
                                    'link-down': link.status === 'DOWN',
                                    'link-degraded': link.status === 'DEGRADED',
                                    'link-suspected': link.status === 'SUSPECTED',
                                    'is-selected-link': selectedLink && selectedLink.id === link.id,
                                    'link-fiber': link.link_type === 'FIBER',
                                    'link-wireless': link.link_type === 'WIRELESS',
                                    'link-logical': link.link_type === 'LOGICAL'
                                }"
                                :marker-end="getLinkMarker(link.status)"
                            />
                            <!-- Link Label Badge at Midpoint -->
                            <g :transform="`translate(${link.midX}, ${link.midY})`" class="link-midpoint-badge">
                                <rect x="-42" y="-12" width="84" height="24" rx="6" class="link-label-bg" />
                                <text x="0" y="4" text-anchor="middle" class="link-label-text">
                                    {{ link.link_speed || link.dependency_type || '1 Gbps' }}
                                </text>
                            </g>
                        </g>
                    </g>

                    <!-- Device & Splitter Nodes Layer -->
                    <g class="nodes-layer">
                        <g
                            v-for="node in filteredNodes"
                            :key="node.id"
                            class="device-node-group"
                            :class="{
                                'is-selected': selectedNode && selectedNode.id === node.id,
                                'is-highlighted-downstream': highlightedDownstreamIds.includes(node.id),
                                'is-highlighted-upstream': highlightedUpstreamIds.includes(node.id),
                                'is-down': node.status === 'DOWN' || node.status === 'OFFLINE',
                                'is-healthy': node.status === 'UP' || node.status === 'ONLINE',
                                'is-warning': node.status === 'PENDING' || node.status === 'DEGRADED' || node.status === 'WARNING',
                                'is-maintenance': node.status === 'MAINTENANCE' || node.status === 'PAUSED'
                            }"
                            :transform="`translate(${node.x}, ${node.y})`"
                            @mousedown.stop="handleNodeMouseDown($event, node)"
                            @click.stop="selectNode(node)"
                        >
                            <!-- Animated Pulse Glow Ring for Outages -->
                            <circle v-if="node.status === 'DOWN' || node.status === 'OFFLINE'" cx="90" cy="38" r="44" class="outage-pulse-circle" />

                            <!-- Main Node Card Box -->
                            <rect x="0" y="0" width="180" height="76" rx="10" class="node-box" />

                            <!-- Device Icon Badge Container -->
                            <rect x="12" y="14" width="46" height="48" rx="8" class="node-icon-bg" />

                            <!-- Device Icon Placeholder text/symbol -->
                            <text x="35" y="45" text-anchor="middle" class="node-icon-symbol">
                                {{ getNodeIconSymbol(node.type) }}
                            </text>

                            <!-- Status Dot Beacon -->
                            <circle cx="50" cy="20" r="5" class="status-beacon" :class="'beacon-' + getNodeBeaconClass(node.status)" />

                            <!-- Node Info: Name & Target/IP -->
                            <text x="68" y="32" class="node-name-text">
                                {{ truncateText(node.name, 12) }}
                            </text>
                            <text x="68" y="48" class="node-ip-text">
                                {{ node.ip || '127.0.0.1' }}
                            </text>
                            <text x="68" y="63" class="node-type-badge">
                                {{ node.type }}
                            </text>

                            <!-- Latency / Ping Tag -->
                            <g transform="translate(136, 12)">
                                <rect x="0" y="0" width="38" height="16" rx="4" class="ping-pill-bg" />
                                <text x="19" y="11" text-anchor="middle" class="ping-pill-text">
                                    {{ node.ping || '0ms' }}
                                </text>
                            </g>
                        </g>
                    </g>
                </svg>

                <!-- Floating Canvas Minimap / Status Overview (Dude style) -->
                <div class="canvas-legend p-2 px-3 rounded-3 shadow-sm border border-secondary bg-surface position-absolute bottom-0 start-0 m-3">
                    <div class="small fw-bold text-foreground mb-1 d-flex align-items-center gap-3 flex-wrap">
                        <span class="d-inline-flex align-items-center gap-1">
                            <span class="status-indicator-dot dot-green"></span>
                            <span>Online: <strong>{{ onlineNodeCount }}</strong></span>
                        </span>
                        <span class="d-inline-flex align-items-center gap-1">
                            <span class="status-indicator-dot dot-red"></span>
                            <span>Down: <strong>{{ downNodeCount }}</strong></span>
                        </span>
                        <span v-if="warningNodeCount > 0" class="d-inline-flex align-items-center gap-1">
                            <span class="status-indicator-dot dot-amber"></span>
                            <span>Warning: <strong>{{ warningNodeCount }}</strong></span>
                        </span>
                        <span v-if="maintenanceNodeCount > 0" class="d-inline-flex align-items-center gap-1">
                            <span class="status-indicator-dot dot-blue"></span>
                            <span>Maint: <strong>{{ maintenanceNodeCount }}</strong></span>
                        </span>
                        <span v-if="unknownNodeCount > 0" class="d-inline-flex align-items-center gap-1">
                            <span class="status-indicator-dot dot-gray"></span>
                            <span>Unknown: <strong>{{ unknownNodeCount }}</strong></span>
                        </span>
                        <span class="badge bg-secondary font-monospace">
                            Nodes: {{ totalNodeCount }}
                        </span>
                        <span class="badge bg-secondary font-monospace">
                            Links: {{ totalLinkCount }} <span v-if="downLinkCount > 0" class="text-danger fw-bold">({{ downLinkCount }} Down)</span>
                        </span>
                        <span v-if="affectedNodeCount > 0" class="badge bg-danger font-monospace">
                            ⚠️ {{ affectedNodeCount }} Inferred Impacted
                        </span>
                        <span v-if="splittersList.length > 0" class="badge bg-secondary font-monospace">
                            🔱 {{ splittersList.length }} Splitters
                        </span>
                    </div>
                    <div class="text-muted small" style="font-size: 0.68rem;">
                        Total = Online ({{ onlineNodeCount }}) + Down ({{ downNodeCount }})<span v-if="warningNodeCount > 0"> + Warning ({{ warningNodeCount }})</span><span v-if="maintenanceNodeCount > 0"> + Maint ({{ maintenanceNodeCount }})</span><span v-if="unknownNodeCount > 0"> + Unknown ({{ unknownNodeCount }})</span> · Drag nodes to move · Scroll to zoom
                    </div>
                </div>

                <!-- Slide-in Inspector Drawer (Device or Link) -->
                <div v-if="selectedNode || selectedLink" class="node-inspector-drawer position-absolute top-0 end-0 h-100 p-3 bg-surface border-start border-secondary shadow-lg">
                    <!-- Close button -->
                    <div class="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-2">
                        <h6 class="fw-bold mb-0 text-foreground d-flex align-items-center gap-2">
                            <font-awesome-icon :icon="selectedLink ? 'link' : 'info-circle'" class="text-primary" />
                            <span>{{ selectedLink ? 'Fiber Link Inspector' : 'Device Inspector' }}</span>
                        </h6>
                        <button type="button" class="btn-close btn-close-white btn-sm" @click="closeInspector"></button>
                    </div>

                    <!-- IF LINK SELECTED -->
                    <div v-if="selectedLink" class="inspector-content d-flex flex-column gap-3 small">
                        <div class="p-2 rounded bg-card border border-secondary">
                            <div class="fw-bold fs-6 text-foreground text-truncate">
                                {{ selectedLink.parent_name || 'Upstream' }} → {{ selectedLink.child_name || 'Downstream' }}
                            </div>
                            <div class="text-muted font-monospace">{{ selectedLink.link_speed || '1 Gbps' }} · {{ selectedLink.link_type || 'FIBER' }}</div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="badge" :class="selectedLink.status === 'UP' ? 'bg-success' : 'bg-danger'">
                                    {{ selectedLink.status || 'UP' }}
                                </span>
                                <span class="badge bg-secondary font-monospace">{{ selectedLink.relationship_source || 'MANUAL' }}</span>
                            </div>
                        </div>

                        <!-- Link Interfaces & Telemetry -->
                        <div class="p-2 rounded bg-card border border-secondary">
                            <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Interface Endpoints</div>
                            <div class="mb-2">
                                <span class="text-muted d-block small">Source Interface:</span>
                                <span class="text-info fw-bold font-monospace">{{ selectedLink.source_interface || 'Auto (SFP/Port)' }}</span>
                            </div>
                            <div class="mb-2">
                                <span class="text-muted d-block small">Target Interface:</span>
                                <span class="text-warning fw-bold font-monospace">{{ selectedLink.target_interface || 'Auto (Uplink)' }}</span>
                            </div>
                            <div>
                                <span class="text-muted d-block small">Estimated Utilization:</span>
                                <span class="text-success fw-bold font-monospace">{{ selectedLink.traffic_utilization_pct || 0 }}%</span>
                            </div>
                        </div>

                        <!-- Link Actions -->
                        <div class="d-flex flex-column gap-2 mt-auto">
                            <button class="btn btn-sm btn-outline-warning" @click="openEditLinkModal(selectedLink)">
                                <font-awesome-icon icon="edit" class="me-1" /> Edit Link Parameters
                            </button>
                            <button class="btn btn-sm btn-outline-danger" @click="deleteLink(selectedLink.id)">
                                <font-awesome-icon icon="trash" class="me-1" /> Delete Link
                            </button>
                        </div>
                    </div>

                    <!-- IF NODE SELECTED -->
                    <div v-else-if="selectedNode" class="inspector-content d-flex flex-column gap-3 small">
                        <!-- Header identity -->
                        <div class="p-2 rounded bg-card border border-secondary">
                            <div class="fw-bold fs-6 text-foreground text-truncate">{{ selectedNode.name }}</div>
                            <div class="text-muted font-monospace">{{ selectedNode.ip || 'No IP configured' }}</div>
                            <div class="mt-2 d-flex align-items-center gap-2 flex-wrap">
                                <span class="badge" :class="selectedNode.status === 'UP' || selectedNode.status === 'ONLINE' ? 'bg-success' : (selectedNode.status === 'DOWN' || selectedNode.status === 'OFFLINE' ? 'bg-danger' : 'bg-warning text-dark')">
                                    {{ selectedNode.status }}
                                </span>
                                <span class="badge bg-secondary font-monospace">{{ selectedNode.type }}</span>
                                <span v-if="selectedNode.ping" class="badge bg-info font-monospace">{{ selectedNode.ping }}</span>
                                <span v-if="selectedNode.site_name" class="badge bg-dark border border-secondary font-monospace">{{ selectedNode.site_name }}</span>
                            </div>
                        </div>

                        <!-- Inspector Tab Selector -->
                        <div class="btn-group btn-group-sm w-100" role="group">
                            <button
                                type="button"
                                class="btn btn-sm"
                                :class="inspectorTab === 'overview' ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                                @click="inspectorTab = 'overview'"
                            >
                                Overview
                            </button>
                            <button
                                type="button"
                                class="btn btn-sm"
                                :class="inspectorTab === 'telemetry' ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                                @click="inspectorTab = 'telemetry'"
                            >
                                Telemetry
                            </button>
                            <button
                                type="button"
                                class="btn btn-sm"
                                :class="inspectorTab === 'topology' ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                                @click="inspectorTab = 'topology'"
                            >
                                Links
                            </button>
                            <button
                                type="button"
                                class="btn btn-sm"
                                :class="inspectorTab === 'alerts' ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                                @click="inspectorTab = 'alerts'"
                            >
                                Alerts
                            </button>
                        </div>

                        <!-- TAB: OVERVIEW -->
                        <div v-show="inspectorTab === 'overview'" class="d-flex flex-column gap-2">
                            <div class="p-2 rounded bg-card border border-secondary">
                                <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Target Profile</div>
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-muted">Target Host:</span>
                                    <span class="text-foreground font-monospace">{{ selectedNode.ip }}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-muted">Node Category:</span>
                                    <span class="text-info fw-bold">{{ selectedNode.type }}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-muted">Current Latency:</span>
                                    <span class="text-success font-monospace fw-bold">{{ selectedNode.ping || 'N/A' }}</span>
                                </div>
                                <div v-if="selectedNode.last_checked" class="d-flex justify-content-between mb-1">
                                    <span class="text-muted">Last Verified:</span>
                                    <span class="text-foreground font-monospace">{{ selectedNode.last_checked }}</span>
                                </div>
                                <div v-if="selectedNode.probe_id" class="d-flex justify-content-between">
                                    <span class="text-muted">Assigned Probe:</span>
                                    <span class="text-warning font-monospace">Probe #{{ selectedNode.probe_id }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: TELEMETRY -->
                        <div v-show="inspectorTab === 'telemetry'" class="d-flex flex-column gap-2">
                            <div class="p-2 rounded bg-card border border-secondary">
                                <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Active Check Telemetry</div>
                                <div v-if="selectedNode.monitors && selectedNode.monitors.length > 0">
                                    <div v-for="m in selectedNode.monitors" :key="m.id" class="border-bottom border-secondary pb-2 mb-2">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <span class="fw-bold text-foreground">{{ m.name }}</span>
                                            <span class="badge" :class="m.status === 'UP' ? 'bg-success' : (m.status === 'DOWN' ? 'bg-danger' : 'bg-warning text-dark')">
                                                {{ m.status }}
                                            </span>
                                        </div>
                                        <div class="d-flex justify-content-between text-muted small font-monospace">
                                            <span>Type: {{ (m.type || 'PING').toUpperCase() }}</span>
                                            <span>{{ m.ping != null ? Math.round(m.ping) + 'ms' : 'N/A' }}</span>
                                        </div>
                                        <div v-if="m.msg" class="text-secondary small font-monospace mt-1 text-truncate">
                                            {{ m.msg }}
                                        </div>
                                    </div>
                                </div>
                                <div v-else-if="selectedNode.monitor_id" class="text-muted small">
                                    <div class="d-flex justify-content-between mb-1">
                                        <span>Primary Monitor ID:</span>
                                        <span class="font-monospace text-foreground">#{{ selectedNode.monitor_id }}</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-1">
                                        <span>Ping:</span>
                                        <span class="font-monospace text-success">{{ selectedNode.ping }}</span>
                                    </div>
                                </div>
                                <div v-else class="text-muted fst-italic py-2 text-center">
                                    No direct monitor linked (Calculated from Infrastructure)
                                </div>
                            </div>
                        </div>

                        <!-- TAB: TOPOLOGY LINKS -->
                        <div v-show="inspectorTab === 'topology'" class="d-flex flex-column gap-2">
                            <div class="p-2 rounded bg-card border border-secondary">
                                <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Topology Connections</div>
                                <div class="mb-2">
                                    <span class="text-muted d-block small">Upstream Parents:</span>
                                    <div v-if="getNodeParents(selectedNode.id).length === 0" class="text-muted fst-italic">None (Root Core)</div>
                                    <div v-for="p in getNodeParents(selectedNode.id)" :key="p.id" class="text-info fw-bold font-monospace cursor-pointer" @click="selectNode(p)">
                                        ↑ {{ p.name }} ({{ p.type }})
                                    </div>
                                </div>
                                <div>
                                    <span class="text-muted d-block small">Downstream Children:</span>
                                    <div v-if="getNodeChildren(selectedNode.id).length === 0" class="text-muted fst-italic">None (Edge Device)</div>
                                    <div v-for="c in getNodeChildren(selectedNode.id)" :key="c.id" class="text-warning fw-bold font-monospace cursor-pointer" @click="selectNode(c)">
                                        ↓ {{ c.name }} ({{ c.type }})
                                    </div>
                                </div>
                            </div>

                            <!-- Dependency Tracing Buttons -->
                            <div class="p-2 rounded bg-card border border-secondary">
                                <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Fault Impact Tracing</div>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-info flex-fill" @click="traceUpstream(selectedNode.id)">
                                        Trace Upstream
                                    </button>
                                    <button class="btn btn-sm btn-outline-warning flex-fill" @click="traceDownstream(selectedNode.id)">
                                        Trace Impact
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: ALERTS / INCIDENTS -->
                        <div v-show="inspectorTab === 'alerts'" class="d-flex flex-column gap-2">
                            <div class="p-2 rounded bg-card border border-secondary">
                                <div class="text-uppercase fw-bold text-muted mb-2" style="font-size: 0.7rem;">Active Alarms & Incidents</div>
                                <div v-if="activeAlertsList.filter(a => a.target_id === selectedNode.id || a.target_id === selectedNode.monitor_id).length > 0">
                                    <div v-for="a in activeAlertsList.filter(a => a.target_id === selectedNode.id || a.target_id === selectedNode.monitor_id)" :key="a.id" class="alert alert-danger p-2 mb-2 small">
                                        <div class="fw-bold">{{ a.metric || 'Alert' }}: {{ a.state }}</div>
                                        <div class="small">{{ a.message }}</div>
                                    </div>
                                </div>
                                <div v-else class="text-success small py-2 text-center">
                                    <font-awesome-icon icon="check-circle" class="me-1" />
                                    No active alarms for this target
                                </div>
                            </div>
                        </div>

                        <!-- Quick Actions -->
                        <div class="d-flex flex-column gap-2 mt-auto">
                            <!-- OLT Jump Button -->
                            <button
                                v-if="selectedNode.type === 'OLT'"
                                class="btn btn-sm btn-warning text-dark fw-bold"
                                @click="$router.push(`/devices/olt/${selectedNode.id}`)"
                            >
                                <font-awesome-icon icon="server" class="me-1" /> View OLT GPON Telemetry
                            </button>
                            <!-- Switch Interfaces Jump Button -->
                            <button
                                v-if="selectedNode.type === 'SWITCH'"
                                class="btn btn-sm btn-primary fw-bold"
                                @click="$router.push(`/devices/${selectedNode.id}`)"
                            >
                                <font-awesome-icon icon="random" class="me-1" /> View Switch Interfaces
                            </button>
                            <button
                                v-if="selectedNode.monitor_id"
                                class="btn btn-sm btn-primary fw-bold"
                                @click="$router.push(`/dashboard/${selectedNode.monitor_id}`)"
                            >
                                <font-awesome-icon icon="chart-line" class="me-1" /> View Live Telemetry
                            </button>
                            <button
                                v-if="selectedNode.probe_id"
                                class="btn btn-sm btn-info fw-bold text-white"
                                @click="$router.push('/probes')"
                            >
                                <font-awesome-icon icon="network-wired" class="me-1" /> View Probe Details
                            </button>
                            <button class="btn btn-sm btn-outline-warning" @click="showAddModal = true; newDep.parentDeviceId = selectedNode.id">
                                <font-awesome-icon icon="plus" class="me-1" /> Connect Downstream Child
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" @click="centerNodeOnCanvas(selectedNode)">
                                <font-awesome-icon icon="crosshairs" class="me-1" /> Center on Canvas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLE VIEW MODE (Configured Links & Hierarchy) -->
        <div v-show="viewMode === 'table'" class="row g-4">
            <div class="col-12 col-lg-8">
                <div class="noc-section-box p-3">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="project-diagram" />
                        <span>Configured Dependency & Fiber Links</span>
                    </h5>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                                    <th>Upstream Parent</th>
                                    <th>Link Type & Speed</th>
                                    <th>Interfaces</th>
                                    <th>Downstream Child</th>
                                    <th>Status</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="link in dependencyList" :key="link.id">
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="network-wired" class="me-2 text-warning" />
                                        {{ link.parent_name || getDeviceName(link.parent_device_id) }}
                                    </td>
                                    <td>
                                        <span class="badge bg-secondary font-monospace">
                                            {{ link.link_type || 'FIBER' }} · {{ link.link_speed || '1 Gbps' }}
                                        </span>
                                    </td>
                                    <td class="font-monospace small text-muted">
                                        {{ link.source_interface || 'Auto' }} → {{ link.target_interface || 'Auto' }}
                                    </td>
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="desktop" class="me-2 text-info" />
                                        {{ link.child_name || getDeviceName(link.child_device_id) }}
                                    </td>
                                    <td>
                                        <span class="badge" :class="link.status === 'UP' ? 'bg-success' : 'bg-danger'">
                                            {{ link.status || 'UP' }}
                                        </span>
                                    </td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-warning me-1" title="Edit Link" @click="openEditLinkModal(link)">
                                            <font-awesome-icon icon="edit" />
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" title="Remove Link" @click="deleteLink(link.id)">
                                            <font-awesome-icon icon="trash" />
                                        </button>
                                    </td>
                                </tr>
                                <tr v-if="dependencyList.length === 0">
                                    <td colspan="6" class="text-center py-5 text-muted">
                                        <font-awesome-icon icon="sitemap" class="display-3 mb-3 text-secondary" />
                                        <h5>No Dependency Links Configured</h5>
                                        <p class="small text-secondary">Establish parent-child relationships between Core Routers, Switches, OLTs, and Splitters to enable automated alert storm suppression.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-12 col-lg-4">
                <div class="noc-section-box p-3 shadow-sm">
                    <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="shield-alt" />
                        <span>Conservative Alert Storm Prevention</span>
                    </h6>
                    <p class="small text-secondary mb-3">
                        When an upstream core device goes down, InfiniNOC automatically groups all cascading downstream device failures under a single <strong>P1 Root Incident</strong>.
                    </p>
                    <div class="p-2 rounded bg-surface border border-secondary text-foreground small font-monospace">
                        Core Router (Down) <br />
                        └─ Aggregation Switch (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;└─ OLT MA5608T (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ 1:8 Splitter FDC-01 (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ ONUs in LOS (Suppressed)
                    </div>
                </div>
            </div>
        </div>

        <!-- FIBER SPLITTERS VIEW MODE -->
        <div v-show="viewMode === 'splitters'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-warning mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="code-branch" />
                    <span>FTTH Optical Splitter Hierarchy</span>
                </h5>
                <button class="btn btn-sm btn-primary fw-bold" @click="showSplitterModal = true">
                    <font-awesome-icon icon="plus" class="me-1" /> Add Splitter
                </button>
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Splitter Name</th>
                            <th>Ratio</th>
                            <th>Tier Level</th>
                            <th>Parent Splitter</th>
                            <th>Feeding OLT & PON</th>
                            <th>Location / Enclosure</th>
                            <th class="text-center">Port Occupancy</th>
                            <th>Attenuation</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="s in splittersList" :key="s.id">
                            <td class="fw-bold text-foreground">
                                <font-awesome-icon icon="code-branch" class="me-2 text-warning" />
                                {{ s.name }}
                            </td>
                            <td><span class="badge bg-secondary font-monospace">{{ s.splitter_type }}</span></td>
                            <td><span class="badge bg-dark border border-secondary">Tier {{ s.tier_level }}</span></td>
                            <td class="text-info font-monospace">{{ s.parent_splitter_name || 'Root (Direct OLT)' }}</td>
                            <td class="font-monospace text-muted">{{ s.olt_name ? (s.olt_name + ' / ' + (s.pon_port || 'PON')) : 'Unassigned' }}</td>
                            <td>{{ s.location || 'Pole/Chamber' }}</td>
                            <td class="text-center font-monospace">
                                <span class="badge px-2 py-1" :class="(s.available_ports === 0) ? 'bg-danger' : 'bg-success'">
                                    {{ s.used_port_count || 0 }}/{{ s.output_port_count || 8 }} Ports
                                </span>
                            </td>
                            <td>
                                <span class="text-warning font-monospace">{{ s.nominal_loss_db || s.attenuation_db || '10.5' }} dB</span>
                                <span v-if="s.measured_loss_db" class="badge bg-secondary ms-1 small">Actual: {{ s.measured_loss_db }} dB</span>
                            </td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info me-1" title="Visual Port Diagram" @click="openSplitterDiagram(s)">
                                    <font-awesome-icon icon="eye" class="me-1" /> Diagram
                                </button>
                                <button class="btn btn-sm btn-outline-danger" @click="deleteSplitter(s.id)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="splittersList.length === 0">
                            <td colspan="9" class="text-center py-4 text-muted">
                                No fiber splitters configured. Click "Add Splitter" to build your FTTH distribution tree.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- FIBER CABLES & STRANDS VIEW MODE -->
        <div v-show="viewMode === 'cables'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-info mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="project-diagram" />
                    <span>Physical Fiber Cable & TIA-598 Strand Management</span>
                </h5>
                <button class="btn btn-sm btn-info fw-bold" @click="showCableModal = true">
                    <font-awesome-icon icon="plus" class="me-1" /> Add Fiber Cable
                </button>
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Cable Name & ID</th>
                            <th>Type</th>
                            <th>Length</th>
                            <th>Strands (Used/Total)</th>
                            <th>Attenuation</th>
                            <th>Source Endpoint</th>
                            <th>Target Endpoint</th>
                            <th>Status</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="c in cablesList" :key="c.id">
                            <td class="fw-bold text-foreground">
                                <font-awesome-icon icon="project-diagram" class="me-2 text-info" />
                                {{ c.name }}
                                <div class="small text-muted font-monospace">{{ c.cable_identifier || ('CBL-' + c.id) }}</div>
                            </td>
                            <td><span class="badge bg-dark border border-secondary">{{ c.cable_type }}</span></td>
                            <td class="font-monospace">{{ c.cable_length_meters ? (c.cable_length_meters >= 1000 ? (c.cable_length_meters / 1000).toFixed(2) + ' km' : c.cable_length_meters + ' m') : '1.0 km' }}</td>
                            <td>
                                <span class="badge px-2 py-1" :class="(c.available_strands === 0) ? 'bg-danger' : 'bg-success'">
                                    {{ c.used_strands || 0 }} / {{ c.strand_count || 12 }} Strands
                                </span>
                            </td>
                            <td class="font-monospace text-muted">{{ c.attenuation_db_per_km || 0.35 }} dB/km</td>
                            <td class="font-monospace small text-primary">{{ c.source_label || c.source_type || 'Core OLT' }}</td>
                            <td class="font-monospace small text-warning">{{ c.target_label || c.target_type || 'FDC Cabinet' }}</td>
                            <td><span class="badge" :class="c.status === 'ACTIVE' ? 'bg-success' : 'bg-warning'">{{ c.status }}</span></td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info me-1" title="Inspect TIA-598 Color Strands" @click="openStrandsModal(c)">
                                    <font-awesome-icon icon="palette" class="me-1" /> Strands
                                </button>
                                <button class="btn btn-sm btn-outline-danger" @click="deleteCable(c.id)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="cablesList.length === 0">
                            <td colspan="9" class="text-center py-4 text-muted">
                                No physical fiber cables configured. Click "Add Fiber Cable" to register feeder, distribution, and drop cables.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- SPLICE CLOSURES & CABINETS VIEW MODE -->
        <div v-show="viewMode === 'closures'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="box" />
                    <span>Splice Closures, FDC Hubs & Fiber Access Terminals</span>
                </h5>
                <button class="btn btn-sm btn-primary fw-bold" @click="showClosureModal = true">
                    <font-awesome-icon icon="plus" class="me-1" /> Add Splice Closure
                </button>
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Closure Name</th>
                            <th>Type</th>
                            <th>Location / Coordinates</th>
                            <th>Trays</th>
                            <th>Splice Capacity</th>
                            <th>Utilization</th>
                            <th>Status</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="cl in closuresList" :key="cl.id">
                            <td class="fw-bold text-foreground">
                                <font-awesome-icon icon="box" class="me-2 text-primary" />
                                {{ cl.name }}
                                <div class="small text-muted font-monospace">{{ cl.closure_identifier || ('CLS-' + cl.id) }}</div>
                            </td>
                            <td><span class="badge bg-secondary">{{ cl.closure_type }}</span></td>
                            <td>{{ cl.location || 'Pole/Pedestal' }}</td>
                            <td>{{ cl.tray_capacity || 4 }} Trays</td>
                            <td class="font-monospace">{{ cl.used_splice_capacity || 0 }} / {{ cl.total_splice_capacity || 48 }} Splices</td>
                            <td style="width: 160px;">
                                <div class="progress" style="height: 8px;">
                                    <div
                                        class="progress-bar bg-primary"
                                        role="progressbar"
                                        :style="{ width: ((cl.used_splice_capacity || 0) / (cl.total_splice_capacity || 48) * 100) + '%' }"
                                    ></div>
                                </div>
                            </td>
                            <td><span class="badge" :class="cl.status === 'ACTIVE' ? 'bg-success' : 'bg-warning'">{{ cl.status }}</span></td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-primary me-1" title="Perform Fusion Splice" @click="openSpliceModal(cl)">
                                    <font-awesome-icon icon="bolt" class="me-1" /> Splice
                                </button>
                            </td>
                        </tr>
                        <tr v-if="closuresList.length === 0">
                            <td colspan="8" class="text-center py-4 text-muted">
                                No splice closures or FDC cabinets registered. Click "Add Splice Closure" to configure outdoor junction enclosures.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- OPTICAL LOSS BUDGET & POWER CALCULATOR VIEW MODE -->
        <div v-show="viewMode === 'calculator'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="calculator" />
                    <span>Optical Power & Link Loss Budget Calculator</span>
                </h5>
                <span class="badge bg-success font-monospace px-3 py-2">ITU-T G.984 GPON Standard</span>
            </div>

            <div class="row g-3">
                <!-- Calculator Inputs -->
                <div class="col-lg-5">
                    <div class="p-3 border border-secondary rounded-3 bg-surface">
                        <h6 class="fw-bold text-uppercase small text-secondary mb-3">Physical Path Parameters</h6>

                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label small fw-bold">Wavelength</label>
                                <select v-model="opticalCalc.wavelength" class="form-select form-select-sm noc-input" @change="runOpticalCalculation">
                                    <option value="1310">1310 nm Upstream (0.35 dB/km)</option>
                                    <option value="1490">1490 nm Downstream (0.22 dB/km)</option>
                                    <option value="1550">1550 nm Video / Overlay (0.20 dB/km)</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label small fw-bold">Fiber Run Length (km)</label>
                                <input v-model.number="opticalCalc.cableLengthKm" type="number" step="0.1" class="form-control form-control-sm noc-input" @input="runOpticalCalculation" />
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label small fw-bold">Primary Split Ratio</label>
                                <select v-model="opticalCalc.primarySplitRatio" class="form-select form-select-sm noc-input" @change="runOpticalCalculation">
                                    <option value="1:2">1:2 (3.5 dB)</option>
                                    <option value="1:4">1:4 (7.2 dB)</option>
                                    <option value="1:8">1:8 (10.5 dB)</option>
                                    <option value="1:16">1:16 (13.8 dB)</option>
                                    <option value="1:32">1:32 (17.1 dB)</option>
                                    <option value="1:64">1:64 (20.5 dB)</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label small fw-bold">Cascaded Secondary Splitter</label>
                                <select v-model="opticalCalc.secondarySplitRatio" class="form-select form-select-sm noc-input" @change="runOpticalCalculation">
                                    <option :value="null">None (Single Tier)</option>
                                    <option value="1:2">1:2 (3.5 dB)</option>
                                    <option value="1:4">1:4 (7.2 dB)</option>
                                    <option value="1:8">1:8 (10.5 dB)</option>
                                    <option value="1:16">1:16 (13.8 dB)</option>
                                </select>
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label small fw-bold">Mated Connectors (Pairs)</label>
                                <input v-model.number="opticalCalc.connectorCount" type="number" class="form-control form-control-sm noc-input" @input="runOpticalCalculation" />
                            </div>
                            <div class="col-6">
                                <label class="form-label small fw-bold">Fusion Splices</label>
                                <input v-model.number="opticalCalc.spliceCount" type="number" class="form-control form-control-sm noc-input" @input="runOpticalCalculation" />
                            </div>
                        </div>

                        <div class="row g-2">
                            <div class="col-6">
                                <label class="form-label small fw-bold">OLT Launch Power (dBm)</label>
                                <input v-model.number="opticalCalc.oltTxPowerDbm" type="number" step="0.1" class="form-control form-control-sm noc-input" @input="runOpticalCalculation" />
                            </div>
                            <div class="col-6">
                                <label class="form-label small fw-bold">ONU Sensitivity (dBm)</label>
                                <input v-model.number="opticalCalc.onuSensitivityDbm" type="number" step="0.1" class="form-control form-control-sm noc-input" @input="runOpticalCalculation" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Calculation Results Output -->
                <div class="col-lg-7">
                    <div v-if="opticalCalc.result" class="p-3 border border-secondary rounded-3 bg-surface h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="fw-bold text-uppercase small text-secondary mb-0">Calculated Link Budget Results</h6>
                                <span
                                    class="badge px-3 py-2 fw-bold"
                                    :class="opticalCalc.result.budgetStatus === 'PASS_OPTIMAL' ? 'bg-success' : (opticalCalc.result.budgetStatus === 'PASS_MARGINAL' ? 'bg-warning text-dark' : 'bg-danger')"
                                >
                                    {{ opticalCalc.result.budgetStatus.replace(/_/g, ' ') }}
                                </span>
                            </div>

                            <div class="row g-2 text-center mb-3">
                                <div class="col-4">
                                    <div class="p-2 border border-secondary rounded bg-card">
                                        <div class="text-secondary small">Total Path Loss</div>
                                        <div class="fs-4 fw-bold text-warning font-monospace">{{ opticalCalc.result.totalEstimatedLossDb }} dB</div>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="p-2 border border-secondary rounded bg-card">
                                        <div class="text-secondary small">Expected Rx Power</div>
                                        <div class="fs-4 fw-bold font-monospace" :class="opticalCalc.result.expectedRxPowerDbm < -27 ? 'text-danger' : 'text-success'">
                                            {{ opticalCalc.result.expectedRxPowerDbm }} dBm
                                        </div>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="p-2 border border-secondary rounded bg-card">
                                        <div class="text-secondary small">Power Margin</div>
                                        <div class="fs-4 fw-bold font-monospace text-info">{{ opticalCalc.result.opticalPowerMarginDb }} dB</div>
                                    </div>
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="table table-sm table-bordered text-foreground small font-monospace mb-2">
                                    <tbody>
                                        <tr>
                                            <td class="text-secondary">Fiber Cable Attenuation ({{ opticalCalc.result.cableLengthKm }} km @ {{ opticalCalc.result.wavelengthNm }}nm)</td>
                                            <td class="text-end fw-bold">{{ opticalCalc.result.fiberLossDb }} dB</td>
                                        </tr>
                                        <tr>
                                            <td class="text-secondary">Splitters Insertion Loss ({{ opticalCalc.result.primarySplitRatio }} {{ opticalCalc.result.secondarySplitRatio ? '+ ' + opticalCalc.result.secondarySplitRatio : '' }})</td>
                                            <td class="text-end fw-bold">{{ opticalCalc.result.totalSplitterLossDb }} dB</td>
                                        </tr>
                                        <tr>
                                            <td class="text-secondary">Connector Losses ({{ opticalCalc.result.connectorCount }} mated pairs)</td>
                                            <td class="text-end fw-bold">{{ opticalCalc.result.totalConnectorLossDb }} dB</td>
                                        </tr>
                                        <tr>
                                            <td class="text-secondary">Fusion Splice Losses ({{ opticalCalc.result.spliceCount }} splices)</td>
                                            <td class="text-end fw-bold">{{ opticalCalc.result.totalSpliceLossDb }} dB</td>
                                        </tr>
                                        <tr>
                                            <td class="text-secondary">Safety Engineering Buffer</td>
                                            <td class="text-end fw-bold">{{ opticalCalc.result.safetyMarginDb }} dB</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="p-2 px-3 rounded bg-card border border-secondary text-secondary small">
                            <font-awesome-icon icon="info-circle" class="me-1 text-info" />
                            <strong>Engineering Guidance:</strong> {{ opticalCalc.result.recommendation }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- FIBER FAULTS & INCIDENTS VIEW MODE -->
        <div v-show="viewMode === 'faults'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="exclamation-triangle" />
                    <span>Intelligent Fiber Faults & Cut Intelligence</span>
                </h5>
                <button class="btn btn-sm btn-outline-primary fw-bold" @click="triggerFaultAnalysis">
                    <font-awesome-icon icon="sync" class="me-1" /> Re-analyze Telemetry
                </button>
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Confidence</th>
                            <th>Fault Category</th>
                            <th>Affected Equipment</th>
                            <th>Evidence & Correlation</th>
                            <th>Probable Location</th>
                            <th>Affected ONUs</th>
                            <th>Detection Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="f in activeFaults" :key="f.id">
                            <td>
                                <span class="badge" :class="f.confidence_level === 'CONFIRMED' ? 'bg-danger' : (f.confidence_level === 'PROBABLE' ? 'bg-warning text-dark' : 'bg-secondary')">
                                    {{ f.confidence_level }}
                                </span>
                            </td>
                            <td class="fw-bold text-danger">{{ f.fault_category.replace(/_/g, ' ') }}</td>
                            <td class="font-monospace text-foreground">{{ f.olt_name ? (f.olt_name + (f.pon_port ? ' / ' + f.pon_port : '')) : 'Core Network' }}</td>
                            <td class="small text-secondary" style="max-width: 320px;">{{ f.evidence }}</td>
                            <td class="text-warning small font-monospace">{{ f.probable_location || 'Field Distribution' }}</td>
                            <td><span class="badge bg-danger">{{ f.affected_onus_count }} ONUs</span></td>
                            <td class="small text-muted">{{ f.detected_at }}</td>
                        </tr>
                        <tr v-if="activeFaults.length === 0">
                            <td colspan="7" class="text-center py-5 text-muted">
                                <font-awesome-icon icon="check-circle" class="display-4 mb-2 text-success" />
                                <h5>All Fiber Paths Healthy</h5>
                                <p class="small text-secondary">No physical fiber breaks, multi-ONU LOS clusters, or optical degradation detected.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal: Add Dependency Link -->
        <div v-if="showAddModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="sitemap" />
                            <span>Add Network Link / Dependency</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showAddModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">
                                Upstream Parent Device <span class="text-danger">*</span>
                            </label>
                            <select v-model="newDep.parentDeviceId" class="form-select noc-input" required>
                                <option :value="null" disabled>-- Select Upstream Device --</option>
                                <option v-for="d in selectableDevices" :key="'p-' + d.id" :value="d.id">
                                    {{ d.name }} ({{ d.ip }} - {{ d.type }})
                                </option>
                            </select>
                            <div class="form-text text-muted small">Select feeding core router, aggregation switch, or OLT.</div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Type</label>
                                <select v-model="newDep.linkType" class="form-select noc-input">
                                    <option value="FIBER">Fiber Optic (Single-Mode)</option>
                                    <option value="ETHERNET">Copper Ethernet (Cat6A)</option>
                                    <option value="WIRELESS">Wireless PtP Link</option>
                                    <option value="LOGICAL">Logical / Tunnel / MPLS</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Speed</label>
                                <select v-model="newDep.linkSpeed" class="form-select noc-input">
                                    <option value="1 Gbps">1 Gbps</option>
                                    <option value="10 Gbps">10 Gbps SFP+</option>
                                    <option value="25 Gbps">25 Gbps SFP28</option>
                                    <option value="40 Gbps">40 Gbps QSFP+</option>
                                    <option value="100 Gbps">100 Gbps QSFP28</option>
                                    <option value="GPON 2.5G/1.25G">GPON 2.5G/1.25G</option>
                                </select>
                            </div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Source Interface</label>
                                <input v-model="newDep.sourceInterface" type="text" class="form-control noc-input" placeholder="e.g. xe-0/0/1, SFP+1" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Target Interface</label>
                                <input v-model="newDep.targetInterface" type="text" class="form-control noc-input" placeholder="e.g. eth0, uplink-1" />
                            </div>
                        </div>
                        <div>
                            <label class="form-label text-foreground small fw-bold text-uppercase">
                                Downstream Child Device <span class="text-danger">*</span>
                            </label>
                            <select v-model="newDep.childDeviceId" class="form-select noc-input" required>
                                <option :value="null" disabled>-- Select Downstream Device --</option>
                                <option v-for="d in selectableDevices" :key="'c-' + d.id" :value="d.id">
                                    {{ d.name }} ({{ d.ip }} - {{ d.type }})
                                </option>
                            </select>
                            <div class="form-text text-muted small">Select subordinate switch, OLT, probe, or edge device.</div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAddModal = false">Cancel</button>
                        <button
                            type="button"
                            class="btn noc-create-btn px-4 fw-bold"
                            :disabled="!isValidDependency"
                            @click="saveDependency"
                        >
                            Establish Link
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Edit Dependency Link -->
        <div v-if="showEditLinkModal && editingLink" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="edit" />
                            <span>Edit Link Parameters</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showEditLinkModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Type</label>
                                <select v-model="editingLink.link_type" class="form-select noc-input">
                                    <option value="FIBER">Fiber Optic</option>
                                    <option value="ETHERNET">Copper Ethernet</option>
                                    <option value="WIRELESS">Wireless PtP</option>
                                    <option value="LOGICAL">Logical / Tunnel</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Speed</label>
                                <select v-model="editingLink.link_speed" class="form-select noc-input">
                                    <option value="1 Gbps">1 Gbps</option>
                                    <option value="10 Gbps">10 Gbps SFP+</option>
                                    <option value="25 Gbps">25 Gbps SFP28</option>
                                    <option value="100 Gbps">100 Gbps QSFP28</option>
                                    <option value="GPON 2.5G/1.25G">GPON 2.5G/1.25G</option>
                                </select>
                            </div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Source Interface</label>
                                <input v-model="editingLink.source_interface" type="text" class="form-control noc-input" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Target Interface</label>
                                <input v-model="editingLink.target_interface" type="text" class="form-control noc-input" />
                            </div>
                        </div>
                        <div>
                            <label class="form-label text-foreground small fw-bold text-uppercase">Operational Status</label>
                            <select v-model="editingLink.status" class="form-select noc-input">
                                <option value="UP">UP (Healthy)</option>
                                <option value="DOWN">DOWN (Failed)</option>
                                <option value="DEGRADED">DEGRADED (High Latency / Loss)</option>
                                <option value="SUSPECTED">SUSPECTED (Suspected Fault)</option>
                                <option value="MAINTENANCE">MAINTENANCE</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showEditLinkModal = false">Cancel</button>
                        <button type="button" class="btn btn-primary px-4 fw-bold" @click="saveEditedLink">
                            Update Link
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Fiber Splitter -->
        <div v-if="showSplitterModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="code-branch" />
                            <span>Add FTTH Fiber Splitter</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showSplitterModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Splitter Name</label>
                            <input v-model="newSplitter.name" type="text" class="form-control noc-input" placeholder="e.g. FDC-Splitter-01" />
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Ratio</label>
                                <select v-model="newSplitter.splitter_type" class="form-select noc-input">
                                    <option value="1:2">1:2 (3.5 dB)</option>
                                    <option value="1:4">1:4 (6.5 dB)</option>
                                    <option value="1:8">1:8 (10.5 dB)</option>
                                    <option value="1:16">1:16 (13.5 dB)</option>
                                    <option value="1:32">1:32 (16.5 dB)</option>
                                    <option value="1:64">1:64 (20.5 dB)</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Tier Level</label>
                                <select v-model="newSplitter.tier_level" class="form-select noc-input">
                                    <option :value="1">Tier 1 (FDC Primary)</option>
                                    <option :value="2">Tier 2 (FAT Distribution)</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Location / Enclosure</label>
                            <input v-model="newSplitter.location" type="text" class="form-control noc-input" placeholder="e.g. Sector 4 Junction Box" />
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showSplitterModal = false">Cancel</button>
                        <button type="button" class="btn noc-create-btn px-4 fw-bold" :disabled="!newSplitter.name" @click="saveSplitter">
                            Save Splitter
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Import Topology JSON -->
        <div v-if="showImportModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-success d-flex align-items-center gap-2">
                            <font-awesome-icon icon="upload" />
                            <span>Import Network Topology</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showImportModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <p class="small text-secondary mb-2">Paste topology JSON export payload below:</p>
                        <textarea v-model="importJsonText" class="form-control noc-input font-monospace small" rows="8" placeholder='{"version": "1.0", "links": [...]}'></textarea>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showImportModal = false">Cancel</button>
                        <button type="button" class="btn btn-success px-4 fw-bold" :disabled="!importJsonText" @click="submitImportTopology">
                            Import Links
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Visual Splitter Port Diagram -->
        <div v-if="showSplitterDiagramModal && activeSplitterDetail" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <font-awesome-icon icon="code-branch" class="text-warning fs-5" />
                            <div>
                                <h5 class="modal-title fw-bold text-foreground mb-0">
                                    {{ activeSplitterDetail.name }}
                                </h5>
                                <div class="small text-muted font-monospace">
                                    Ratio: {{ activeSplitterDetail.splitter_type }} | Tier {{ activeSplitterDetail.tier_level }} | Nom Loss: {{ activeSplitterDetail.nominal_loss_db || '10.5' }} dB
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" @click="showSplitterDiagramModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <!-- Optical Schematic Block -->
                        <div class="p-3 mb-4 rounded-3 bg-surface border border-secondary">
                            <div class="text-uppercase small fw-bold text-secondary mb-2">Optical Feeder & Branch Schematic</div>
                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                <div class="p-2 px-3 rounded bg-dark border border-secondary font-monospace small">
                                    <span class="text-muted">FEEDER IN:</span>
                                    <strong class="text-success ms-1">{{ activeSplitterDetail.parent_splitter_name || activeSplitterDetail.olt_name || 'Core OLT Port' }}</strong>
                                </div>
                                <font-awesome-icon icon="arrow-right" class="text-muted" />
                                <div class="p-2 px-3 rounded bg-primary text-white font-monospace small fw-bold">
                                    PLC Splitter Box ({{ activeSplitterDetail.splitter_type }})
                                </div>
                                <font-awesome-icon icon="arrow-right" class="text-muted" />
                                <div class="small text-secondary">
                                    <strong>{{ (activeSplitterDetail.ports || []).filter(p => p.port_status === 'CONNECTED').length }}</strong> of <strong>{{ activeSplitterDetail.output_port_count || 8 }}</strong> output ports in service
                                </div>
                            </div>
                        </div>

                        <!-- Ports Matrix Grid -->
                        <h6 class="fw-bold text-uppercase small text-secondary mb-3">Output Distribution Ports (OUT-1 to OUT-{{ activeSplitterDetail.output_port_count || 8 }})</h6>
                        <div class="row g-2">
                            <div
                                v-for="port in (activeSplitterDetail.ports || [])"
                                :key="port.id"
                                class="col-md-6 col-lg-3"
                            >
                                <div
                                    class="p-2 rounded-3 border h-100 d-flex flex-column justify-content-between"
                                    :class="port.port_status === 'CONNECTED' ? 'border-primary bg-card' : (port.port_status === 'FAULTY' ? 'border-danger bg-danger-subtle' : 'border-secondary bg-surface')"
                                >
                                    <div>
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <span class="font-monospace fw-bold small text-foreground">{{ port.port_identifier }}</span>
                                            <span
                                                class="badge font-monospace"
                                                :class="port.port_status === 'CONNECTED' ? 'bg-primary' : (port.port_status === 'AVAILABLE' ? 'bg-success' : 'bg-secondary')"
                                                style="font-size: 0.7rem;"
                                            >
                                                {{ port.port_status }}
                                            </span>
                                        </div>
                                        <div class="small text-truncate mb-2" :title="port.connected_entity_name || 'Available'">
                                            <font-awesome-icon icon="plug" class="me-1 small text-muted" />
                                            <span v-if="port.port_status === 'CONNECTED'" class="text-info fw-semibold">{{ port.connected_entity_name || port.connected_entity_type }}</span>
                                            <span v-else class="text-muted fst-italic">Unconnected</span>
                                        </div>
                                        <div v-if="port.measured_loss_db" class="small text-warning font-monospace mb-2">
                                            {{ port.measured_loss_db }} dB
                                        </div>
                                    </div>
                                    <div class="mt-2 pt-2 border-top border-secondary d-flex justify-content-between align-items-center">
                                        <button
                                            v-if="port.port_status === 'AVAILABLE'"
                                            class="btn btn-xs btn-outline-success w-100 py-1 font-monospace"
                                            style="font-size: 0.75rem;"
                                            @click="openConnectPortModal(port)"
                                        >
                                            Connect
                                        </button>
                                        <button
                                            v-else-if="port.port_status === 'CONNECTED'"
                                            class="btn btn-xs btn-outline-danger w-100 py-1 font-monospace"
                                            style="font-size: 0.75rem;"
                                            @click="disconnectPort(port.id)"
                                        >
                                            Disconnect
                                        </button>
                                        <span v-else class="badge bg-secondary w-100 text-center">{{ port.port_status }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-4" @click="showSplitterDiagramModal = false">Close</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Connect Splitter Port -->
        <div v-if="showConnectPortModal && selectedPortForConnect" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-success d-flex align-items-center gap-2">
                            <font-awesome-icon icon="plug" />
                            <span>Connect Port {{ selectedPortForConnect.port_identifier }}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showConnectPortModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Connected Entity Type</label>
                            <select v-model="newPortConnect.connected_entity_type" class="form-select noc-input">
                                <option value="ONU">Subscriber ONU / ONT</option>
                                <option value="SPLITTER">Cascaded Tier-2 Splitter</option>
                                <option value="DROP_CABLE">Customer Drop Cable</option>
                                <option value="FDB">Fiber Distribution Box</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">
                                Connected Entity Name / Subscriber ID <span class="text-danger">*</span>
                            </label>
                            <input v-model="newPortConnect.connected_entity_name" type="text" class="form-control noc-input" placeholder="e.g. ONT-SUB-1082 or FAT-04-In" required />
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Measured Insertion Loss (dB)</label>
                            <input v-model.number="newPortConnect.measured_loss_db" type="number" step="0.1" class="form-control noc-input" placeholder="e.g. 10.4" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Notes / Circuit ID</label>
                            <input v-model="newPortConnect.notes" type="text" class="form-control noc-input" placeholder="e.g. Circuit #4812 - 100Mbps FTTH" />
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showConnectPortModal = false">Cancel</button>
                        <button type="button" class="btn btn-success px-4 fw-bold" :disabled="!newPortConnect.connected_entity_name" @click="submitConnectPort">
                            Complete Connection
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Fiber Cable -->
        <div v-if="showCableModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-info d-flex align-items-center gap-2">
                            <font-awesome-icon icon="project-diagram" />
                            <span>Add Physical Fiber Cable</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCableModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">
                                Cable Name <span class="text-danger">*</span>
                            </label>
                            <input v-model="newCable.name" type="text" class="form-control noc-input" placeholder="e.g. Feeder Cable Ring North" required />
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Cable Identifier</label>
                                <input v-model="newCable.cable_identifier" type="text" class="form-control noc-input" placeholder="e.g. FDR-CBL-01" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Cable Type</label>
                                <select v-model="newCable.cable_type" class="form-select noc-input">
                                    <option value="BACKBONE">Backbone Trunk</option>
                                    <option value="FEEDER">Feeder Ring</option>
                                    <option value="DISTRIBUTION">Distribution Branch</option>
                                    <option value="DROP">Drop Cable</option>
                                </select>
                            </div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Strand Count</label>
                                <select v-model.number="newCable.strand_count" class="form-select noc-input">
                                    <option :value="4">4 Strands</option>
                                    <option :value="8">8 Strands</option>
                                    <option :value="12">12 Strands</option>
                                    <option :value="24">24 Strands</option>
                                    <option :value="48">48 Strands</option>
                                    <option :value="96">96 Strands</option>
                                    <option :value="144">144 Strands</option>
                                    <option :value="288">288 Strands</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Length (Meters)</label>
                                <input v-model.number="newCable.cable_length_meters" type="number" class="form-control noc-input" placeholder="e.g. 1500" />
                            </div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Source Endpoint</label>
                                <input v-model="newCable.source_label" type="text" class="form-control noc-input" placeholder="e.g. Central Office OLT" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Target Endpoint</label>
                                <input v-model="newCable.target_label" type="text" class="form-control noc-input" placeholder="e.g. FDC Hub #01" />
                            </div>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Installation Type</label>
                                <select v-model="newCable.installation_type" class="form-select noc-input">
                                    <option value="AERIAL">Aerial / ADSS</option>
                                    <option value="UNDERGROUND">Underground Duct</option>
                                    <option value="DIRECT_BURIED">Direct Buried (Armored)</option>
                                    <option value="INDOOR">Indoor Riser</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Attenuation (dB/km)</label>
                                <input v-model.number="newCable.attenuation_db_per_km" type="number" step="0.01" class="form-control noc-input" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCableModal = false">Cancel</button>
                        <button type="button" class="btn btn-info px-4 fw-bold" :disabled="!newCable.name" @click="saveCable">
                            Save Cable
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: TIA-598 Color Strands Inspector -->
        <div v-if="showStrandsModal && activeCableDetail" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <font-awesome-icon icon="palette" class="text-info fs-5" />
                            <div>
                                <h5 class="modal-title fw-bold text-foreground mb-0">
                                    {{ activeCableDetail.name }} Strands
                                </h5>
                                <div class="small text-muted font-monospace">
                                    TIA-598 Standard 12-Color Sequence | {{ (activeCableDetail.strands || []).length }} Strands
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" @click="showStrandsModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0 small">
                                <thead>
                                    <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                                        <th>#</th>
                                        <th>TIA-598 Color</th>
                                        <th>Strand Identifier</th>
                                        <th>Status</th>
                                        <th>Allocated Circuit / Target</th>
                                        <th>Wavelength</th>
                                        <th class="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="st in (activeCableDetail.strands || [])" :key="st.id">
                                        <td class="font-monospace fw-bold">{{ st.strand_number }}</td>
                                        <td>
                                            <span class="d-inline-flex align-items-center gap-2">
                                                <span
                                                    class="d-inline-block rounded-circle border border-dark"
                                                    :style="{ width: '14px', height: '14px', backgroundColor: st.color_hex || '#0055A5' }"
                                                ></span>
                                                <strong class="font-monospace">{{ st.color_name }}</strong>
                                            </span>
                                        </td>
                                        <td class="font-monospace text-muted">{{ st.strand_identifier }}</td>
                                        <td>
                                            <span
                                                class="badge font-monospace"
                                                :class="st.status === 'ACTIVE' ? 'bg-success' : (st.status === 'AVAILABLE' ? 'bg-primary' : (st.status === 'RESERVED' ? 'bg-warning text-dark' : 'bg-danger'))"
                                            >
                                                {{ st.status }}
                                            </span>
                                        </td>
                                        <td class="font-monospace text-info">{{ st.destination_point || 'None (Dark Fiber)' }}</td>
                                        <td class="font-monospace text-muted">{{ st.operating_wavelength || 1490 }} nm</td>
                                        <td class="text-end">
                                            <button
                                                v-if="st.status === 'AVAILABLE'"
                                                class="btn btn-xs btn-outline-success font-monospace px-2 py-0"
                                                @click="allocateStrand(st, 'ACTIVE')"
                                            >
                                                Activate
                                            </button>
                                            <button
                                                v-else-if="st.status === 'ACTIVE'"
                                                class="btn btn-xs btn-outline-secondary font-monospace px-2 py-0"
                                                @click="allocateStrand(st, 'AVAILABLE')"
                                            >
                                                Release
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-4" @click="showStrandsModal = false">Close</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Splice Closure -->
        <div v-if="showClosureModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center gap-2">
                            <font-awesome-icon icon="box" />
                            <span>Add Splice Closure / FDC Cabinet</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showClosureModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">
                                Closure Name <span class="text-danger">*</span>
                            </label>
                            <input v-model="newClosure.name" type="text" class="form-control noc-input" placeholder="e.g. FDC Hub North Sector" required />
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Identifier</label>
                                <input v-model="newClosure.closure_identifier" type="text" class="form-control noc-input" placeholder="e.g. FDC-01" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Closure Type</label>
                                <select v-model="newClosure.closure_type" class="form-select noc-input">
                                    <option value="FDC">Fiber Distribution Cabinet (FDC)</option>
                                    <option value="FAT">Fiber Access Terminal (FAT)</option>
                                    <option value="FDB">Fiber Distribution Box (FDB)</option>
                                    <option value="SPLICE_CLOSURE">Outdoor Splice Closure (Dome/Inline)</option>
                                    <option value="PATCH_PANEL">Patch Panel (ODF)</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Physical Location / Pole / Chamber</label>
                            <input v-model="newClosure.location" type="text" class="form-control noc-input" placeholder="e.g. Corner 5th & Main Pole #42" />
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Tray Capacity</label>
                                <input v-model.number="newClosure.tray_capacity" type="number" class="form-control noc-input" placeholder="4" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Splice Capacity</label>
                                <input v-model.number="newClosure.total_splice_capacity" type="number" class="form-control noc-input" placeholder="48" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showClosureModal = false">Cancel</button>
                        <button type="button" class="btn btn-primary px-4 fw-bold" :disabled="!newClosure.name" @click="saveClosure">
                            Save Splice Closure
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Perform Fusion Splice -->
        <div v-if="showSpliceModal && activeClosureDetail" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="bolt" />
                            <span>Perform Fusion Splice ({{ activeClosureDetail.name }})</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showSpliceModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Incoming Feeder Cable</label>
                            <select v-model="newSplice.incoming_cable_id" class="form-select noc-input">
                                <option :value="null">-- Select Incoming Cable --</option>
                                <option v-for="c in cablesList" :key="'in-' + c.id" :value="c.id">
                                    {{ c.name }} ({{ c.cable_type }})
                                </option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Outgoing Distribution Cable</label>
                            <select v-model="newSplice.outgoing_cable_id" class="form-select noc-input">
                                <option :value="null">-- Select Outgoing Cable --</option>
                                <option v-for="c in cablesList" :key="'out-' + c.id" :value="c.id">
                                    {{ c.name }} ({{ c.cable_type }})
                                </option>
                            </select>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Splice Type</label>
                                <select v-model="newSplice.splice_type" class="form-select noc-input">
                                    <option value="FUSION">Fusion Splice (Arc Welded)</option>
                                    <option value="MECHANICAL">Mechanical Splice</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Splice Loss (dB)</label>
                                <input v-model.number="newSplice.splice_loss_db" type="number" step="0.01" class="form-control noc-input" placeholder="0.05" />
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Splice Tray Number</label>
                            <input v-model.number="newSplice.tray_number" type="number" class="form-control noc-input" placeholder="1" />
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showSpliceModal = false">Cancel</button>
                        <button type="button" class="btn btn-warning px-4 fw-bold" :disabled="!newSplice.incoming_cable_id || !newSplice.outgoing_cable_id" @click="submitSplice">
                            Record Splice
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
            viewMode: "canvas", // 'canvas' | 'table' | 'splitters' | 'cables' | 'closures' | 'calculator' | 'faults'
            mapMode: "LOGICAL", // 'LOGICAL' | 'FIBER' | 'OLT_PON' | 'SWITCH' | 'FAULTS' | 'PROBES'
            devices: [],
            probes: [],
            splittersList: [],
            cablesList: [],
            closuresList: [],
            patchCordsList: [],
            activeFaults: [],
            sitesList: [],
            selectedSiteId: null,
            dependencyList: [],
            nodes: [],
            selectedNode: null,
            selectedLink: null,
            searchQuery: "",
            filterType: "ALL",
            showAddModal: false,
            showEditLinkModal: false,
            showSplitterModal: false,
            showCableModal: false,
            showStrandsModal: false,
            showClosureModal: false,
            showSpliceModal: false,
            showSplitterDiagramModal: false,
            showConnectPortModal: false,
            showImportModal: false,
            editingLink: null,
            importJsonText: "",
            isFullscreen: false,

            // Active details for modals
            activeSplitterDetail: null,
            activeCableDetail: null,
            activeClosureDetail: null,
            selectedPortForConnect: null,

            // Tracing state
            highlightedDownstreamIds: [],
            highlightedUpstreamIds: [],

            // Real-Time Health & Synchronization state
            inspectorTab: "overview", // 'overview' | 'telemetry' | 'topology' | 'alerts'
            activeAlertsList: [],
            activeIncidentsList: [],
            isRefreshing: false,
            lastSyncTime: Date.now(),
            syncSecondsAgo: 0,
            syncTimer: null,
            fallbackPollTimer: null,

            // Canvas Pan & Zoom State
            zoomLevel: 1.0,
            panX: 80,
            panY: 80,
            isPanning: false,
            panStartX: 0,
            panStartY: 0,

            // Node Dragging State
            draggingNode: null,
            dragStartX: 0,
            dragStartY: 0,

            newDep: {
                parentDeviceId: null,
                childDeviceId: null,
                dependencyType: "UPSTREAM",
                linkType: "FIBER",
                linkSpeed: "1 Gbps",
                sourceInterface: "",
                targetInterface: "",
            },

            newSplitter: {
                name: "",
                splitter_type: "1:8",
                tier_level: 1,
                location: "",
            },

            newCable: {
                name: "",
                cable_identifier: "",
                cable_type: "FEEDER",
                installation_type: "AERIAL",
                strand_count: 12,
                cable_length_meters: 1000,
                attenuation_db_per_km: 0.35,
                source_type: "CORE_OLT",
                source_label: "Core Central Office",
                target_type: "SPLICE_CLOSURE",
                target_label: "FDC Cabinet 1",
                status: "ACTIVE",
            },

            newClosure: {
                name: "",
                closure_identifier: "",
                closure_type: "FDC",
                location: "",
                tray_capacity: 4,
                total_splice_capacity: 48,
                status: "ACTIVE",
            },

            newSplice: {
                splice_closure_id: null,
                incoming_cable_id: null,
                incoming_strand_id: null,
                outgoing_cable_id: null,
                outgoing_strand_id: null,
                splice_type: "FUSION",
                splice_loss_db: 0.05,
                tray_number: 1,
            },

            newPortConnect: {
                port_id: null,
                connected_entity_type: "ONU",
                connected_entity_name: "",
                measured_loss_db: null,
                notes: "",
            },

            opticalCalc: {
                wavelength: 1490,
                cableLengthKm: 12.5,
                primarySplitRatio: "1:8",
                secondarySplitRatio: "1:4",
                connectorCount: 4,
                spliceCount: 6,
                oltTxPowerDbm: 4.5,
                onuSensitivityDbm: -28.0,
                result: null,
            },
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        selectableDevices() {
            const list = [];
            if (this.devices && this.devices.length > 0) {
                for (const d of this.devices) {
                    const id = parseInt(d.id, 10);
                    if (!isNaN(id) && id > 0) {
                        list.push({
                            id: d.id,
                            name: d.name,
                            ip: d.ip_address || d.hostname || "127.0.0.1",
                            type: d.device_type || "ROUTER"
                        });
                    }
                }
            }
            // Also include monitors from monitorList if not already in list
            const monList = Object.values(this.$root.monitorList || {});
            for (const m of monList) {
                const id = parseInt(m.id, 10);
                if (!isNaN(id) && id > 0 && !list.some((item) => item.name === m.name)) {
                    list.push({
                        id: m.id,
                        name: m.name,
                        ip: m.hostname || m.url || "127.0.0.1",
                        type: this.inferNodeType(m)
                    });
                }
            }
            return list;
        },
        isValidDependency() {
            const p = parseInt(this.newDep.parentDeviceId, 10);
            const c = parseInt(this.newDep.childDeviceId, 10);
            return !isNaN(p) && !isNaN(c) && p > 0 && c > 0 && p !== c;
        },
        allSelectableEntities() {
            if (this.nodes.length > 0) {
                return this.nodes;
            }
            return this.devices;
        },
        onlineNodeCount() {
            return this.filteredNodes.filter((n) => n.status === "UP" || n.status === "ONLINE").length;
        },
        downNodeCount() {
            return this.filteredNodes.filter((n) => n.status === "DOWN" || n.status === "OFFLINE").length;
        },
        warningNodeCount() {
            return this.filteredNodes.filter((n) => n.status === "PENDING" || n.status === "WARNING" || n.status === "DEGRADED").length;
        },
        maintenanceNodeCount() {
            return this.filteredNodes.filter((n) => n.status === "MAINTENANCE" || n.status === "PAUSED").length;
        },
        unknownNodeCount() {
            return this.filteredNodes.filter((n) => !["UP", "ONLINE", "DOWN", "OFFLINE", "PENDING", "WARNING", "DEGRADED", "MAINTENANCE", "PAUSED"].includes(n.status)).length;
        },
        totalNodeCount() {
            return this.filteredNodes.length;
        },
        totalLinkCount() {
            return this.dependencyList.length;
        },
        downLinkCount() {
            return this.dependencyList.filter((d) => {
                const parent = this.nodes.find((n) => n.id === d.parent_device_id);
                const child = this.nodes.find((n) => n.id === d.child_device_id);
                return (parent && (parent.status === "DOWN" || parent.status === "OFFLINE")) ||
                       (child && (child.status === "DOWN" || child.status === "OFFLINE")) ||
                       d.status === "down";
            }).length;
        },
        affectedNodeCount() {
            const downParentIds = this.nodes
                .filter((n) => n.status === "DOWN" || n.status === "OFFLINE")
                .map((n) => n.id);
            const affected = new Set();
            for (const pId of downParentIds) {
                const queue = [pId];
                while (queue.length > 0) {
                    const cur = queue.shift();
                    const children = this.dependencyList
                        .filter((d) => d.parent_device_id === cur)
                        .map((d) => d.child_device_id);
                    for (const c of children) {
                        if (!affected.has(c)) {
                            affected.add(c);
                            queue.push(c);
                        }
                    }
                }
            }
            return affected.size;
        },
        syncStatusText() {
            if (!this.$root.socket || !this.$root.socket.connected) return "Reconnecting";
            if (this.syncSecondsAgo > 60) return "Polling Fallback";
            return "Live";
        },
        syncIndicatorClass() {
            if (!this.$root.socket || !this.$root.socket.connected) return "dot-red";
            if (this.syncSecondsAgo > 60) return "dot-amber";
            return "dot-green";
        },
        lastSyncTimeAgo() {
            if (this.syncSecondsAgo < 5) return "Just now";
            if (this.syncSecondsAgo < 60) return `${this.syncSecondsAgo}s ago`;
            return `${Math.floor(this.syncSecondsAgo / 60)}m ago`;
        },
        onlineProbeCount() {
            return (this.probes || []).filter((p) => p.status === "online").length;
        },
        offlineProbeCount() {
            return (this.probes || []).filter((p) => p.status === "offline").length;
        },
        filteredNodes() {
            return this.nodes.filter((n) => {
                if (this.filterType !== "ALL" && n.type.toUpperCase() !== this.filterType) {
                    return false;
                }
                if (this.selectedSiteId && n.site_id && n.site_id !== this.selectedSiteId) {
                    return false;
                }
                if (this.mapMode === "FIBER" && !["OLT", "SPLITTER", "ONU", "ROUTER"].includes(n.type)) {
                    return false;
                }
                if (this.mapMode === "OLT_PON" && !["OLT", "SPLITTER", "ONU"].includes(n.type)) {
                    return false;
                }
                if (this.mapMode === "SWITCH" && !["SWITCH", "ROUTER"].includes(n.type)) {
                    return false;
                }
                if (this.mapMode === "PROBES" && !["PROBE", "ROUTER", "SERVER"].includes(n.type)) {
                    return false;
                }
                if (this.searchQuery && this.searchQuery.trim()) {
                    const q = this.searchQuery.toLowerCase().trim();
                    const name = (n.name || "").toLowerCase();
                    const ip = (n.ip || "").toLowerCase();
                    return name.includes(q) || ip.includes(q);
                }
                return true;
            });
        },
        renderedLinks() {
            const list = [];
            for (const dep of this.dependencyList) {
                const parent = this.nodes.find((n) => n.id === dep.parent_device_id);
                const child = this.nodes.find((n) => n.id === dep.child_device_id);

                if (parent && child) {
                    const x1 = parent.x + 90;
                    const y1 = parent.y + 76;
                    const x2 = child.x + 90;
                    const y2 = child.y;

                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const cx = x1 + dx * 0.5;
                    const cy = y1 + dy * 0.5;
                    const path = `M ${x1} ${y1} Q ${cx} ${cy - 20} ${x2} ${y2}`;

                    let status = dep.status || "UP";
                    if (parent.status === "DOWN" || child.status === "DOWN") {
                        status = "DOWN";
                    }

                    list.push({
                        id: dep.id || `${parent.id}-${child.id}`,
                        path,
                        midX: cx,
                        midY: cy - 10,
                        parent_device_id: dep.parent_device_id,
                        child_device_id: dep.child_device_id,
                        parent_name: dep.parent_name || parent.name,
                        child_name: dep.child_name || child.name,
                        dependency_type: dep.dependency_type || "UPSTREAM",
                        link_type: dep.link_type || "FIBER",
                        link_speed: dep.link_speed || "1 Gbps",
                        source_interface: dep.source_interface,
                        target_interface: dep.target_interface,
                        traffic_utilization_pct: dep.traffic_utilization_pct || 0,
                        latency_ms: dep.latency_ms || 0,
                        relationship_source: dep.relationship_source || "MANUAL",
                        status,
                    });
                }
            }
            return list;
        },
    },
    watch: {
        "$root.activeOrganizationId"() {
            this.loadData();
        },
        "$root.monitorList": {
            deep: true,
            handler() {
                this.buildNetworkNodes();
                this.syncNodesWithLiveTelemetry();
            },
        },
        "$root.lastHeartbeatList": {
            deep: true,
            handler() {
                this.syncNodesWithLiveTelemetry();
            },
        },
        devices: {
            deep: true,
            handler() {
                this.buildNetworkNodes();
            },
        },
    },
    mounted() {
        this.loadData();
        this.syncTimer = setInterval(() => {
            this.syncSecondsAgo = Math.max(0, Math.round((Date.now() - this.lastSyncTime) / 1000));
        }, 1000);

        this.fallbackPollTimer = setInterval(() => {
            if (!this.$root.socket || !this.$root.socket.connected || this.syncSecondsAgo > 45) {
                this.loadData();
            }
        }, 30000);

        const socket = this.$root.getSocket();
        if (socket) {
            this.onSocketConnect = () => {
                this.loadData();
            };
            this.onHeartbeat = () => {
                this.syncNodesWithLiveTelemetry();
            };
            this.onUpdateAlerts = () => {
                this.loadAlertsAndIncidents();
            };
            socket.on("connect", this.onSocketConnect);
            socket.on("heartbeat", this.onHeartbeat);
            socket.on("updateActiveAlerts", this.onUpdateAlerts);
            socket.on("updateProbeList", this.loadData);
        }
    },
    beforeUnmount() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        if (this.fallbackPollTimer) clearInterval(this.fallbackPollTimer);
        const socket = this.$root.getSocket();
        if (socket) {
            if (this.onSocketConnect) socket.off("connect", this.onSocketConnect);
            if (this.onHeartbeat) socket.off("heartbeat", this.onHeartbeat);
            if (this.onUpdateAlerts) socket.off("updateActiveAlerts", this.onUpdateAlerts);
            socket.off("updateProbeList", this.loadData);
        }
    },
    methods: {
        loadData() {
            const socket = this.$root.getSocket();
            if (!socket) return;
            this.isRefreshing = true;

            // Load devices
            socket.emit("getDeviceList", (res) => {
                if (res && res.ok) {
                    this.devices = res.devices || [];
                }
                this.buildNetworkNodes();
                this.syncNodesWithLiveTelemetry();
            });

            // Load probes
            socket.emit("getProbeList", (pRes) => {
                if (pRes && pRes.ok) {
                    this.probes = pRes.probes || [];
                }
                this.buildNetworkNodes();
            });

            // Load splitters
            socket.emit("getFtthSplitters", (sRes) => {
                if (sRes && sRes.ok) {
                    this.splittersList = sRes.splitters || [];
                }
                this.buildNetworkNodes();
            });

            // Load cables
            socket.emit("getFtthCables", (cRes) => {
                if (cRes && cRes.ok) {
                    this.cablesList = cRes.cables || [];
                }
            });

            // Load closures
            socket.emit("getFtthClosures", (clRes) => {
                if (clRes && clRes.ok) {
                    this.closuresList = clRes.closures || [];
                }
            });

            // Load dependencies / links
            socket.emit("getAllDependencies", (res) => {
                if (res && res.ok) {
                    this.dependencyList = res.links || [];
                }
            });

            // Load active fiber faults
            socket.emit("getActiveFiberFaults", (fRes) => {
                if (fRes && fRes.ok) {
                    this.activeFaults = fRes.faults || [];
                }
            });

            // Load active alerts & incidents
            this.loadAlertsAndIncidents();

            this.lastSyncTime = Date.now();
            this.syncSecondsAgo = 0;
            this.isRefreshing = false;
            this.buildNetworkNodes();
            this.runOpticalCalculation();
        },
        loadAlertsAndIncidents() {
            const socket = this.$root.getSocket();
            if (!socket) return;
            socket.emit("getActiveAlerts", (res) => {
                if (res && res.ok) {
                    this.activeAlertsList = res.alerts || [];
                }
            });
            socket.emit("getIncidents", { status: "OPEN" }, (res) => {
                if (res && res.ok) {
                    this.activeIncidentsList = res.incidents || [];
                }
            });
        },
        loadAllDependencies() {
            this.$root.getSocket().emit("getAllDependencies", (res) => {
                if (res && res.ok) {
                    this.dependencyList = res.links || [];
                }
            });
        },
        buildNetworkNodes() {
            const orgId = this.$root.activeOrganizationId || 1;
            const savedPositions = this.loadSavedPositions(orgId);
            let initialList = [];

            if (this.devices && this.devices.length > 0) {
                initialList = this.devices.map((d) => {
                    const primaryMonId = d.monitor_id || (d.monitors && d.monitors[0] ? d.monitors[0].id : null);
                    const mon = primaryMonId ? (this.$root.monitorList || {})[primaryMonId] : null;
                    const beat = primaryMonId ? (this.$root.lastHeartbeatList || {})[primaryMonId] : null;

                    let st = (d.status || "UP").toUpperCase();
                    if (st === "ONLINE") st = "UP";
                    if (st === "OFFLINE") st = "DOWN";

                    let pingDisplay = d.ping || "1.2ms";
                    if (beat) {
                        if (beat.status === 0) st = "DOWN";
                        else if (beat.status === 1) st = "UP";
                        else if (beat.status === 2) st = "PENDING";
                        else if (beat.status === 3) st = "MAINTENANCE";
                        if (beat.ping != null) {
                            pingDisplay = `${Math.round(beat.ping)}ms`;
                        }
                    }

                    let nodeType = (d.device_type || "ROUTER").toUpperCase();
                    if (mon && (!d.device_type || d.device_type === "Other" || d.device_type === "Server")) {
                        nodeType = this.inferNodeType(mon);
                    }

                    return {
                        id: d.id,
                        name: d.name,
                        ip: d.ip_address || d.hostname || (mon ? mon.hostname || mon.url : "10.0.0.1"),
                        type: nodeType,
                        status: st,
                        site_id: d.site_id,
                        site_name: d.site_name || null,
                        ping: pingDisplay,
                        monitor_id: primaryMonId,
                        monitors: d.monitors || [],
                        last_checked: d.last_checked || (beat ? beat.time : null),
                        x: 100,
                        y: 100,
                    };
                });
            }

            // Also include monitors from monitorList if not already represented
            const monList = Object.values(this.$root.monitorList || {});
            for (const m of monList) {
                const alreadyIncluded = initialList.some((n) => n.name === m.name || n.monitor_id === m.id || n.id === m.id);
                if (!alreadyIncluded) {
                    const beat = (this.$root.lastHeartbeatList || {})[m.id];
                    let st = "UP";
                    if (m.active === 0) st = "PAUSED";
                    else if (beat) {
                        if (beat.status === 0) st = "DOWN";
                        else if (beat.status === 1) st = "UP";
                        else if (beat.status === 2) st = "PENDING";
                        else if (beat.status === 3) st = "MAINTENANCE";
                    }

                    initialList.push({
                        id: m.id,
                        name: m.name,
                        ip: m.hostname || m.url || "127.0.0.1",
                        type: this.inferNodeType(m),
                        status: st,
                        ping: beat && beat.ping != null ? `${Math.round(beat.ping)}ms` : "1.8ms",
                        monitor_id: m.id,
                        monitors: [{ id: m.id, name: m.name, type: m.type, hostname: m.hostname, port: m.port, url: m.url, active: m.active }],
                        last_checked: beat ? beat.time : null,
                        x: 100,
                        y: 100,
                    });
                }
            }

            // Append splitters
            if (this.splittersList && this.splittersList.length > 0) {
                for (const s of this.splittersList) {
                    initialList.push({
                        id: `splitter-${s.id}`,
                        name: s.name,
                        ip: s.splitter_type || "1:8 Splitter",
                        type: "SPLITTER",
                        status: "UP",
                        ping: `${s.attenuation_db || 3.5}dB`,
                        splitter_id: s.id,
                        x: 100,
                        y: 100,
                    });
                }
            }

            // Append probes
            if (this.probes && this.probes.length > 0) {
                for (const p of this.probes) {
                    let pStatus = "UP";
                    if (p.status === "offline" || p.status === "revoked") pStatus = "DOWN";
                    else if (p.status === "degraded") pStatus = "PENDING";
                    initialList.push({
                        id: `probe-${p.id}`,
                        name: p.name || `Probe #${p.id}`,
                        ip: p.ip_address || p.location || "Distributed Node",
                        type: "PROBE",
                        status: pStatus,
                        ping: p.latency ? `${Math.round(p.latency)}ms` : "1.8ms",
                        probe_id: p.id,
                        x: 100,
                        y: 100,
                    });
                }
            }

            // Apply saved or auto positions
            this.nodes = initialList.map((node, index) => {
                if (savedPositions[node.id]) {
                    node.x = savedPositions[node.id].x;
                    node.y = savedPositions[node.id].y;
                } else {
                    const cols = 4;
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    node.x = 120 + col * 280;
                    node.y = 120 + row * 180;
                }
                return node;
            });
        },
        syncNodesWithLiveTelemetry() {
            let changed = false;
            for (const node of this.nodes) {
                const monId = node.monitor_id || (node.monitors && node.monitors[0] ? node.monitors[0].id : null);
                if (monId) {
                    const beat = (this.$root.lastHeartbeatList || {})[monId];
                    if (beat) {
                        let newStatus = node.status;
                        if (beat.status === 0) newStatus = "DOWN";
                        else if (beat.status === 1) newStatus = "UP";
                        else if (beat.status === 2) newStatus = "PENDING";
                        else if (beat.status === 3) newStatus = "MAINTENANCE";

                        if (node.status !== newStatus) {
                            node.status = newStatus;
                            changed = true;
                        }
                        if (beat.ping != null) {
                            const newPing = `${Math.round(beat.ping)}ms`;
                            if (node.ping !== newPing) {
                                node.ping = newPing;
                                changed = true;
                            }
                        }
                        if (beat.time) {
                            node.last_checked = beat.time;
                        }
                    }
                }
            }
            if (changed) {
                this.nodes = [...this.nodes];
            }
        },
        getNodeBeaconClass(status) {
            const s = (status || "").toUpperCase();
            if (s === "UP" || s === "ONLINE") return "up";
            if (s === "DOWN" || s === "OFFLINE") return "down";
            if (s === "PENDING" || s === "DEGRADED" || s === "WARNING") return "pending";
            if (s === "MAINTENANCE" || s === "PAUSED") return "maintenance";
            return "unknown";
        },
        inferNodeType(monitor) {
            const name = (monitor.name || "").toLowerCase();
            const type = (monitor.type || "").toLowerCase();
            if (name.includes("router") || name.includes("core") || name.includes("mikrotik") || name.includes("gateway")) return "ROUTER";
            if (name.includes("switch") || name.includes("cisco") || name.includes("juniper")) return "SWITCH";
            if (name.includes("olt") || name.includes("gpon")) return "OLT";
            if (name.includes("onu") || name.includes("ont")) return "ONU";
            if (name.includes("server") || name.includes("api") || name.includes("db") || type.includes("http")) return "SERVER";
            return "MONITOR";
        },
        getNodeIconSymbol(type) {
            switch (type) {
                case "ROUTER": return "☵";
                case "MIKROTIK": return "⚡";
                case "SWITCH": return "🔀";
                case "OLT": return "📡";
                case "SPLITTER": return "🔱";
                case "ONU": return "🏠";
                case "SERVER": return "🖳";
                case "FIREWALL": return "🛡";
                case "PROBE": return "🛰";
                case "CAMERA": return "📹";
                default: return "●";
            }
        },
        getLinkMarker(status) {
            switch (status) {
                case "DOWN": return "url(#arrow-down)";
                case "DEGRADED": return "url(#arrow-degraded)";
                case "SUSPECTED": return "url(#arrow-suspected)";
                default: return "url(#arrow-healthy)";
            }
        },
        truncateText(txt, maxLen) {
            if (!txt) return "";
            return txt.length > maxLen ? txt.substring(0, maxLen) + "…" : txt;
        },
        loadSavedPositions(orgId) {
            try {
                const data = localStorage.getItem(`infininoc_topology_positions_${orgId}`);
                return data ? JSON.parse(data) : {};
            } catch {
                return {};
            }
        },
        saveNodePositions() {
            const orgId = this.$root.activeOrganizationId || 1;
            const positions = {};
            for (const n of this.nodes) {
                positions[n.id] = { x: n.x, y: n.y };
            }
            try {
                localStorage.setItem(`infininoc_topology_positions_${orgId}`, JSON.stringify(positions));
                this.$root.toastSuccess("Topology layout saved successfully!");
            } catch {
                this.$root.toastError("Failed to save layout");
            }
        },
        autoLayoutNodes() {
            const tiers = { ROUTER: [], MIKROTIK: [], SWITCH: [], OLT: [], SPLITTER: [], PROBE: [], SERVER: [], ONU: [], MONITOR: [] };
            for (const n of this.nodes) {
                if (tiers[n.type]) {
                    tiers[n.type].push(n);
                } else {
                    tiers.MONITOR.push(n);
                }
            }

            let currentY = 100;
            for (const tierKey of ["ROUTER", "MIKROTIK", "SWITCH", "OLT", "SPLITTER", "PROBE", "SERVER", "ONU", "MONITOR"]) {
                const group = tiers[tierKey];
                if (group.length > 0) {
                    const startX = Math.max(100, 600 - (group.length * 240) / 2);
                    group.forEach((node, idx) => {
                        node.x = startX + idx * 260;
                        node.y = currentY;
                    });
                    currentY += 180;
                }
            }
            this.$root.toastSuccess("Auto layout arranged in hierarchical tiers");
        },

        // Canvas Zoom & Pan Handling
        handleCanvasMouseDown(e) {
            if (e.button === 0 && !this.draggingNode) {
                this.isPanning = true;
                this.panStartX = e.clientX - this.panX;
                this.panStartY = e.clientY - this.panY;
            }
        },
        handleCanvasMouseMove(e) {
            if (this.isPanning) {
                this.panX = e.clientX - this.panStartX;
                this.panY = e.clientY - this.panStartY;
            } else if (this.draggingNode) {
                const dx = (e.clientX - this.dragStartX) / this.zoomLevel;
                const dy = (e.clientY - this.dragStartY) / this.zoomLevel;
                this.draggingNode.x += dx;
                this.draggingNode.y += dy;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
            }
        },
        handleCanvasMouseUp() {
            this.isPanning = false;
            this.draggingNode = null;
        },
        handleCanvasWheel(e) {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomLevel = Math.min(2.5, Math.max(0.3, this.zoomLevel + delta));
        },
        zoomIn() {
            this.zoomLevel = Math.min(2.5, this.zoomLevel + 0.15);
        },
        zoomOut() {
            this.zoomLevel = Math.max(0.3, this.zoomLevel - 0.15);
        },
        fitToScreen() {
            this.panX = 60;
            this.panY = 60;
            this.zoomLevel = 0.85;
        },
        resetView() {
            this.panX = 80;
            this.panY = 80;
            this.zoomLevel = 1.0;
        },

        // Selection & Tracing
        handleNodeMouseDown(e, node) {
            if (e.button === 0) {
                this.draggingNode = node;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
            }
        },
        selectNode(node) {
            this.selectedNode = node;
            this.selectedLink = null;
        },
        selectLink(link) {
            this.selectedLink = link;
            this.selectedNode = null;
        },
        closeInspector() {
            this.selectedNode = null;
            this.selectedLink = null;
            this.highlightedDownstreamIds = [];
            this.highlightedUpstreamIds = [];
        },
        centerNodeOnCanvas(node) {
            this.panX = 400 - node.x * this.zoomLevel;
            this.panY = 250 - node.y * this.zoomLevel;
        },
        getNodeParents(nodeId) {
            const parentIds = this.dependencyList.filter((d) => d.child_device_id === nodeId).map((d) => d.parent_device_id);
            return this.nodes.filter((n) => parentIds.includes(n.id));
        },
        getNodeChildren(nodeId) {
            const childIds = this.dependencyList.filter((d) => d.parent_device_id === nodeId).map((d) => d.child_device_id);
            return this.nodes.filter((n) => childIds.includes(n.id));
        },
        traceDownstream(nodeId) {
            const result = [];
            const queue = [nodeId];
            while (queue.length > 0) {
                const current = queue.shift();
                const children = this.dependencyList.filter((d) => d.parent_device_id === current).map((d) => d.child_device_id);
                for (const c of children) {
                    if (!result.includes(c)) {
                        result.push(c);
                        queue.push(c);
                    }
                }
            }
            this.highlightedDownstreamIds = result;
            this.$root.toastInfo(`Traced ${result.length} downstream nodes impacted`);
        },
        traceUpstream(nodeId) {
            const result = [];
            const queue = [nodeId];
            while (queue.length > 0) {
                const current = queue.shift();
                const parents = this.dependencyList.filter((d) => d.child_device_id === current).map((d) => d.parent_device_id);
                for (const p of parents) {
                    if (!result.includes(p)) {
                        result.push(p);
                        queue.push(p);
                    }
                }
            }
            this.highlightedUpstreamIds = result;
            this.$root.toastInfo(`Traced upstream path across ${result.length} core devices`);
        },

        // Dependency Link Actions
        saveDependency() {
            const pId = parseInt(this.newDep.parentDeviceId, 10);
            const cId = parseInt(this.newDep.childDeviceId, 10);
            if (isNaN(pId) || pId <= 0) {
                this.$root.toastError("Please select a valid upstream parent device.");
                return;
            }
            if (isNaN(cId) || cId <= 0) {
                this.$root.toastError("Please select a valid downstream child device.");
                return;
            }
            if (pId === cId) {
                this.$root.toastError("A device cannot depend on itself.");
                return;
            }
            this.$root.getSocket().emit("addDeviceDependency", this.newDep, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Dependency link created");
                    this.showAddModal = false;
                    this.newDep.parentDeviceId = null;
                    this.newDep.childDeviceId = null;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error establishing link");
                }
            });
        },
        openEditLinkModal(link) {
            this.editingLink = { ...link };
            this.showEditLinkModal = true;
        },
        saveEditedLink() {
            if (!this.editingLink || !this.editingLink.id) return;
            this.$root.getSocket().emit("updateDeviceDependency", this.editingLink, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Link parameters updated");
                    this.showEditLinkModal = false;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error updating link");
                }
            });
        },
        deleteLink(linkId) {
            if (confirm("Delete this network dependency link?")) {
                this.$root.getSocket().emit("deleteDeviceDependency", linkId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Dependency link removed");
                        this.selectedLink = null;
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error removing link");
                    }
                });
            }
        },
        getDeviceName(devId) {
            const dev = this.allSelectableEntities.find((d) => d.id === Number(devId));
            return dev ? `${dev.name} (${dev.ip || dev.type})` : `Target #${devId}`;
        },

        // FTTH Splitter & Port Actions
        saveSplitter() {
            if (!this.newSplitter.name) {
                this.$root.toastError("Splitter name is required.");
                return;
            }
            this.$root.getSocket().emit("saveFtthSplitter", this.newSplitter, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Fiber splitter registered");
                    this.showSplitterModal = false;
                    this.newSplitter = { name: "", splitter_type: "1:8", tier_level: 1, location: "" };
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving splitter");
                }
            });
        },
        deleteSplitter(splitterId) {
            if (confirm("Delete this fiber splitter?")) {
                this.$root.getSocket().emit("deleteFiberSplitter", splitterId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Fiber splitter removed");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error removing splitter");
                    }
                });
            }
        },
        openSplitterDiagram(splitter) {
            this.$root.getSocket().emit("getFtthSplitterDetails", splitter.id, (res) => {
                if (res && res.ok && res.splitter) {
                    this.activeSplitterDetail = res.splitter;
                    this.showSplitterDiagramModal = true;
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to load splitter diagram");
                }
            });
        },
        openConnectPortModal(port) {
            this.selectedPortForConnect = port;
            this.newPortConnect = {
                port_id: port.id,
                connected_entity_type: "ONU",
                connected_entity_name: "",
                measured_loss_db: null,
                notes: "",
            };
            this.showConnectPortModal = true;
        },
        submitConnectPort() {
            if (!this.newPortConnect.connected_entity_name) {
                this.$root.toastError("Connected entity name / subscriber ID is required.");
                return;
            }
            this.$root.getSocket().emit("connectSplitterPort", this.newPortConnect, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Splitter port connected");
                    this.showConnectPortModal = false;
                    if (this.activeSplitterDetail) {
                        this.openSplitterDiagram(this.activeSplitterDetail);
                    }
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error connecting port");
                }
            });
        },
        disconnectPort(portId) {
            if (confirm("Disconnect this fiber splitter port?")) {
                this.$root.getSocket().emit("disconnectSplitterPort", portId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Port disconnected");
                        if (this.activeSplitterDetail) {
                            this.openSplitterDiagram(this.activeSplitterDetail);
                        }
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error disconnecting port");
                    }
                });
            }
        },

        // FTTH Physical Fiber Cable Actions
        saveCable() {
            if (!this.newCable.name) {
                this.$root.toastError("Cable name is required.");
                return;
            }
            this.$root.getSocket().emit("saveFtthCable", this.newCable, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Fiber cable registered successfully");
                    this.showCableModal = false;
                    this.newCable = {
                        name: "",
                        cable_identifier: "",
                        cable_type: "FEEDER",
                        installation_type: "AERIAL",
                        strand_count: 12,
                        cable_length_meters: 1000,
                        attenuation_db_per_km: 0.35,
                        source_type: "CORE_OLT",
                        source_label: "Core Central Office",
                        target_type: "SPLICE_CLOSURE",
                        target_label: "FDC Cabinet 1",
                        status: "ACTIVE",
                    };
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving cable");
                }
            });
        },
        deleteCable(cableId) {
            if (confirm("Delete this physical fiber cable and its strands?")) {
                this.$root.getSocket().emit("deleteFtthCable", cableId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Fiber cable removed");
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Error removing cable");
                    }
                });
            }
        },
        openStrandsModal(cable) {
            this.$root.getSocket().emit("getFtthCableDetails", cable.id, (res) => {
                if (res && res.ok && res.cable) {
                    this.activeCableDetail = res.cable;
                    this.showStrandsModal = true;
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to load cable strands");
                }
            });
        },
        allocateStrand(strand, newStatus) {
            this.$root.getSocket().emit("allocateFiberStrand", {
                strand_id: strand.id,
                status: newStatus,
                destination_point: newStatus === "ACTIVE" ? "Connected Circuit" : null,
            }, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess(`Strand status updated to ${newStatus}`);
                    if (this.activeCableDetail) {
                        this.openStrandsModal(this.activeCableDetail);
                    }
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error allocating strand");
                }
            });
        },

        // FTTH Splice Closures & Cabinets Actions
        saveClosure() {
            if (!this.newClosure.name) {
                this.$root.toastError("Splice closure name is required.");
                return;
            }
            this.$root.getSocket().emit("saveFtthClosure", this.newClosure, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Splice closure registered");
                    this.showClosureModal = false;
                    this.newClosure = {
                        name: "",
                        closure_identifier: "",
                        closure_type: "FDC",
                        location: "",
                        tray_capacity: 4,
                        total_splice_capacity: 48,
                        status: "ACTIVE",
                    };
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving closure");
                }
            });
        },
        openSpliceModal(closure) {
            this.activeClosureDetail = closure;
            this.newSplice = {
                splice_closure_id: closure.id,
                incoming_cable_id: null,
                incoming_strand_id: null,
                outgoing_cable_id: null,
                outgoing_strand_id: null,
                splice_type: "FUSION",
                splice_loss_db: 0.05,
                tray_number: 1,
            };
            this.showSpliceModal = true;
        },
        submitSplice() {
            if (!this.newSplice.incoming_cable_id || !this.newSplice.outgoing_cable_id) {
                this.$root.toastError("Please select both incoming and outgoing cables.");
                return;
            }
            this.$root.getSocket().emit("addFiberSplice", this.newSplice, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Fusion splice recorded");
                    this.showSpliceModal = false;
                    this.loadData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving splice");
                }
            });
        },

        // Optical Loss Budget Calculator
        runOpticalCalculation() {
            this.$root.getSocket().emit("calculateOpticalLossBudget", this.opticalCalc, (res) => {
                if (res && res.ok && res.calculation) {
                    this.opticalCalc.result = res.calculation;
                }
            });
        },

        // Topology Export & Import
        exportTopologyFile() {
            this.$root.getSocket().emit("exportTopology", (res) => {
                if (res && res.ok) {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.topology, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `infininoc_topology_org${this.$root.activeOrganizationId || 1}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    this.$root.toastSuccess("Topology configuration downloaded");
                }
            });
        },
        submitImportTopology() {
            try {
                const parsed = JSON.parse(this.importJsonText);
                this.$root.getSocket().emit("importTopology", parsed, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess(`Imported ${res.importedLinks} topology links`);
                        this.showImportModal = false;
                        this.importJsonText = "";
                        this.loadData();
                    } else {
                        this.$root.toastError(res ? res.msg : "Import failed");
                    }
                });
            } catch (e) {
                this.$root.toastError("Invalid JSON format");
            }
        },

        // Fault Analysis
        triggerFaultAnalysis() {
            this.$root.getSocket().emit("runFiberFaultAnalysis", (res) => {
                if (res && res.ok) {
                    this.activeFaults = res.faults || [];
                    this.$root.toastSuccess(`Fault analysis completed: ${this.activeFaults.length} active faults`);
                }
            });
        },
    },
};
</script>

<style scoped>
.noc-topology-page {
    background-color: var(--background);
    color: var(--foreground);
    min-height: calc(100vh - 80px);
}

.noc-topology-page.fullscreen-mode {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1050;
    padding: 1rem !important;
    background-color: var(--background);
}

.topology-canvas-container {
    background-color: var(--app-bg);
    min-height: 650px;
    height: calc(100vh - 180px);
}

.canvas-hud {
    background-color: var(--card);
    border-bottom: 1px solid var(--border);
    z-index: 10;
}

.canvas-viewport {
    width: 100%;
    height: calc(100% - 50px);
    overflow: hidden;
    position: relative;
    cursor: grab;
}

.canvas-viewport:active {
    cursor: grabbing;
}

.network-svg-layer {
    user-select: none;
}

.grid-dot {
    fill: var(--border-strong);
    opacity: 0.45;
}

/* Links */
.network-link-path {
    fill: none;
    stroke-width: 2.5px;
    transition: stroke 0.3s ease;
    cursor: pointer;
}

.link-healthy {
    stroke: #10B981;
}

.link-down {
    stroke: #EF4444;
    stroke-dasharray: 6 3;
}

.link-degraded {
    stroke: #F59E0B;
}

.link-suspected {
    stroke: #F97316;
    stroke-dasharray: 5 2;
}

.link-wireless {
    stroke-dasharray: 3 3;
}

.link-logical {
    stroke-dasharray: 6 4;
}

.is-selected-link {
    stroke: #3B82F6 !important;
    stroke-width: 4px !important;
}

.link-label-bg {
    fill: var(--card);
    stroke: var(--border);
    stroke-width: 1px;
}

.link-label-text {
    font-size: 9px;
    font-weight: 700;
    fill: var(--muted-foreground);
    font-family: monospace;
}

/* Node Cards */
.device-node-group {
    cursor: pointer;
    transition: transform 0.1s ease;
}

.node-box {
    fill: var(--card);
    stroke: var(--border);
    stroke-width: 1.5px;
    filter: drop-shadow(0 4px 12px var(--shadow-card));
    transition: all 0.2s ease;
}

.device-node-group:hover .node-box {
    stroke: var(--primary);
    stroke-width: 2px;
}

.device-node-group.is-selected .node-box {
    stroke: #3B82F6;
    stroke-width: 2.5px;
    filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.4));
}

.device-node-group.is-highlighted-downstream .node-box {
    stroke: #F59E0B !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.6));
}

.device-node-group.is-highlighted-upstream .node-box {
    stroke: #06B6D4 !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 14px rgba(6, 182, 212, 0.6));
}

.device-node-group.is-down .node-box {
    stroke: #EF4444;
    stroke-width: 2px;
}

.node-icon-bg {
    fill: var(--secondary);
}

.node-icon-symbol {
    font-size: 20px;
    fill: var(--foreground);
}

.node-name-text {
    font-size: 13px;
    font-weight: 700;
    fill: var(--foreground);
    font-family: inherit;
}

.node-ip-text {
    font-size: 11px;
    fill: var(--muted-foreground);
    font-family: monospace;
}

.node-type-badge {
    font-size: 9px;
    font-weight: 700;
    fill: #06B6D4;
    letter-spacing: 0.05em;
    font-family: monospace;
}

.status-beacon {
    stroke-width: 2px;
    stroke: var(--card);
}

.beacon-up {
    fill: #10B981;
}

.beacon-down {
    fill: #EF4444;
}

.beacon-pending {
    fill: #F59E0B;
}

.outage-pulse-circle {
    fill: none;
    stroke: #EF4444;
    stroke-width: 2px;
    opacity: 0.8;
    animation: outage-pulse 1.8s infinite;
}

@keyframes outage-pulse {
    0% {
        r: 35px;
        opacity: 0.8;
    }
    100% {
        r: 58px;
        opacity: 0;
    }
}

.ping-pill-bg {
    fill: var(--secondary);
}

.ping-pill-text {
    font-size: 9px;
    font-family: monospace;
    font-weight: 700;
    fill: #10B981;
}

/* Inspector Drawer */
.node-inspector-drawer {
    width: 340px;
    z-index: 20;
    overflow-y: auto;
}

/* Status Indicator Dots in Legend */
.status-indicator-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dot-green {
    background-color: #10B981;
}

.dot-red {
    background-color: #EF4444;
}

.dot-amber {
    background-color: #F59E0B;
}

.dot-blue {
    background-color: #3B82F6;
}

.dot-gray {
    background-color: #6B7280;
}

.beacon-up,
.beacon-online {
    fill: #10B981;
}

.beacon-down,
.beacon-offline {
    fill: #EF4444;
}

.beacon-pending,
.beacon-warning {
    fill: #F59E0B;
}

.beacon-maintenance {
    fill: #3B82F6;
}

.beacon-unknown {
    fill: #6B7280;
}

.noc-create-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: #FFFFFF;
    transition: all 0.2s ease-in-out;
}

.noc-create-btn:hover:not(:disabled) {
    background-color: #059669;
    border-color: #059669;
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--border);
    color: var(--foreground);
    border-radius: 8px;
}

.noc-section-box {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.cursor-pointer {
    cursor: pointer;
}
</style>
