export default {
    data() {
        return {
            system: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
            userTheme: localStorage.theme || "auto",
            userHeartbeatBar: localStorage.heartbeatBarTheme || "normal",
            styleElapsedTime: localStorage.styleElapsedTime || "no-line",
            statusPageTheme: "light",
            forceStatusPageTheme: false,
            path: "",
            mediaQueryListener: null,
        };
    },

    created() {
        // Setup dynamic prefers-color-scheme listener
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        this.system = mediaQuery.matches ? "dark" : "light";
        this.mediaQueryListener = (e) => {
            this.system = e.matches ? "dark" : "light";
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener("change", this.mediaQueryListener);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(this.mediaQueryListener);
        }
    },

    mounted() {
        // Default Auto
        if (!this.userTheme) {
            this.userTheme = "auto";
        }

        // Default Heartbeat Bar
        if (!this.userHeartbeatBar) {
            this.userHeartbeatBar = "normal";
        }

        // Default Elapsed Time Style
        if (!this.styleElapsedTime) {
            this.styleElapsedTime = "no-line";
        }

        this.applyThemeClass(this.theme);
        this.updateThemeColorMeta();
    },

    beforeUnmount() {
        if (this.mediaQueryListener) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener("change", this.mediaQueryListener);
            } else if (mediaQuery.removeListener) {
                mediaQuery.removeListener(this.mediaQueryListener);
            }
        }
    },

    computed: {
        theme() {
            if (this.forceStatusPageTheme) {
                if (this.statusPageTheme === "auto") {
                    return this.system;
                }
                return this.statusPageTheme;
            }

            if (this.path.startsWith("/status-page") || this.path.startsWith("/status")) {
                if (this.statusPageTheme === "auto") {
                    return this.system;
                }
                return this.statusPageTheme;
            } else {
                if (this.userTheme === "auto" || !this.userTheme) {
                    return this.system;
                }
                return this.userTheme;
            }
        },

        isDark() {
            return this.theme === "dark";
        },
    },

    watch: {
        "$route.fullPath"(path) {
            this.path = path;
        },

        userTheme(to) {
            localStorage.theme = to;
            this.applyThemeClass(this.theme);
        },

        styleElapsedTime(to) {
            localStorage.styleElapsedTime = to;
        },

        theme(to, from) {
            this.applyThemeClass(to, from);
            this.updateThemeColorMeta();
        },

        userHeartbeatBar(to) {
            localStorage.heartbeatBarTheme = to;
        },
    },

    methods: {
        /**
         * Apply theme classes to body and data-theme attribute
         * @param {string} newTheme New theme
         * @param {string} oldTheme Old theme
         * @returns {void}
         */
        applyThemeClass(newTheme, oldTheme) {
            if (oldTheme) {
                document.body.classList.remove(oldTheme);
            }
            document.body.classList.remove("dark", "light");
            document.body.classList.add(newTheme);
            document.documentElement.setAttribute("data-theme", newTheme);
        },

        /**
         * Update the theme color meta tag
         * @returns {void}
         */
        updateThemeColorMeta() {
            const metaTag = document.querySelector("#theme-color");
            if (metaTag) {
                if (this.theme === "dark") {
                    metaTag.setAttribute("content", "#0b1220");
                } else {
                    metaTag.setAttribute("content", "#1e3a8a");
                }
            }
        },
    },
};
