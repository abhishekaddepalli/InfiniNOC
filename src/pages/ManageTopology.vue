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
                        <font-awesome-icon icon="sitemap" class="me-1" /> Network Canvas
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
                        :class="viewMode === 'splitters' ? 'btn-primary fw-bold' : 'btn-outline-secondary'"
                        @click="viewMode = 'splitters'"
                    >
                        <font-awesome-icon icon="code-branch" class="me-1" /> Splitters ({{ splittersList.length }})
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
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="exportTopologyFile">
                                <font-awesome-icon icon="download" class="me-2 text-info" /> Export Topology JSON
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showImportModal = true">
                                <font-awesome-icon icon="upload" class="me-2 text-success" /> Import Topology JSON
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-foreground small" href="javascript:void(0)" @click="showSplitterModal = true">
                                <font-awesome-icon icon="code-branch" class="me-2 text-warning" /> Add Fiber Splitter
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
                                'is-down': node.status === 'DOWN',
                                'is-healthy': node.status === 'UP',
                                'is-warning': node.status === 'PENDING' || node.status === 'DEGRADED'
                            }"
                            :transform="`translate(${node.x}, ${node.y})`"
                            @mousedown.stop="handleNodeMouseDown($event, node)"
                            @click.stop="selectNode(node)"
                        >
                            <!-- Animated Pulse Glow Ring for Outages -->
                            <circle v-if="node.status === 'DOWN'" cx="90" cy="38" r="44" class="outage-pulse-circle" />

                            <!-- Main Node Card Box -->
                            <rect x="0" y="0" width="180" height="76" rx="10" class="node-box" />

                            <!-- Device Icon Badge Container -->
                            <rect x="12" y="14" width="46" height="48" rx="8" class="node-icon-bg" />

                            <!-- Device Icon Placeholder text/symbol -->
                            <text x="35" y="45" text-anchor="middle" class="node-icon-symbol">
                                {{ getNodeIconSymbol(node.type) }}
                            </text>

                            <!-- Status Dot Beacon -->
                            <circle cx="50" cy="20" r="5" class="status-beacon" :class="'beacon-' + node.status.toLowerCase()" />

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
                <div class="canvas-legend p-2 rounded-3 shadow-sm border border-secondary bg-surface position-absolute bottom-0 start-0 m-3">
                    <div class="small fw-bold text-foreground mb-1 d-flex align-items-center gap-2 flex-wrap">
                        <span class="status-indicator-dot dot-green"></span>
                        <span>Online: {{ onlineNodeCount }}</span>
                        <span class="status-indicator-dot dot-red ms-2"></span>
                        <span>Down: {{ downNodeCount }}</span>
                        <span v-if="splittersList.length > 0" class="badge bg-secondary ms-2 font-monospace">
                            🔱 {{ splittersList.length }} Splitters
                        </span>
                    </div>
                    <div class="text-muted small" style="font-size: 0.68rem;">
                        Drag nodes to move · Scroll to zoom · Click node or link to inspect
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
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="badge" :class="selectedNode.status === 'UP' ? 'bg-success' : (selectedNode.status === 'DOWN' ? 'bg-danger' : 'bg-warning text-dark')">
                                    {{ selectedNode.status }}
                                </span>
                                <span class="badge bg-secondary font-monospace">{{ selectedNode.type }}</span>
                                <span v-if="selectedNode.ping" class="badge bg-info font-monospace">{{ selectedNode.ping }}</span>
                            </div>
                        </div>

                        <!-- Upstream / Downstream Connections -->
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
                            <td>Tier {{ s.tier_level }}</td>
                            <td class="text-info font-monospace">{{ s.parent_splitter_name || 'Root (Direct OLT)' }}</td>
                            <td class="font-monospace text-muted">{{ s.olt_name ? (s.olt_name + ' / ' + (s.pon_port || 'PON')) : 'Unassigned' }}</td>
                            <td>{{ s.location || 'Pole/Chamber' }}</td>
                            <td class="font-monospace">{{ s.attenuation_db ? (s.attenuation_db + ' dB') : '3.5 dB' }}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger" @click="deleteSplitter(s.id)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="splittersList.length === 0">
                            <td colspan="8" class="text-center py-4 text-muted">
                                No fiber splitters configured. Click "Add Splitter" to build your FTTH distribution tree.
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                            <label class="form-label text-foreground small fw-bold text-uppercase">Upstream Parent Device</label>
                            <select v-model="newDep.parentDeviceId" class="form-select noc-input">
                                <option v-for="d in allSelectableEntities" :key="'p-' + d.id" :value="d.id">
                                    {{ d.name }} ({{ d.ip || d.type }})
                                </option>
                            </select>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Type</label>
                                <select v-model="newDep.linkType" class="form-select noc-input">
                                    <option value="FIBER">Fiber Optic</option>
                                    <option value="ETHERNET">Copper Ethernet</option>
                                    <option value="WIRELESS">Wireless PtP</option>
                                    <option value="LOGICAL">Logical / Tunnel</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Link Speed</label>
                                <select v-model="newDep.linkSpeed" class="form-select noc-input">
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
                                <input v-model="newDep.sourceInterface" type="text" class="form-control noc-input" placeholder="e.g. xe-0/0/1" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Target Interface</label>
                                <input v-model="newDep.targetInterface" type="text" class="form-control noc-input" placeholder="e.g. eth0 / Combo1" />
                            </div>
                        </div>
                        <div>
                            <label class="form-label text-foreground small fw-bold text-uppercase">Downstream Child Device</label>
                            <select v-model="newDep.childDeviceId" class="form-select noc-input">
                                <option v-for="d in allSelectableEntities" :key="'c-' + d.id" :value="d.id">
                                    {{ d.name }} ({{ d.ip || d.type }})
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showAddModal = false">Cancel</button>
                        <button
                            type="button"
                            class="btn noc-create-btn px-4 fw-bold"
                            :disabled="!newDep.parentDeviceId || !newDep.childDeviceId || newDep.parentDeviceId === newDep.childDeviceId"
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
    </div>
</template>

<script>
export default {
    data() {
        return {
            viewMode: "canvas", // 'canvas' | 'table' | 'splitters' | 'faults'
            mapMode: "LOGICAL", // 'LOGICAL' | 'FIBER' | 'OLT_PON' | 'SWITCH' | 'FAULTS' | 'PROBES'
            devices: [],
            probes: [],
            splittersList: [],
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
            showImportModal: false,
            editingLink: null,
            importJsonText: "",
            isFullscreen: false,

            // Tracing state
            highlightedDownstreamIds: [],
            highlightedUpstreamIds: [],

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
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        allSelectableEntities() {
            if (this.nodes.length > 0) {
                return this.nodes;
            }
            return this.devices;
        },
        onlineNodeCount() {
            return this.nodes.filter((n) => n.status === "UP").length;
        },
        downNodeCount() {
            return this.nodes.filter((n) => n.status === "DOWN").length;
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
                this.syncNodesWithLiveTelemetry();
            },
        },
        "$root.lastHeartbeatList": {
            deep: true,
            handler() {
                this.syncNodesWithLiveTelemetry();
            },
        },
    },
    mounted() {
        this.loadData();
    },
    methods: {
        loadData() {
            // Load devices
            this.$root.getSocket().emit("getDeviceList", (res) => {
                if (res && res.ok) {
                    this.devices = res.devices || [];
                }
                // Load probes
                this.$root.getSocket().emit("getProbeList", (pRes) => {
                    if (pRes && pRes.ok) {
                        this.probes = pRes.probes || [];
                    }
                    // Load splitters
                    this.$root.getSocket().emit("getFiberSplitters", (sRes) => {
                        if (sRes && sRes.ok) {
                            this.splittersList = sRes.splitters || [];
                        }
                        // Load active fiber faults
                        this.$root.getSocket().emit("getActiveFiberFaults", (fRes) => {
                            if (fRes && fRes.ok) {
                                this.activeFaults = fRes.faults || [];
                            }
                            this.buildNetworkNodes();
                            this.loadAllDependencies();
                        });
                    });
                });
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

            if (this.devices.length > 0) {
                initialList = this.devices.map((d) => ({
                    id: d.id,
                    name: d.name,
                    ip: d.ip_address || "10.0.0.1",
                    type: (d.device_type || "ROUTER").toUpperCase(),
                    status: (d.status || "UP").toUpperCase(),
                    site_id: d.site_id,
                    ping: "1.2ms",
                    monitor_id: null,
                    x: 100,
                    y: 100,
                }));
            } else {
                // Fallback to monitors
                const monList = Object.values(this.$root.monitorList || {});
                initialList = monList.map((m) => {
                    const beat = (this.$root.lastHeartbeatList || {})[m.id];
                    let st = "UP";
                    if (beat && beat.status === 0) st = "DOWN";
                    else if (beat && beat.status === 2) st = "PENDING";

                    return {
                        id: `mon-${m.id}`,
                        name: m.name,
                        ip: m.url || m.hostname || "1.1.1.1",
                        type: this.inferNodeType(m),
                        status: st,
                        ping: beat && beat.ping ? `${Math.round(beat.ping)}ms` : "2.1ms",
                        monitor_id: m.id,
                        x: 100,
                        y: 100,
                    };
                });
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
            for (const node of this.nodes) {
                if (node.monitor_id) {
                    const beat = (this.$root.lastHeartbeatList || {})[node.monitor_id];
                    if (beat) {
                        if (beat.status === 0) node.status = "DOWN";
                        else if (beat.status === 1) node.status = "UP";
                        else if (beat.status === 2) node.status = "PENDING";
                        if (beat.ping) {
                            node.ping = `${Math.round(beat.ping)}ms`;
                        }
                    }
                }
            }
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
            if (!this.newDep.parentDeviceId || !this.newDep.childDeviceId) {
                return;
            }
            this.$root.getSocket().emit("addDeviceDependency", this.newDep, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("Dependency link created");
                    this.showAddModal = false;
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

        // Splitter Actions
        saveSplitter() {
            this.$root.getSocket().emit("saveFiberSplitter", this.newSplitter, (res) => {
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
