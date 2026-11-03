#!/usr/bin/env bash
CONFIG_FILE="/opt/infininoc-probe/infininoc-probe-config.json"
echo "============================================================"
echo "  InfiniNOC Probe Agent Live Health Diagnostics (Linux)"
echo "============================================================"

if systemctl is-active --quiet infininoc-probe.service; then
    echo "Service Status  : ACTIVE (Running)"
else
    echo "Service Status  : INACTIVE / FAILED"
fi

if [ -f "$CONFIG_FILE" ]; then
    SERVER=$(grep -o '"server": "[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)
    PROBE_ID=$(grep -o '"probeId": [0-9]*' "$CONFIG_FILE" | cut -d' ' -f2)
    echo "Server URL      : $SERVER"
    echo "Probe ID        : $PROBE_ID"
fi

echo "Recent Logs:"
journalctl -u infininoc-probe.service -n 5 --no-pager
echo "============================================================"
