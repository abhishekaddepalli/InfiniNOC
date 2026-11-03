#!/usr/bin/env bash
# ==============================================================================
# InfiniNOC Remote Distributed Probe Linux Automated Installer & Systemd Setup
# ==============================================================================
set -e

SERVER="http://127.0.0.1:3001"
PROBE_ID=""
TOKEN=""
INSTALL_DIR="/opt/infininoc-probe"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --server=*) SERVER="${1#*=}" ;;
        --server) SERVER="$2"; shift ;;
        --probe-id=*) PROBE_ID="${1#*=}" ;;
        --probe-id) PROBE_ID="$2"; shift ;;
        --token=*) TOKEN="${1#*=}" ;;
        --token) TOKEN="$2"; shift ;;
        --dir=*) INSTALL_DIR="${1#*=}" ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo "============================================================"
echo "  InfiniNOC Remote Distributed Probe Linux Installer"
echo "============================================================"

# Step 1: Verify Node.js Environment
if ! command -v node &> /dev/null; then
    echo "[1/5] Node.js not found. Installing Node.js LTS via official NodeSource repository..."
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    else
        echo "[ERROR] Unsupported package manager. Please install Node.js >= 18 manually."
        exit 1
    fi
fi

NODE_VER=$(node -v)
echo "  Detected Node.js runtime: $NODE_VER"

# Step 2: Create Installation Directory
echo "[2/5] Creating directory $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC="$(dirname "$SCRIPT_DIR")/infininoc-probe-agent.js"

if [ -f "$AGENT_SRC" ]; then
    cp "$AGENT_SRC" "$INSTALL_DIR/infininoc-probe-agent.js"
else
    echo "  Downloading latest probe daemon from $SERVER/api/probe/download/agent.js..."
    curl -fsSL "$SERVER/api/probe/download/agent.js" -o "$INSTALL_DIR/infininoc-probe-agent.js"
fi
chmod +x "$INSTALL_DIR/infininoc-probe-agent.js"

# Step 3: Register / Generate Config
echo "[3/5] Configuring probe credentials..."
CONFIG_FILE="$INSTALL_DIR/infininoc-probe-config.json"

if [ -n "$PROBE_ID" ] && [ -n "$TOKEN" ]; then
    echo "  Enrolling Probe #$PROBE_ID against $SERVER..."
    REG_PAYLOAD="{\"probeId\":$PROBE_ID,\"registrationToken\":\"$TOKEN\",\"version\":\"1.26.31\",\"os_info\":\"Linux $(uname -r) ($(uname -m))\"}"
    REG_RESP=$(curl -s -X POST "$SERVER/api/probe/register" \
        -H "Content-Type: application/json" \
        -d "$REG_PAYLOAD" || true)

    API_KEY=$(echo "$REG_RESP" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4 || true)

    if [ -n "$API_KEY" ]; then
        echo "  [SUCCESS] Acquired persistent API key."
        cat <<EOF > "$CONFIG_FILE"
{
  "server": "$SERVER",
  "probeId": $PROBE_ID,
  "apiKey": "$API_KEY",
  "heartbeatInterval": 20,
  "taskInterval": 25
}
EOF
    else
        echo "  [WARN] Direct enrollment failed. Saving bootstrap token."
        cat <<EOF > "$CONFIG_FILE"
{
  "server": "$SERVER",
  "probeId": $PROBE_ID,
  "token": "$TOKEN",
  "heartbeatInterval": 20,
  "taskInterval": 25
}
EOF
    fi
else
    echo "  [Notice] No credentials passed. Using existing config if present."
fi
chmod 600 "$CONFIG_FILE" || true

# Step 4: Systemd Service Installation
echo "[4/5] Registering systemd background daemon..."
NODE_BIN=$(command -v node)

cat <<EOF > /etc/systemd/system/infininoc-probe.service
[Unit]
Description=InfiniNOC Remote Distributed Probe Daemon
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/infininoc-probe-agent.js --config=$CONFIG_FILE
Restart=always
RestartSec=10
StandardOutput=append:/var/log/infininoc-probe.log
StandardError=append:/var/log/infininoc-probe.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable infininoc-probe.service
systemctl restart infininoc-probe.service

# Step 5: Verify Active State
echo "[5/5] Verifying probe daemon status..."
sleep 2

if systemctl is-active --quiet infininoc-probe.service; then
    echo "============================================================"
    echo "  SUCCESS: InfiniNOC Probe Agent is active and running!"
    echo "  Service Name : infininoc-probe.service"
    echo "  Config File  : $CONFIG_FILE"
    echo "  Logs         : journalctl -u infininoc-probe.service -f"
    echo "============================================================"
else
    echo "[WARN] Service failed to start. Inspecting journalctl logs:"
    journalctl -u infininoc-probe.service -n 15 --no-pager
    exit 1
fi
