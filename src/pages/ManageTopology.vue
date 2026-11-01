<template>
    <div class="noc-topology-page p-2 p-md-4" :class="{ 'fullscreen-mode': isFullscreen }">
        <!-- Top Toolbar -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom border-secondary pb-3">
            <div>
                <h1 class="h4 fw-bold mb-1 text-foreground d-flex align-items-center gap-2">
                    <font-awesome-icon icon="project-diagram" class="text-primary" />
                    <span>Network Topology & Infrastructure Map</span>
                </h1>
                <p class="text-muted small mb-0 font-monospace">
                    Interactive network graph, device hierarchy, and link telemetry for <span class="text-warning fw-bold">{{ activeOrgName }}</span>
                </p>
            </div>

            <div class="d-flex align-items-center gap-2 flex-wrap">
                <!-- View Mode Toggle: Interactive Canvas vs Table Links -->
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
                        <font-awesome-icon icon="list" class="me-1" /> Links Table ({{ dependencyList.length }})
                    </button>
                </div>

                <button class="btn btn-sm btn-outline-warning fw-semibold d-flex align-items-center gap-1" @click="autoLayoutNodes">
                    <font-awesome-icon icon="magic" />
                    <span class="d-none d-sm-inline">Auto Layout</span>
                </button>

                <button class="btn btn-sm btn-outline-success fw-semibold d-flex align-items-center gap-1" @click="saveNodePositions">
                    <font-awesome-icon icon="save" />
                    <span class="d-none d-sm-inline">Save Positions</span>
                </button>

                <button class="btn btn-sm noc-create-btn fw-bold px-3 d-flex align-items-center gap-2 shadow-sm" @click="showAddModal = true">
                    <font-awesome-icon icon="plus-circle" />
                    <span>Add Link</span>
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
                            placeholder="Find device or IP..."
                        />
                    </div>

                    <div class="btn-group btn-group-sm">
                        <button
                            v-for="type in ['ALL', 'ROUTER', 'SWITCH', 'SERVER', 'MONITOR']"
                            :key="type"
                            type="button"
                            class="btn btn-sm"
                            :class="filterType === type ? 'btn-secondary fw-bold text-foreground' : 'btn-outline-secondary text-muted'"
                            @click="filterType = type"
                        >
                            {{ type }}
                        </button>
                    </div>
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
                    width="4000"
                    height="3000"
                >
                    <defs>
                        <!-- Grid Pattern Background -->
                        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="20" cy="20" r="1" class="grid-dot" />
                        </pattern>

                        <!-- Marker: Healthy Directed Arrow -->
                        <marker id="arrow-healthy" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                        </marker>
                        <!-- Marker: Down Directed Arrow -->
                        <marker id="arrow-down" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                        </marker>
                    </defs>

                    <!-- Background Grid Rect -->
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                    <!-- Connection Links Layer -->
                    <g class="links-layer">
                        <g v-for="link in renderedLinks" :key="link.id" class="link-group">
                            <path
                                :d="link.path"
                                class="network-link-path"
                                :class="{
                                    'link-healthy': link.status === 'UP',
                                    'link-down': link.status === 'DOWN',
                                    'link-degraded': link.status === 'PENDING'
                                }"
                                :marker-end="link.status === 'DOWN' ? 'url(#arrow-down)' : 'url(#arrow-healthy)'"
                            />
                            <!-- Link Label Badge at Midpoint -->
                            <g :transform="`translate(${link.midX}, ${link.midY})`">
                                <rect x="-35" y="-10" width="70" height="20" rx="4" class="link-label-bg" />
                                <text x="0" y="4" text-anchor="middle" class="link-label-text">
                                    {{ link.dependency_type || 'LINK' }}
                                </text>
                            </g>
                        </g>
                    </g>

                    <!-- Device Nodes Layer -->
                    <g class="nodes-layer">
                        <g
                            v-for="node in filteredNodes"
                            :key="node.id"
                            class="device-node-group"
                            :class="{
                                'is-selected': selectedNode && selectedNode.id === node.id,
                                'is-down': node.status === 'DOWN',
                                'is-healthy': node.status === 'UP',
                                'is-warning': node.status === 'PENDING'
                            }"
                            :transform="`translate(${node.x}, ${node.y})`"
                            @mousedown.stop="handleNodeMouseDown($event, node)"
                            @click.stop="selectNode(node)"
                        >
                            <!-- Animated Pulse Glow Ring for Outages -->
                            <circle v-if="node.status === 'DOWN'" cx="90" cy="38" r="42" class="outage-pulse-circle" />

                            <!-- Main Node Card Box -->
                            <rect x="0" y="0" width="180" height="76" rx="10" class="node-box" />

                            <!-- Device Icon Badge Container -->
                            <rect x="12" y="14" width="46" height="48" rx="8" class="node-icon-bg" />

                            <!-- Device Icon Placeholder text/symbol -->
                            <text x="35" y="44" text-anchor="middle" class="node-icon-symbol">
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
                            <text x="68" y="62" class="node-type-badge">
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
                    <div class="small fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                        <span class="status-indicator-dot dot-green"></span>
                        <span>Online: {{ onlineNodeCount }}</span>
                        <span class="status-indicator-dot dot-red ms-2"></span>
                        <span>Down: {{ downNodeCount }}</span>
                    </div>
                    <div class="text-muted small" style="font-size: 0.68rem;">
                        Drag nodes to move · Scroll to zoom · Click to inspect
                    </div>
                </div>

                <!-- Slide-in Device Inspector Drawer -->
                <div v-if="selectedNode" class="node-inspector-drawer position-absolute top-0 end-0 h-100 p-3 bg-surface border-start border-secondary shadow-lg">
                    <div class="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-2">
                        <h6 class="fw-bold mb-0 text-foreground d-flex align-items-center gap-2">
                            <font-awesome-icon icon="info-circle" class="text-primary" />
                            <span>Device Inspector</span>
                        </h6>
                        <button type="button" class="btn-close btn-close-white btn-sm" @click="selectedNode = null"></button>
                    </div>

                    <div class="inspector-content d-flex flex-column gap-3 small">
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
                                <div v-for="p in getNodeParents(selectedNode.id)" :key="p.id" class="text-info fw-bold font-monospace">
                                    ↑ {{ p.name }} ({{ p.type }})
                                </div>
                            </div>
                            <div>
                                <span class="text-muted d-block small">Downstream Children:</span>
                                <div v-if="getNodeChildren(selectedNode.id).length === 0" class="text-muted fst-italic">None (Edge Device)</div>
                                <div v-for="c in getNodeChildren(selectedNode.id)" :key="c.id" class="text-warning fw-bold font-monospace">
                                    ↓ {{ c.name }} ({{ c.type }})
                                </div>
                            </div>
                        </div>

                        <!-- Quick Actions -->
                        <div class="d-flex flex-column gap-2 mt-auto">
                            <button
                                v-if="selectedNode.monitor_id"
                                class="btn btn-sm btn-primary fw-bold"
                                @click="$router.push(`/dashboard/${selectedNode.monitor_id}`)"
                            >
                                <font-awesome-icon icon="chart-line" class="me-1" /> View Live Telemetry
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
                        <span>Configured Dependency Links</span>
                    </h5>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                                    <th>Upstream Parent</th>
                                    <th>Link Relationship</th>
                                    <th>Downstream Child</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="link in dependencyList" :key="link.id">
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="network-wired" class="me-2 text-warning" />
                                        {{ getDeviceName(link.parent_device_id) }}
                                    </td>
                                    <td>
                                        <span class="badge bg-secondary font-monospace">
                                            <font-awesome-icon icon="long-arrow-alt-right" class="me-1" />
                                            {{ link.dependency_type }}
                                        </span>
                                    </td>
                                    <td class="fw-bold text-foreground">
                                        <font-awesome-icon icon="desktop" class="me-2 text-info" />
                                        {{ getDeviceName(link.child_device_id) }}
                                    </td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-danger" title="Remove Link" @click="deleteLink(link.id)">
                                            <font-awesome-icon icon="trash" />
                                        </button>
                                    </td>
                                </tr>
                                <tr v-if="dependencyList.length === 0">
                                    <td colspan="4" class="text-center py-5 text-muted">
                                        <font-awesome-icon icon="sitemap" class="display-3 mb-3 text-secondary" />
                                        <h5>No Dependency Links Configured</h5>
                                        <p class="small text-secondary">Establish parent-child relationships between Core Routers, Switches, OLTs, and Servers to enable automated alert storm suppression.</p>
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
                        &nbsp;&nbsp;&nbsp;└─ OLT 01 (Suppressed) <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ ONU (Suppressed)
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Dependency Link -->
        <div v-if="showAddModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="sitemap" />
                            <span>Add Dependency Relationship</span>
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
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Dependency Type</label>
                            <select v-model="newDep.dependencyType" class="form-select noc-input">
                                <option value="UPSTREAM">UPSTREAM (Parent feeds network to child)</option>
                                <option value="DOWNSTREAM">DOWNSTREAM (Child connects to parent)</option>
                                <option value="DEPENDS_ON">DEPENDS_ON (Strict operational dependency)</option>
                            </select>
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
    </div>
</template>

<script>
export default {
    data() {
        return {
            viewMode: "canvas", // 'canvas' | 'table'
            devices: [],
            dependencyList: [],
            nodes: [],
            selectedNode: null,
            searchQuery: "",
            filterType: "ALL",
            showAddModal: false,
            isFullscreen: false,

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
                    // Center coordinates of cards
                    const x1 = parent.x + 90;
                    const y1 = parent.y + 76;
                    const x2 = child.x + 90;
                    const y2 = child.y;

                    // Quadratic Bezier Curve
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const cx = x1 + dx * 0.5;
                    const cy = y1 + dy * 0.5;
                    const path = `M ${x1} ${y1} Q ${cx} ${cy - 20} ${x2} ${y2}`;

                    const status = parent.status === "DOWN" || child.status === "DOWN" ? "DOWN" : "UP";

                    list.push({
                        id: dep.id || `${parent.id}-${child.id}`,
                        path,
                        midX: cx,
                        midY: cy - 10,
                        dependency_type: dep.dependency_type || "UPSTREAM",
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
            this.$root.getSocket().emit("getDeviceList", (res) => {
                if (res && res.ok) {
                    this.devices = res.devices || [];
                }
                this.buildNetworkNodes();
                this.loadAllDependencies();
            });
        },
        loadAllDependencies() {
            this.dependencyList = [];
            if (this.devices.length === 0) {
                // If no physical devices, auto-connect core monitors into a demo topology if desired
                return;
            }
            for (const d of this.devices) {
                this.$root.getSocket().emit("getDeviceDependencies", d.id, (res) => {
                    if (res && res.ok && res.children) {
                        for (const childLink of res.children) {
                            if (!this.dependencyList.some((x) => x.id === childLink.id)) {
                                this.dependencyList.push(childLink);
                            }
                        }
                    }
                });
            }
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
                    ping: "1.2ms",
                    monitor_id: null,
                    x: 100,
                    y: 100,
                }));
            } else {
                // Transform monitors into nodes if no devices exist
                const monList = Object.values(this.$root.monitorList || {});
                initialList = monList.map((m) => {
                    const beat = (this.$root.lastHeartbeatList || {})[m.id];
                    let st = "UP";
                    if (beat && beat.status === 0) st = "DOWN";
                    else if (beat && beat.status === 2) st = "PENDING";

                    return {
                        id: m.id,
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

            // Apply saved or auto positions
            this.nodes = initialList.map((node, index) => {
                if (savedPositions[node.id]) {
                    node.x = savedPositions[node.id].x;
                    node.y = savedPositions[node.id].y;
                } else {
                    // Position in tiered grid
                    const cols = 3;
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
            if (name.includes("server") || name.includes("api") || name.includes("db") || type.includes("http")) return "SERVER";
            return "MONITOR";
        },
        getNodeIconSymbol(type) {
            switch (type) {
                case "ROUTER": return "☵";
                case "SWITCH": return "🔀";
                case "SERVER": return "🖳";
                case "OLT": return "📡";
                case "FIREWALL": return "🛡";
                default: return "●";
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
            const tiers = { ROUTER: [], SWITCH: [], OLT: [], SERVER: [], MONITOR: [] };
            for (const n of this.nodes) {
                if (tiers[n.type]) {
                    tiers[n.type].push(n);
                } else {
                    tiers.MONITOR.push(n);
                }
            }

            let currentY = 100;
            for (const tierKey of ["ROUTER", "SWITCH", "OLT", "SERVER", "MONITOR"]) {
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
            if (this.nodes.length === 0) return;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const n of this.nodes) {
                if (n.x < minX) minX = n.x;
                if (n.x > maxX) maxX = n.x + 180;
                if (n.y < minY) minY = n.y;
                if (n.y > maxY) maxY = n.y + 76;
            }
            this.panX = 50 - minX;
            this.panY = 50 - minY;
            this.zoomLevel = 0.85;
        },
        resetView() {
            this.panX = 80;
            this.panY = 80;
            this.zoomLevel = 1.0;
        },

        // Node Interaction
        handleNodeMouseDown(e, node) {
            if (e.button === 0) {
                this.draggingNode = node;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
            }
        },
        selectNode(node) {
            this.selectedNode = node;
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
        deleteLink(linkId) {
            if (confirm("Delete this network dependency link?")) {
                this.$root.getSocket().emit("deleteDeviceDependency", linkId, (res) => {
                    if (res && res.ok) {
                        this.$root.toastSuccess("Dependency link removed");
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
    width: 320px;
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
</style>
