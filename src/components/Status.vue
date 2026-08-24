<template>
    <span class="badge rounded-pill noc-status-badge" :class="'bg-' + color">{{ text }}</span>
</template>

<script>
export default {
    props: {
        /** Current status of monitor */
        status: {
            type: Number,
            default: 0,
        },
    },

    computed: {
        color() {
            if (this.status === 0) {
                return "danger";
            }

            if (this.status === 1) {
                return "healthy";
            }

            if (this.status === 2) {
                return "warning";
            }

            if (this.status === 3) {
                return "maintenance";
            }

            return "secondary";
        },

        text() {
            if (this.status === 0) {
                return this.$t("Down");
            }

            if (this.status === 1) {
                return this.$t("Up");
            }

            if (this.status === 2) {
                return this.$t("Pending");
            }

            if (this.status === 3) {
                return this.$t("statusMaintenance");
            }

            return this.$t("Unknown");
        },
    },
};
</script>

<style scoped>
.noc-status-badge {
    min-width: 68px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.4em 0.8em;
}

.bg-healthy {
    background-color: #2ecc71 !important;
    color: #ffffff !important;
}

.bg-danger {
    background-color: #dc2626 !important;
    color: #ffffff !important;
}

.bg-warning {
    background-color: #ff9933 !important;
    color: #0f172a !important;
}

.bg-maintenance {
    background-color: #3b82f6 !important;
    color: #ffffff !important;
}

.bg-secondary {
    background-color: #64748b !important;
    color: #ffffff !important;
}
</style>
