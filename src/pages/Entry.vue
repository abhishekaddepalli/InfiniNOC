<template>
    <div>
        <StatusPage v-if="statusPageSlug" :override-slug="statusPageSlug" />
        <NocMarketingLandingPage v-else />
    </div>
</template>

<script>
import axios from "axios";
import StatusPage from "./StatusPage.vue";
import NocMarketingLandingPage from "./NocMarketingLandingPage.vue";

export default {
    components: {
        StatusPage,
        NocMarketingLandingPage,
    },
    data() {
        return {
            statusPageSlug: null,
        };
    },
    async mounted() {
        let res;
        try {
            res = (await axios.get("/api/entry-page")).data;

            if (res.type === "statusPageMatchedDomain") {
                this.statusPageSlug = res.statusPageSlug;
                this.$root.forceStatusPageTheme = true;
            } else if (res.type === "setup-database") {
                this.$router.push("/setup-database");
            }
        } catch (e) {
            // Standalone Landing Page fallback
        }
    },
};
</script>
