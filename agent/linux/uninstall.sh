#!/usr/bin/env bash
set -e
echo "Uninstalling InfiniNOC Probe Daemon..."
systemctl stop infininoc-probe.service || true
systemctl disable infininoc-probe.service || true
rm -f /etc/systemd/system/infininoc-probe.service
systemctl daemon-reload
rm -rf /opt/infininoc-probe
echo "InfiniNOC Probe Daemon uninstalled successfully."
