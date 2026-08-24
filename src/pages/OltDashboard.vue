<template>
    <div class="olt-dashboard p-3 p-md-4">
        <!-- Top Header & Device Info -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                    <router-link to="/devices/all" class="btn btn-sm btn-outline-secondary">
                        <font-awesome-icon icon="arrow-left" />
                    </router-link>
                    <h1 class="h3 fw-bold mb-0 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="server" class="text-warning" />
                        <span>GPON OLT Telemetry — {{ device ? device.name : ('Device #' + deviceId) }}</span>
                    </h1>
                </div>
                <p class="text-secondary small mb-0 font-monospace">
                    IP: <span class="text-info">{{ device ? device.ip_address : '10.50.0.1' }}</span> |
                    Model: <span>{{ olt ? olt.model : 'MA5608T' }}</span> |
                    Firmware: <span class="text-secondary">{{ olt ? olt.firmware_version : 'V800R018' }}</span>
                </p>
            </div>

            <!-- Active Vendor Adapter Badge -->
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-warning text-dark px-3 py-2 font-monospace fw-bold">
                    <font-awesome-icon icon="plug" class="me-1" /> Adapter: {{ adapter ? adapter.name : 'Huawei SmartAX GPON' }}
                </span>
            </div>
        </div>

        <!-- Vendor Capability Matrix Badge Ribbon -->
        <div class="noc-section-box p-3 mb-4 shadow-sm">
            <h6 class="fw-bold text-warning mb-2 d-flex align-items-center gap-2" style="font-size: 0.85rem;">
                <font-awesome-icon icon="project-diagram" />
                <span>Supported OLT Vendor Adapter Profiles (Extensible Architecture)</span>
            </h6>
            <div class="d-flex flex-wrap gap-2">
                <span v-for="v in vendorProfiles" :key="v.id" class="badge p-2 font-monospace" :class="v.id === (adapter ? adapter.id : 'huawei') ? 'bg-success' : 'bg-secondary text-secondary'">
                    <font-awesome-icon :icon="v.id === (adapter ? adapter.id : 'huawei') ? 'check-circle' : 'circle'" class="me-1" />
                    {{ v.name }}
                </span>
            </div>
        </div>

        <!-- Metric Telemetry Cards (PON Status, ONUs, LOS, CPU, RAM, Temp) -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-success">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">PON Status</span>
                    <div class="fs-4 fw-bold text-success font-monospace">ONLINE</div>
                    <span class="small text-secondary">{{ olt ? olt.total_pon_ports : 16 }} Active Ports</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-info">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Online ONUs</span>
                    <div class="fs-3 fw-bold text-info font-monospace">{{ olt ? olt.online_onu_count : 148 }}</div>
                    <span class="small text-secondary">Active Telemetry</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-secondary">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Offline ONUs</span>
                    <div class="fs-3 fw-bold font-monospace">{{ olt ? olt.offline_onu_count : 4 }}</div>
                    <span class="small text-secondary">Standby / Unpowered</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-danger">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">LOS Alarms</span>
                    <div class="fs-3 fw-bold text-danger font-monospace">{{ olt ? olt.los_count : 1 }}</div>
                    <span class="small text-secondary">Loss of Signal</span>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-warning">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Board CPU</span>
                    <div class="fs-3 fw-bold font-monospace">{{ boardCpu }}%</div>
                    <div class="progress mt-1" style="height: 4px; background-color: var(--secondary);">
                        <div class="progress-bar bg-warning" role="progressbar" :style="{ width: boardCpu + '%' }"></div>
                    </div>
                </div>
            </div>

            <div class="col-12 col-sm-6 col-xl-2">
                <div class="noc-metric-card p-3 shadow-sm border-start border-4 border-danger">
                    <span class="text-uppercase text-secondary small fw-bold d-block mb-1">Board Temp</span>
                    <div class="fs-3 fw-bold font-monospace">{{ boardTemp }} °C</div>
                    <span class="small text-secondary">Operating Threshold</span>
                </div>
            </div>
        </div>

        <!-- ONU Optical Telemetry Table & Active Alarms -->
        <div class="row g-4">
            <div class="col-12 col-lg-8">
                <div class="noc-section-box p-3 shadow-sm">
                    <h5 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="network-wired" />
                        <span>ONU Optical Telemetry & Optical Power (dBm)</span>
                    </h5>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr class="text-secondary text-uppercase small" style="font-size: 0.75rem;">
                                    <th>PON Port</th>
                                    <th>Index</th>
                                    <th>ONU Serial Number</th>
                                    <th>Status</th>
                                    <th>RX Power (dBm)</th>
                                    <th>TX Power (dBm)</th>
                                    <th class="text-end">Optical Health</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="onu in onusList" :key="onu.serial_number || onu.serialNumber">
                                    <td class="fw-bold font-monospace">{{ onu.pon_port || onu.ponPort }}</td>
                                    <td class="font-monospace text-secondary">#{{ onu.onu_index || onu.onuIndex }}</td>
                                    <td class="fw-bold text-info font-monospace">{{ onu.serial_number || onu.serialNumber }}</td>
                                    <td>
                                        <span class="badge" :class="(onu.online_status || onu.onlineStatus) === 'ONLINE' ? 'noc-badge-success' : 'noc-badge-danger'">
                                            {{ onu.online_status || onu.onlineStatus }}
                                        </span>
                                    </td>
                                    <td class="font-monospace fw-bold" :class="getRxClass(onu.rx_power_dbm || onu.rxPowerDbm)">
                                        {{ (onu.rx_power_dbm || onu.rxPowerDbm).toFixed(2) }} dBm
                                    </td>
                                    <td class="font-monospace">
                                        {{ (onu.tx_power_dbm || onu.txPowerDbm).toFixed(2) }} dBm
                                    </td>
                                    <td class="text-end">
                                        <span class="badge" :class="getHealthClass(onu.rx_power_dbm || onu.rxPowerDbm)">
                                            {{ getHealthLabel(onu.rx_power_dbm || onu.rxPowerDbm) }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Active Device Alerts & Alarm Mapping Rules -->
            <div class="col-12 col-lg-4">
                <div class="noc-section-box p-3 shadow-sm mb-4">
                    <h6 class="fw-bold text-warning mb-3 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="exclamation-triangle" />
                        <span>Active OLT & ONU Alarms</span>
                    </h6>

                    <div v-if="activeAlerts.length > 0" class="d-flex flex-column gap-2">
                        <div v-for="alt in activeAlerts" :key="alt.id" class="p-2 rounded bg-dark border border-danger small">
                            <div class="d-flex justify-content-between fw-bold text-danger">
                                <span>{{ alt.rule_name }}</span>
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

                <div class="noc-section-box p-3 shadow-sm">
                    <h6 class="fw-bold text-info mb-2 d-flex align-items-center gap-2">
                        <font-awesome-icon icon="shield-alt" />
                        <span>Vendor Alarm Code Mappings</span>
                    </h6>
                    <p class="small text-secondary mb-3">Maps vendor MIB traps and alarm codes into standardized InfiniNOC alert severities.</p>
                    <div class="small text-secondary">
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span>Code 0 (Normal)</span>
                            <span class="badge bg-success">OK</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-secondary">
                            <span>Code 1 (Dying Gasp)</span>
                            <span class="badge bg-warning text-dark">WARNING</span>
                        </div>
                        <div class="d-flex justify-content-between py-1">
                            <span>Code 2 (LOS Alarm)</span>
                            <span class="badge bg-danger">CRITICAL</span>
                        </div>
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
            vendorProfiles: [
                { id: "huawei", name: "Huawei SmartAX" },
                { id: "zte", name: "ZTE ZXA10" },
                { id: "dasan", name: "DASAN Zhone" },
                { id: "syrotech", name: "Syrotech GPON" },
                { id: "optilink", name: "Optilink GPON" },
                { id: "vsol", name: "VSOL GPON" },
                { id: "cdata", name: "C-DATA GPON" },
            ],
            onusList: [
                { ponPort: "0/1/1", onuIndex: 1, serialNumber: "HWTC482A9101", onlineStatus: "ONLINE", rxPowerDbm: -19.45, txPowerDbm: 2.30 },
                { ponPort: "0/1/1", onuIndex: 2, serialNumber: "HWTC482A9102", onlineStatus: "ONLINE", rxPowerDbm: -21.80, txPowerDbm: 2.45 },
                { ponPort: "0/1/2", onuIndex: 1, serialNumber: "HWTC482A9103", onlineStatus: "LOS", rxPowerDbm: -31.20, txPowerDbm: 0.00 },
            ],
            activeAlerts: [],
            metrics: null,
        };
    },
    computed: {
        boardCpu() {
            return this.metrics ? Math.round(this.metrics.cpu || 14) : 14;
        },
        boardTemp() {
            return this.metrics ? Math.round(this.metrics.temperature || 41) : 41;
        },
    },
    mounted() {
        this.deviceId = this.$route.params.id;
        this.loadOltData();
    },
    methods: {
        loadOltData() {
            if (!this.deviceId) {
                return;
            }
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
                }
            });
        },
        getRxClass(rx) {
            if (rx < -28) {
                return "text-danger";
            }
            if (rx < -25) {
                return "text-warning";
            }
            return "text-success";
        },
        getHealthClass(rx) {
            if (rx < -28) {
                return "bg-danger";
            }
            if (rx < -25) {
                return "bg-warning text-dark";
            }
            return "bg-success";
        },
        getHealthLabel(rx) {
            if (rx < -28) {
                return "LOS / Critical";
            }
            if (rx < -25) {
                return "Low Optical Margin";
            }
            return "Optimal Signal";
        },
    },
};
</script>

<style scoped>
.olt-dashboard {
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
}

.noc-metric-card {
    background-color: var(--card);
    color: var(--card-foreground);
    border-radius: 10px;
    border: 1px solid var(--border);
}

.noc-section-box {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
}
</style>
