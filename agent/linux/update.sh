#!/usr/bin/env bash
set -e
CONFIG_FILE="/opt/infininoc-probe/infininoc-probe-config.json"
SERVER=$(grep -o '"server": "[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)

echo "Updating InfiniNOC Probe Daemon from $SERVER..."
curl -fsSL "$SERVER/api/probe/download/agent.js" -o "/opt/infininoc-probe/infininoc-probe-agent.js.new"
mv "/opt/infininoc-probe/infininoc-probe-agent.js.new" "/opt/infininoc-probe/infininoc-probe-agent.js"
chmod +x "/opt/infininoc-probe/infininoc-probe-agent.js"
systemctl restart infininoc-probe.service
echo "Probe Daemon updated and restarted successfully."
