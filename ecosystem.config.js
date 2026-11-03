module.exports = {
    apps: [
        {
            name: "infininoc",
            script: "./server/server.js",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            restart_delay: 5000,
            max_restarts: 10,
            kill_timeout: 10000,
            listen_timeout: 15000,
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
