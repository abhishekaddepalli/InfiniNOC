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
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    border: 1px solid #10B981;
    color: #FFFFFF;
    font-weight: 600;
    height: 40px;
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    transition: all 0.2s ease-in-out;

    &:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
        color: #FFFFFF;
    }
}

.noc-add-btn:hover {
    background-color: #e68a2e;
    border-color: #d37a22;
    color: #0f172a;
    box-shadow: 0 0 15px rgba(255, 153, 51, 0.35);
}
</style>
