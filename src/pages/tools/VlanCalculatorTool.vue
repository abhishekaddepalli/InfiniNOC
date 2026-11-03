<template>
    <div class="vlan-calculator-tool">
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 fw-bold text-foreground d-flex align-items-center justify-content-between">
                <span class="d-flex align-items-center gap-2">
                    <font-awesome-icon icon="tags" class="text-primary" />
                    <span>802.1Q VLAN ID & Range Validator</span>
                </span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">IEEE 802.1Q Standard</span>
            </div>
            <div class="card-body p-4">
                <div class="row align-items-end g-3">
                    <div class="col-12 col-md-9">
                        <label class="form-label small fw-semibold text-muted text-uppercase">VLAN ID (0 - 4095)</label>
                        <input
                            v-model.number="vlanId"
                            type="number"
                            min="0"
                            max="4095"
                            class="form-control form-control-lg border-secondary bg-card text-foreground font-monospace"
                            placeholder="e.g. 100, 500, or 4090"
                            @input="calculateVlan"
                        />
                    </div>
                    <div class="col-12 col-md-3">
                        <button class="btn btn-warning btn-lg w-100 fw-bold py-2 shadow-sm" @click="calculateVlan">
                            Validate VLAN
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="result" class="vlan-results-dashboard">
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">VLAN ID</div>
                        <div class="fs-2 fw-bold font-monospace text-primary">VID {{ result.vlanId }}</div>
                        <div class="small text-muted font-monospace mt-1">{{ result.hex }}</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-card border-secondary shadow-sm p-4 text-center">
                        <div class="text-muted small text-uppercase fw-semibold mb-1">Range Category</div>
                        <div class="fs-4 fw-bold font-monospace mt-1" :class="result.isReserved ? 'text-danger' : 'text-success'">
                            {{ result.rangeType }}
                        </div>
                        <div class="small text-muted font-monospace mt-1">{{ result.isConfigurable ? 'Configurable' : 'System Reserved' }}</div>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="card bg-card border-secondary shadow-sm p-4 d-flex flex-column justify-content-center">
                        <div class="fw-bold text-foreground mb-1">Standard Classification</div>
                        <div class="small text-muted mb-2">{{ result.description }}</div>
                        <div class="small font-monospace text-muted">12-Bit Binary: <strong class="text-foreground">{{ result.binary }}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: { tool: { type: Object, default: null } },
    emits: ["history-updated"],
    data() {
        return {
            vlanId: 100,
            result: null,
        };
    },
    mounted() {
        this.calculateVlan();
    },
    methods: {
        calculateVlan() {
            this.$root.getSocket().emit("executeTool", {
                slug: "vlan-calculator",
                params: { vlanId: this.vlanId },
            }, (res) => {
                if (res && res.ok && res.result) {
                    this.result = res.result;
                    this.$emit("history-updated", res.history);
                }
            });
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
