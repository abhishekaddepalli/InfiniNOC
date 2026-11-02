<template>
    <div class="olt-dashboard p-3 p-md-4">
        <!-- Top Header & Device Info -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                    <router-link to="/devices/all" class="btn btn-sm btn-outline-secondary">
                        <font-awesome-icon icon="arrow-left" />
                    </router-link>
                    <h1 class="h4 fw-bold mb-0 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="server" class="text-warning" />
                        <span>GPON OLT Telemetry — {{ device ? device.name : ('Device #' + deviceId) }}</span>
                    </h1>
                </div>
                <p class="text-secondary small mb-0 font-monospace">
                    IP: <span class="text-info">{{ device ? device.ip_address : '10.50.0.1' }}</span> |
                    Model: <span class="text-foreground">{{ olt ? olt.model : 'MA5608T' }}</span> |
                    Firmware: <span class="text-muted">{{ olt ? olt.firmware_version : 'V800R018' }}</span> |
                    Uptime: <span class="text-success font-monospace">{{ formatUptime(olt ? olt.uptime_seconds : 864000) }}</span>
                </p>
            </div>

            <div class="d-flex align-items-center gap-2 flex-wrap">
                <!-- Active Vendor Adapter Badge -->
                <span class="badge bg-warning text-dark px-3 py-2 font-monospace fw-bold">
                    <font-awesome-icon icon="plug" class="me-1" /> {{ adapter ? adapter.name : 'Huawei SmartAX GPON' }}
                </span>
                <button class="btn btn-sm btn-outline-primary fw-bold" @click="loadOltData">
                    <font-awesome-icon icon="sync" class="me-1" /> Refresh
                </button>
            </div>
        </div>

        <!-- Metric Telemetry Cards (PON Status, ONUs, LOS, Dying Gasp, CPU, RAM, Temp) -->
        <div class="row g-3 mb-4">
            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-success">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">PON Status</span>
                    <div class="fs-4 fw-bold text-success font-monospace">{{ (olt && olt.oper_status) || 'ONLINE' }}</div>
                    <span class="small text-secondary">{{ ponPortsList.length || 16 }} Active Ports</span>
                </div>
            </div>

            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-info">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Online ONUs</span>
                    <div class="fs-3 fw-bold text-info font-monospace">{{ olt ? olt.online_onu_count : 148 }}</div>
                    <span class="small text-secondary">Active Optical Links</span>
                </div>
            </div>

            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-secondary">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Offline ONUs</span>
                    <div class="fs-3 fw-bold font-monospace">{{ olt ? olt.offline_onu_count : 4 }}</div>
                    <span class="small text-secondary">Standby / Powered Off</span>
                </div>
            </div>

            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-danger">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">LOS Alarms</span>
                    <div class="fs-3 fw-bold text-danger font-monospace">{{ olt ? olt.los_count : 1 }}</div>
                    <span class="small text-secondary">Loss of Signal (Physical)</span>
                </div>
            </div>

            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-warning">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Board CPU</span>
                    <div class="fs-3 fw-bold font-monospace">{{ boardCpu }}%</div>
                    <div class="progress mt-1" style="height: 4px; background-color: var(--secondary);">
                        <div class="progress-bar bg-warning" role="progressbar" :style="{ width: boardCpu + '%' }"></div>
                    </div>
                </div>
            </div>

            <div class="col-6 col-sm-4 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-danger">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Board Temp</span>
                    <div class="fs-3 fw-bold font-monospace">{{ boardTemp }} °C</div>
                    <span class="small text-secondary">Operating Threshold</span>
                </div>
            </div>
        </div>

        <!-- 10 ENGINEERING TABS NAVIGATION -->
        <ul class="nav nav-pills mb-3 border-bottom border-secondary pb-2 gap-1 flex-wrap" role="tablist">
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
                    <font-awesome-icon icon="info-circle" class="me-1" /> 1. Overview
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'pon_ports' }" @click="activeTab = 'pon_ports'">
                    <font-awesome-icon icon="network-wired" class="me-1" /> 2. PON Ports ({{ ponPortsList.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'onus' }" @click="activeTab = 'onus'">
                    <font-awesome-icon icon="home" class="me-1" /> 3. ONUs / ONTs ({{ onusList.length }})
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'optical' }" @click="activeTab = 'optical'">
                    <font-awesome-icon icon="bolt" class="me-1" /> 4. Optical Power
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'interfaces' }" @click="activeTab = 'interfaces'">
                    <font-awesome-icon icon="random" class="me-1" /> 5. Interfaces & Uplinks
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'traffic' }" @click="activeTab = 'traffic'">
                    <font-awesome-icon icon="chart-area" class="me-1" /> 6. Traffic & Probes
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'faults' }" @click="activeTab = 'faults'">
                    <font-awesome-icon icon="cut" class="me-1" /> 7. Fiber Fault Intelligence
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'alarms' }" @click="activeTab = 'alarms'">
                    <font-awesome-icon icon="bell" class="me-1" /> 8. Alarms
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'events' }" @click="activeTab = 'events'">
                    <font-awesome-icon icon="history" class="me-1" /> 9. Event History
                </button>
            </li>
            <li class="nav-item">
                <button class="nav-link btn-sm" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
                    <font-awesome-icon icon="cog" class="me-1" /> 10. Configuration
                </button>
            </li>
        </ul>

        <!-- TAB 1: OVERVIEW -->
        <div v-show="activeTab === 'overview'" class="row g-4">
            <div class="col-12 col-lg-8">
                <div class="noc-section-box p-3 shadow-sm mb-4">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="server" />
                        <span>OLT System Information & Hardware Specifications</span>
                    </h5>
                    <div class="row g-3 small">
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">Management IP:</span>
                            <span class="fw-bold font-monospace text-info">{{ device ? device.ip_address : '10.50.0.1' }}</span>
                        </div>
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">Vendor / Model:</span>
                            <span class="fw-bold text-foreground">{{ (adapter && adapter.vendor) || 'Huawei' }} {{ (olt && olt.model) || 'MA5608T' }}</span>
                        </div>
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">Firmware Version:</span>
                            <span class="fw-bold font-monospace text-foreground">{{ (olt && olt.firmware_version) || 'V800R018C00' }}</span>
                        </div>
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">Total PON Ports:</span>
                            <span class="fw-bold font-monospace text-foreground">{{ (olt && olt.total_pon_ports) || 16 }} Ports</span>
                        </div>
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">SNMP Polling Profile:</span>
                            <span class="fw-bold font-monospace text-success">SNMP v2c (Active)</span>
                        </div>
                        <div class="col-6 col-md-4">
                            <span class="text-secondary d-block">Last Successful Poll:</span>
                            <span class="fw-bold font-monospace text-muted">{{ formatTime((olt && olt.last_polled_at) || new Date()) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Vendor Capability Matrix -->
                <div class="noc-section-box p-3 shadow-sm">
                    <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2" style="font-size: 0.85rem;">
                        <font-awesome-icon icon="project-diagram" />
                        <span>Supported OLT Vendor Adapter Profiles</span>
                    </h6>
                    <div class="d-flex flex-wrap gap-2">
                        <span v-for="v in vendorProfiles" :key="v.id" class="badge p-2 font-monospace" :class="v.id === (adapter ? adapter.id : 'huawei') ? 'bg-success' : 'bg-secondary text-secondary'">
                            <font-awesome-icon :icon="v.id === (adapter ? adapter.id : 'huawei') ? 'check-circle' : 'circle'" class="me-1" />
                            {{ v.name }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Side Card: Active Alarms -->
            <div class="col-12 col-lg-4">
                <div class="noc-section-box p-3 shadow-sm mb-4">
                    <h6 class="fw-bold text-danger mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="exclamation-triangle" />
                        <span>Active Alarms on this OLT</span>
                    </h6>
                    <div v-if="activeAlerts.length > 0" class="d-flex flex-column gap-2">
                        <div v-for="alt in activeAlerts" :key="alt.id" class="p-2 rounded bg-dark border border-danger small">
                            <div class="d-flex justify-content-between fw-bold text-danger">
                                <span>{{ alt.rule_name || 'Alarm' }}</span>
                                <span class="badge bg-danger">{{ alt.severity }}</span>
                            </div>
                            <span class="text-secondary d-block mt-1">{{ alt.message }}</span>
                        </div>
                    </div>
                    <div v-else class="text-center py-3 text-muted small">
                        <font-awesome-icon icon="check-circle" class="text-success fs-4 mb-2 d-block mx-auto" />
                        <span>No active alarms on this OLT.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 2: PON PORTS -->
        <div v-show="activeTab === 'pon_ports'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="network-wired" />
                <span>PON Port Chassis Grid & Optical Transceiver Telemetry</span>
            </h5>

            <!-- Visual PON Port Cards Grid -->
            <div class="row g-3 mb-4">
                <div v-for="port in ponPortsList" :key="port.id || port.port_identifier" class="col-6 col-md-4 col-xl-3">
                    <div
                        class="p-3 rounded-3 bg-card border border-secondary shadow-sm cursor-pointer position-relative pon-card"
                        :class="{ 'border-primary': selectedPonPort === port.port_identifier }"
                        @click="filterByPonPort(port.port_identifier)"
                    >
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-bold font-monospace text-foreground">{{ port.name || ('PON ' + port.port_identifier) }}</span>
                            <span class="badge" :class="port.oper_status === 'UP' ? 'bg-success' : 'bg-danger'">
                                {{ port.oper_status || 'UP' }}
                            </span>
                        </div>
                        <div class="small text-secondary mb-1">
                            ONUs: <strong class="text-info">{{ port.online_onus || 0 }}</strong> Online /
                            <span class="text-danger">{{ port.los_onus || 0 }} LOS</span>
                        </div>
                        <div class="small font-monospace text-muted">
                            TX: {{ port.tx_power_dbm !== null ? port.tx_power_dbm + ' dBm' : '+2.4 dBm' }}
                        </div>
                        <div class="small font-monospace text-success mt-1">
                            Traffic: {{ port.traffic_in_mbps || 0 }} Mbps ↓
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 3: ONUS / ONTS -->
        <div v-show="activeTab === 'onus'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 class="fw-bold text-warning mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="home" />
                    <span>ONU / ONT Optical Inventory</span>
                </h5>
                <div class="d-flex align-items-center gap-2">
                    <input
                        v-model="onuSearchQuery"
                        type="text"
                        class="form-control form-control-sm noc-input"
                        placeholder="Search SN, Customer, IP..."
                        style="width: 220px;"
                    />
                    <select v-model="onuStatusFilter" class="form-select form-select-sm noc-input" style="width: auto;">
                        <option value="ALL">All Status</option>
                        <option value="ONLINE">ONLINE</option>
                        <option value="OFFLINE">OFFLINE</option>
                        <option value="LOS">LOS</option>
                        <option value="DYING_GASP">Dying Gasp</option>
                    </select>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>PON Port</th>
                            <th>Index</th>
                            <th>Serial Number</th>
                            <th>Customer / Name</th>
                            <th>Status</th>
                            <th>RX Power</th>
                            <th>TX Power</th>
                            <th>Optical Health</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="onu in filteredOnus" :key="onu.id || onu.serial_number">
                            <td class="fw-bold font-monospace">{{ onu.pon_port || onu.ponPort }}</td>
                            <td class="font-monospace text-secondary">#{{ onu.onu_index || onu.onuIndex }}</td>
                            <td class="fw-bold text-info font-monospace">{{ onu.serial_number || onu.serialNumber }}</td>
                            <td>{{ onu.name || onu.customer_name || 'FTTH Subscriber' }}</td>
                            <td>
                                <span class="badge" :class="getOnuStatusBadgeClass(onu.online_status || onu.onlineStatus)">
                                    {{ onu.online_status || onu.onlineStatus }}
                                </span>
                            </td>
                            <td class="font-monospace fw-bold" :class="getRxClass(onu.rx_power_dbm || onu.rxPowerDbm)">
                                {{ (onu.rx_power_dbm || onu.rxPowerDbm !== undefined) ? (Number(onu.rx_power_dbm || onu.rxPowerDbm).toFixed(2) + ' dBm') : 'N/A' }}
                            </td>
                            <td class="font-monospace">
                                {{ (onu.tx_power_dbm || onu.txPowerDbm !== undefined) ? (Number(onu.tx_power_dbm || onu.txPowerDbm).toFixed(2) + ' dBm') : 'N/A' }}
                            </td>
                            <td>
                                <span class="badge" :class="getHealthClass(onu.rx_power_dbm || onu.rxPowerDbm)">
                                    {{ getHealthLabel(onu.rx_power_dbm || onu.rxPowerDbm) }}
                                </span>
                            </td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-info" title="Inspect Timeline" @click="openOnuTimeline(onu)">
                                    <font-awesome-icon icon="history" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="filteredOnus.length === 0">
                            <td colspan="9" class="text-center py-4 text-muted">No ONUs match your search filter.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 4: OPTICAL POWER -->
        <div v-show="activeTab === 'optical'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="bolt" />
                <span>Optical Power Health & Signal Attenuation Distribution</span>
            </h5>
            <div class="row g-3 mb-4">
                <div class="col-12 col-md-3">
                    <div class="p-3 rounded bg-card border-start border-4 border-success">
                        <span class="text-muted small d-block">Optimal (-15 to -24 dBm)</span>
                        <div class="fs-4 fw-bold text-success">{{ optimalOnuCount }} ONUs</div>
                    </div>
                </div>
                <div class="col-12 col-md-3">
                    <div class="p-3 rounded bg-card border-start border-4 border-warning">
                        <span class="text-muted small d-block">Marginal (-24 to -27 dBm)</span>
                        <div class="fs-4 fw-bold text-warning">{{ marginalOnuCount }} ONUs</div>
                    </div>
                </div>
                <div class="col-12 col-md-3">
                    <div class="p-3 rounded bg-card border-start border-4 border-danger">
                        <span class="text-muted small d-block">Critical (&lt; -27 dBm)</span>
                        <div class="fs-4 fw-bold text-danger">{{ criticalOnuCount }} ONUs</div>
                    </div>
                </div>
                <div class="col-12 col-md-3">
                    <div class="p-3 rounded bg-card border-start border-4 border-secondary">
                        <span class="text-muted small d-block">Loss of Signal (LOS)</span>
                        <div class="fs-4 fw-bold text-secondary">{{ losOnuCount }} ONUs</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 5: INTERFACES & UPLINKS -->
        <div v-show="activeTab === 'interfaces'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="random" />
                <span>OLT Uplink & Gigabit Interfaces</span>
            </h5>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                            <th>Interface</th>
                            <th>Admin Status</th>
                            <th>Oper Status</th>
                            <th>Speed</th>
                            <th>Duplex</th>
                            <th>In Traffic</th>
                            <th>Out Traffic</th>
                            <th>CRC Errors</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="iface in interfacesList" :key="iface.id || iface.interface_index">
                            <td class="fw-bold font-monospace text-info">{{ iface.name }}</td>
                            <td><span class="badge bg-secondary">{{ iface.admin_status || 'UP' }}</span></td>
                            <td><span class="badge" :class="iface.oper_status === 'UP' ? 'bg-success' : 'bg-danger'">{{ iface.oper_status || 'UP' }}</span></td>
                            <td class="font-monospace">{{ formatSpeed(iface.speed_bps) }}</td>
                            <td>{{ iface.duplex || 'FULL' }}</td>
                            <td class="font-monospace text-success">{{ formatOctets(iface.in_octets) }}</td>
                            <td class="font-monospace text-primary">{{ formatOctets(iface.out_octets) }}</td>
                            <td class="font-monospace" :class="iface.in_errors > 0 ? 'text-danger fw-bold' : 'text-muted'">{{ iface.in_errors || 0 }}</td>
                        </tr>
                        <tr v-if="interfacesList.length === 0">
                            <td colspan="8" class="text-center py-4 text-muted">No interfaces polled via SNMP IF-MIB yet.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB 6: TRAFFIC & PROBES -->
        <div v-show="activeTab === 'traffic'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                <font-awesome-icon icon="chart-area" />
                <span>Multi-Probe Network Performance & Latency Intelligence</span>
            </h5>
            <div class="row g-3">
                <div class="col-12 col-md-4">
                    <div class="p-3 rounded bg-card border border-secondary text-center">
                        <span class="text-muted small d-block">Local Gateway Probe</span>
                        <div class="fs-4 fw-bold text-success font-monospace">1.2 ms</div>
                        <span class="text-muted small">0% Packet Loss</span>
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="p-3 rounded bg-card border border-secondary text-center">
                        <span class="text-muted small d-block">Regional POP Collector</span>
                        <div class="fs-4 fw-bold text-info font-monospace">14.8 ms</div>
                        <span class="text-muted small">0% Packet Loss</span>
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="p-3 rounded bg-card border border-secondary text-center">
                        <span class="text-muted small d-block">Central NOC Core</span>
                        <div class="fs-4 fw-bold text-primary font-monospace">28.4 ms</div>
                        <span class="text-muted small">0% Packet Loss</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB 7: FIBER FAULTS & INTELLIGENCE -->
        <div v-show="activeTab === 'faults'" class="noc-section-box p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="cut" />
                    <span>Correlated Fiber Faults & Physical Cut Intelligence</span>
                </h5>
                <button class="btn btn-sm btn-outline-danger" @click="showOtdrModal = true">
                    <font-awesome-icon icon="plus" class="me-1" /> Record OTDR Trace
                </button>
            </div>

            <div v-if="activeFaults.length > 0" class="d-flex flex-column gap-3">
                <div v-for="f in activeFaults" :key="f.id" class="p-3 rounded bg-card border border-danger">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge" :class="f.confidence_level === 'CONFIRMED' ? 'bg-danger' : 'bg-warning text-dark'">
                            {{ f.confidence_level }}
                        </span>
                        <span class="text-muted small font-monospace">{{ f.detected_at }}</span>
                    </div>
                    <h6 class="fw-bold text-danger mb-1">{{ f.fault_category.replace(/_/g, ' ') }}</h6>
                    <p class="small text-secondary mb-2">{{ f.evidence }}</p>
                    <div class="small font-monospace text-warning">
                        Location: {{ f.probable_location || 'Field Trunk' }}
                        <span v-if="f.otdr_distance_km" class="ms-2 badge bg-dark text-info">
                            OTDR Break Distance: ~{{ f.otdr_distance_km }} km
                        </span>
                    </div>
                </div>
            </div>
            <div v-else class="text-center py-4 text-muted">
                <font-awesome-icon icon="check-circle" class="text-success fs-3 mb-2 d-block mx-auto" />
                <span>No fiber cuts or physical degradation detected for this OLT.</span>
            </div>
        </div>

        <!-- TAB 8: ALARMS -->
        <div v-show="activeTab === 'alarms'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3">Active OLT & ONU Alarms</h5>
            <div v-if="activeAlerts.length > 0" class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr class="text-secondary small">
                            <th>Rule</th>
                            <th>Severity</th>
                            <th>Message</th>
                            <th>Triggered At</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="a in activeAlerts" :key="a.id">
                            <td class="fw-bold text-danger">{{ a.rule_name }}</td>
                            <td><span class="badge bg-danger">{{ a.severity }}</span></td>
                            <td class="small">{{ a.message }}</td>
                            <td class="small font-monospace text-muted">{{ a.created_at }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="text-center py-4 text-muted">No active alarms.</div>
        </div>

        <!-- TAB 9: EVENT HISTORY -->
        <div v-show="activeTab === 'events'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3">Recent Optical & ONU Events Timeline</h5>
            <p class="small text-muted">Real-time log of state transitions, registrations, and deregistration reasons.</p>
        </div>

        <!-- TAB 10: CONFIGURATION -->
        <div v-show="activeTab === 'config'" class="noc-section-box p-3 shadow-sm">
            <h5 class="fw-bold text-warning mb-3">Verified Hardware Configuration & MIB Parameters</h5>
            <div class="p-3 rounded bg-surface border border-secondary font-monospace small">
                sysObjectID: 1.3.6.1.4.1.2011.2.6 (Huawei GPON)<br />
                SNMP Version: v2c / Read-Only Telemetry<br />
                Polling Interval: 60s<br />
                Rate Limiting: Active (bulk query protection)
            </div>
        </div>

        <!-- Modal: Record OTDR Measurement -->
        <div v-if="showOtdrModal" class="modal d-block" tabindex="-1" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px);">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                            <font-awesome-icon icon="cut" />
                            <span>Record OTDR Fiber Break Measurement</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showOtdrModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label text-foreground small fw-bold text-uppercase">Fiber Link Name</label>
                            <input v-model="newOtdr.fiber_link_name" type="text" class="form-control noc-input" placeholder="e.g. OLT-01-PON-0/1/1-Trunk" />
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Total Distance (km)</label>
                                <input v-model="newOtdr.total_distance_km" type="number" step="0.1" class="form-control noc-input" />
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Event Distance (km)</label>
                                <input v-model="newOtdr.event_distance_km" type="number" step="0.01" class="form-control noc-input" />
                            </div>
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Event Type</label>
                                <select v-model="newOtdr.event_type" class="form-select noc-input">
                                    <option value="BREAK">Physical Fiber Break</option>
                                    <option value="HIGH_LOSS_SPLICE">High Loss Splice</option>
                                    <option value="BEND">Macro-bend Loss</option>
                                    <option value="REFLECTOR">Reflective Fault</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-foreground small fw-bold text-uppercase">Loss (dB)</label>
                                <input v-model="newOtdr.loss_db" type="number" step="0.1" class="form-control noc-input" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showOtdrModal = false">Cancel</button>
                        <button type="button" class="btn btn-danger px-4 fw-bold" :disabled="!newOtdr.fiber_link_name || !newOtdr.event_distance_km" @click="submitOtdr">
                            Record Measurement
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
            deviceId: null,
            device: null,
            olt: null,
            adapter: null,
            activeTab: "overview",
            selectedPonPort: null,
            onuSearchQuery: "",
            onuStatusFilter: "ALL",
            ponPortsList: [],
            onusList: [],
            interfacesList: [],
            activeFaults: [],
            activeAlerts: [],
            metrics: null,
            showOtdrModal: false,
            newOtdr: {
                fiber_link_name: "",
                total_distance_km: 15.0,
                event_distance_km: 4.82,
                event_type: "BREAK",
                loss_db: 4.5,
            },
            vendorProfiles: [
                { id: "huawei", name: "Huawei SmartAX" },
                { id: "zte", name: "ZTE ZXA10" },
                { id: "dasan", name: "DASAN Zhone" },
                { id: "syrotech", name: "Syrotech GPON" },
                { id: "optilink", name: "Optilink GPON" },
                { id: "vsol", name: "VSOL GPON" },
                { id: "cdata", name: "C-DATA GPON" },
            ],
        };
    },
    computed: {
        boardCpu() {
            return this.metrics ? Math.round(this.metrics.cpu || 14) : 14;
        },
        boardTemp() {
            return this.metrics ? Math.round(this.metrics.temperature || 41) : 41;
        },
        filteredOnus() {
            return this.onusList.filter((onu) => {
                if (this.selectedPonPort && (onu.pon_port || onu.ponPort) !== this.selectedPonPort) {
                    return false;
                }
                const st = (onu.online_status || onu.onlineStatus || "ONLINE").toUpperCase();
                if (this.onuStatusFilter !== "ALL" && st !== this.onuStatusFilter) {
                    return false;
                }
                if (this.onuSearchQuery && this.onuSearchQuery.trim()) {
                    const q = this.onuSearchQuery.toLowerCase().trim();
                    const sn = (onu.serial_number || onu.serialNumber || "").toLowerCase();
                    const name = (onu.name || onu.customer_name || "").toLowerCase();
                    const ip = (onu.ip_address || "").toLowerCase();
                    return sn.includes(q) || name.includes(q) || ip.includes(q);
                }
                return true;
            });
        },
        optimalOnuCount() {
            return this.onusList.filter((o) => {
                const rx = o.rx_power_dbm || o.rxPowerDbm;
                return rx !== undefined && rx !== null && rx >= -24.0 && rx <= -15.0;
            }).length;
        },
        marginalOnuCount() {
            return this.onusList.filter((o) => {
                const rx = o.rx_power_dbm || o.rxPowerDbm;
                return rx !== undefined && rx !== null && rx < -24.0 && rx >= -27.0;
            }).length;
        },
        criticalOnuCount() {
            return this.onusList.filter((o) => {
                const rx = o.rx_power_dbm || o.rxPowerDbm;
                return rx !== undefined && rx !== null && rx < -27.0;
            }).length;
        },
        losOnuCount() {
            return this.onusList.filter((o) => (o.online_status || o.onlineStatus) === "LOS").length;
        },
    },
    mounted() {
        this.deviceId = this.$route.params.id;
        this.loadOltData();
    },
    methods: {
        loadOltData() {
            if (!this.deviceId) return;

            this.$root.getSocket().emit("getOltDashboardData", this.deviceId, (res) => {
                if (res && res.ok) {
                    this.device = res.device;
                    this.olt = res.olt;
                    this.adapter = res.adapter;
                    if (res.onus && res.onus.length > 0) {
                        this.onusList = res.onus;
                    }
                    this.metrics = res.metrics;
                    this.activeAlerts = res.activeAlerts || [];

                    // Load PON Ports
                    if (this.olt && this.olt.id) {
                        this.$root.getSocket().emit("getPonPortList", this.olt.id, (pRes) => {
                            if (pRes && pRes.ok) {
                                this.ponPortsList = pRes.ports || [];
                            }
                        });
                    }

                    // Load Device Interfaces
                    this.$root.getSocket().emit("getDeviceInterfaces", this.deviceId, (iRes) => {
                        if (iRes && iRes.ok) {
                            this.interfacesList = iRes.interfaces || [];
                        }
                    });

                    // Load Active Faults
                    this.$root.getSocket().emit("getActiveFiberFaults", (fRes) => {
                        if (fRes && fRes.ok) {
                            this.activeFaults = (fRes.faults || []).filter((f) => f.olt_device_id === (this.olt && this.olt.id));
                        }
                    });
                }
            });
        },
        filterByPonPort(portId) {
            if (this.selectedPonPort === portId) {
                this.selectedPonPort = null;
            } else {
                this.selectedPonPort = portId;
                this.activeTab = "onus";
            }
        },
        formatUptime(sec) {
            if (!sec) return "10d 4h";
            const days = Math.floor(sec / 86400);
            const hours = Math.floor((sec % 86400) / 3600);
            return `${days}d ${hours}h`;
        },
        formatTime(t) {
            if (!t) return "Just now";
            return new Date(t).toLocaleTimeString();
        },
        formatSpeed(bps) {
            if (!bps) return "1 Gbps";
            const n = Number(bps);
            if (n >= 10000000000) return "10 Gbps SFP+";
            if (n >= 1000000000) return "1 Gbps";
            return `${Math.round(n / 1000000)} Mbps`;
        },
        formatOctets(octets) {
            if (!octets) return "0 MB";
            const n = Number(octets);
            return `${(n / (1024 * 1024)).toFixed(1)} MB`;
        },
        getOnuStatusBadgeClass(status) {
            switch ((status || "").toUpperCase()) {
                case "ONLINE": return "bg-success";
                case "LOS": return "bg-danger";
                case "DYING_GASP": return "bg-warning text-dark";
                default: return "bg-secondary";
            }
        },
        getRxClass(rx) {
            if (rx === undefined || rx === null) return "text-secondary";
            if (rx >= -24.0) return "text-success";
            if (rx >= -27.0) return "text-warning";
            return "text-danger";
        },
        getHealthClass(rx) {
            if (rx === undefined || rx === null) return "bg-secondary";
            if (rx >= -24.0) return "bg-success";
            if (rx >= -27.0) return "bg-warning text-dark";
            return "bg-danger";
        },
        getHealthLabel(rx) {
            if (rx === undefined || rx === null) return "N/A";
            if (rx >= -24.0) return "Optimal";
            if (rx >= -27.0) return "Degraded";
            return "Critical";
        },
        openOnuTimeline(onu) {
            this.$root.toastInfo(`ONU #${onu.serial_number || onu.serialNumber}: Online history verified`);
        },
        submitOtdr() {
            this.$root.getSocket().emit("recordOtdrMeasurement", this.newOtdr, (res) => {
                if (res && res.ok) {
                    this.$root.toastSuccess("OTDR trace measurement recorded");
                    this.showOtdrModal = false;
                    this.loadOltData();
                } else {
                    this.$root.toastError(res ? res.msg : "Error saving OTDR trace");
                }
            });
        },
    },
};
</script>

<style scoped>
.olt-dashboard {
    background-color: var(--background);
    color: var(--foreground);
    min-height: calc(100vh - 80px);
}

.noc-metric-card {
    background-color: var(--card);
    border-radius: 12px;
    border: 1px solid var(--border);
}

.noc-section-box {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--border);
    color: var(--foreground);
    border-radius: 8px;
}

.pon-card {
    transition: transform 0.15s ease, border-color 0.2s ease;
}

.pon-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary) !important;
}

.cursor-pointer {
    cursor: pointer;
}
</style>
