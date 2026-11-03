import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
import path from "path";

const postCssScss = require("postcss-scss");
const postcssRTLCSS = require("postcss-rtlcss");

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vitejs.dev/config/
export default defineConfig({
    root: path.resolve(__dirname, ".."),
    server: {
        port: 3000,
    },
    define: {
        FRONTEND_VERSION: JSON.stringify(process.env.npm_package_version),
        "process.env": {},
    },
    plugins: [
        vue(),
        visualizer({
            filename: "tmp/dist-stats.html",
        }),
        viteCompression({
            algorithm: "gzip",
            filter: viteCompressionFilter,
            deleteOriginFile: false,
        }),
        viteCompression({
            algorithm: "brotliCompress",
            filter: viteCompressionFilter,
            deleteOriginFile: false,
        }),
    ],
    css: {
        postcss: {
            parser: postCssScss,
            map: false,
            plugins: [postcssRTLCSS],
        },
    },
    build: {
        outDir: path.resolve(__dirname, "../dist"),
        emptyOutDir: true,
        commonjsOptions: {
            include: [/.js$/],
        },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules")) {
                        if (id.includes("chart.js") || id.includes("vue-chartjs") || id.includes("chartjs-adapter-dayjs-4")) {
                            return "vendor-chart";
                        }
                        if (id.includes("@fortawesome")) {
                            return "vendor-fontawesome";
                        }
                        if (id.includes("bootstrap") || id.includes("@popperjs")) {
                            return "vendor-bootstrap";
                        }
                        if (id.includes("vue-i18n")) {
                            return "vendor-i18n";
                        }
                    }
                },
            },
        },
    },
});
