// InfiniNOC Distribution Asset Guardian
const fs = require("fs");
const { execSync } = require("child_process");

if (fs.existsSync("./dist/index.html")) {
    console.log("InfiniNOC production distribution assets are already built and present in ./dist. Skipping download.");
    process.exit(0);
} else {
    console.log("Building InfiniNOC production distribution assets locally via Vite...");
    try {
        execSync("npm run build", { stdio: "inherit" });
        console.log("InfiniNOC build completed successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Local build failed:", e.message);
        process.exit(1);
    }
}
