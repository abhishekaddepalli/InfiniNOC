import { currentLocale } from "../i18n";
import { setPageLocale, timeDurationFormatter } from "../util-frontend";
const langModules = import.meta.glob(["../lang/*.json", "!../lang/en.json"]);

export default {
    data() {
        return {
            language: currentLocale(),
        };
    },

    async created() {
        if (this.language !== "en") {
            await this.changeLang(this.language);
        }
    },

    watch: {
        async language(lang) {
            await this.changeLang(lang);
        },
    },

    methods: {
        /**
         * Change the application language
         * @param {string} lang Language code to switch to
         * @returns {Promise<void>}
         */
        async changeLang(lang) {
            if (lang === "en") {
                this.$i18n.locale = "en";
                localStorage.locale = "en";
                setPageLocale();
                timeDurationFormatter.updateLocale("en");
                return;
            }
            const loader = langModules["../lang/" + lang + ".json"];
            if (loader) {
                let message = (await loader()).default;
                this.$i18n.setLocaleMessage(lang, message);
            }
            this.$i18n.locale = lang;
            localStorage.locale = lang;
            setPageLocale();
            timeDurationFormatter.updateLocale(lang);
        },
    },
};
