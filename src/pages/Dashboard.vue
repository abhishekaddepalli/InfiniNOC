<template>
    <div class="container-fluid px-2 px-md-3">
        <div class="row g-3">
            <div v-if="!$root.isMobile" class="col-12 col-lg-4 col-xl-3">
                <div class="mb-3">
                    <router-link to="/add" class="btn w-100 py-2 fw-bold noc-add-btn d-flex align-items-center justify-content-center gap-2 shadow-sm">
                        <font-awesome-icon icon="plus-circle" />
                        <span>{{ $t("Add New Monitor") }}</span>
                    </router-link>
                </div>
                <NocSidebar class="mb-3" />
                <MonitorList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 col-lg-8 col-xl-9 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>
    </div>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";
import NocSidebar from "../components/NocSidebar.vue";

export default {
    components: {
        MonitorList,
        NocSidebar,
    },
    data() {
        return {
            height: 0,
        };
    },
    mounted() {
        this.$nextTick(() => {
            if (this.$refs.container) {
                this.height = this.$refs.container.offsetHeight;
            }
        });
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 100%;
}

.noc-add-btn {
    background-color: #ff9933;
    border: 1px solid #e68a2e;
    color: #0f172a;
    font-weight: 700;
    letter-spacing: 0.03em;
    border-radius: 8px;
    transition: all 0.2s ease-in-out;
}

.noc-add-btn:hover {
    background-color: #e68a2e;
    border-color: #d37a22;
    color: #0f172a;
    box-shadow: 0 0 15px rgba(255, 153, 51, 0.35);
}
</style>
