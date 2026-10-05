#!/usr/bin/env bash
# ==============================================================================
# InfiniNOC - Hardened Production VPS Installer & Updater
# Engineered & Maintained by Infiniforge Technologies
# "Know Your Network. Before Your Customers Do."
# Domain: https://monitor.infiniforge.cloud
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

REPO_URL="https://github.com/abhishekaddepalli/InfiniNOC.git"
TARGET_NODE_VERSION="22"
PORT="${INFININOC_PORT:-3001}"

# Determine Installation Directory safely
if [ -n "$1" ]; then
    INSTALL_DIR="$1"
elif [ -n "$INFININOC_PATH" ]; then
    INSTALL_DIR="$INFININOC_PATH"
elif [ -d "/www/apps/infininoc/.git" ]; then
    INSTALL_DIR="/www/apps/infininoc"
elif [ -d "/opt/infininoc/.git" ]; then
    INSTALL_DIR="/opt/infininoc"
else
    INSTALL_DIR="/opt/infininoc"
fi

echo -e "${CYAN}"
echo "=============================================================================="
echo "           InfiniNOC - Production Platform Installer & Updater                "
echo "                   Engineered by Infiniforge Technologies                     "
echo "                     https://monitor.infiniforge.cloud                        "
echo "=============================================================================="
echo -e "${NC}"
echo -e "Target Directory: ${YELLOW}${INSTALL_DIR}${NC}"
echo -e "Application Port: ${YELLOW}${PORT}${NC}"
echo ""

# Check root / sudo privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run this installation script as root or with sudo.${NC}"
  echo "Usage: curl -fsSL https://raw.githubusercontent.com/abhishekaddepalli/InfiniNOC/main/install.sh | sudo bash"
  exit 1
fi

# Detect Package Manager
echo -e "${BLUE}[1/6] Detecting operating system and package manager...${NC}"
if [ -f /etc/debian_version ]; then
    OS_TYPE="debian"
    PKG_MANAGER="apt-get"
elif [ -f /etc/redhat-release ]; then
    OS_TYPE="redhat"
    PKG_MANAGER="yum"
else
    OS_TYPE="generic"
    PKG_MANAGER="apt-get"
fi
echo -e "OS Environment: ${GREEN}${OS_TYPE}${NC}"

# Install essential build packages without upgrading unrelated OS packages
echo -e "${BLUE}[2/6] Verifying essential system dependencies...${NC}"
if [ "$OS_TYPE" == "debian" ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y -q
    apt-get install -y -q curl git build-essential ca-certificates gnupg
elif [ "$OS_TYPE" == "redhat" ]; then
    yum install -y curl git make gcc gcc-c++ ca-certificates
fi

# Check or Install Node.js & npm (Node 20/22 aware, never downgrades existing Node 22+)
echo -e "${BLUE}[3/6] Inspecting Node.js runtime environment...${NC}"
NODE_NEEDS_INSTALL=false

if command -v node &> /dev/null; then
    CURRENT_NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [ "$CURRENT_NODE_VER" -lt 20 ]; then
        echo -e "${YELLOW}Existing Node.js v${CURRENT_NODE_VER} is below minimum requirement (>= 20). Upgrade required.${NC}"
        NODE_NEEDS_INSTALL=true
    else
        echo -e "${GREEN}Found compatible Node.js version $(node -v) (Satisfies >= v20 requirement). Keeping existing runtime.${NC}"
    fi
else
    echo -e "${YELLOW}Node.js not detected on system.${NC}"
    NODE_NEEDS_INSTALL=true
fi

if [ "$NODE_NEEDS_INSTALL" = true ]; then
    echo -e "${YELLOW}Installing Node.js v${TARGET_NODE_VERSION} LTS...${NC}"
    if [ "$OS_TYPE" == "debian" ]; then
        curl -fsSL "https://deb.nodesource.com/setup_${TARGET_NODE_VERSION}.x" | bash -
        apt-get install -y -q nodejs
    elif [ "$OS_TYPE" == "redhat" ]; then
        curl -fsSL "https://rpm.nodesource.com/setup_${TARGET_NODE_VERSION}.x" | bash -
        yum install -y nodejs
    fi
fi

echo -e "Node.js Runtime: ${GREEN}$(node -v)${NC}"
echo -e "npm Package Mgr: ${GREEN}v$(npm -v)${NC}"

# Install PM2 globally if missing (does not touch existing PM2)
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2 Process Manager globally...${NC}"
    npm install -g pm2
else
    echo -e "PM2 Process Mgr: ${GREEN}$(pm2 -v)${NC}"
fi

# Clone or Update Repository non-destructively
echo -e "${BLUE}[4/6] Synchronizing InfiniNOC application codebase...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    if [ -d "$INSTALL_DIR/.git" ]; then
        echo -e "${YELLOW}Existing Git installation detected at ${INSTALL_DIR}. Syncing latest release...${NC}"
        cd "$INSTALL_DIR"
        git fetch origin main
        git checkout chore/infininoc-hardening 2>/dev/null || git checkout main
        git pull --ff-only origin main 2>/dev/null || git merge origin/main --no-edit || true
    else
        echo -e "${RED}Safety Warning: Directory ${INSTALL_DIR} exists but is not a Git repository.${NC}"
        echo -e "${RED}To prevent data loss, existing files will NOT be deleted.${NC}"
        echo -e "Please backup your directory or specify a target path: sudo ./install.sh /path/to/install"
        exit 1
    fi
else
    echo -e "Cloning InfiniNOC repository to ${INSTALL_DIR}..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies and build production bundle
echo -e "${BLUE}[5/6] Installing dependencies and compiling production Vite assets...${NC}"
npm install --omit=dev --no-audit
npm run build

# Configure PM2 Daemon safely without affecting unrelated processes
echo -e "${BLUE}[6/6] Managing InfiniNOC PM2 background service...${NC}"

if pm2 describe infininoc &>/dev/null; then
    echo -e "${GREEN}Reloading existing 'infininoc' PM2 service...${NC}"
    pm2 reload infininoc --update-env || pm2 restart infininoc --update-env
else
    echo -e "${GREEN}Registering and starting new 'infininoc' PM2 service...${NC}"
    pm2 start server/server.js --name "infininoc"
fi
pm2 save

# Detect IP for access notice
SERVER_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")

echo -e "${GREEN}"
echo "=============================================================================="
echo "          🎉 InfiniNOC Operation Completed Successfully! 🎉                   "
echo "=============================================================================="
echo -e "${NC}"
echo -e "InfiniNOC is active and running in the background."
echo ""
echo -e "🌐 Access Dashboard:     ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo -e "🌐 Production Domain:    ${CYAN}https://monitor.infiniforge.cloud${NC}"
echo ""
echo -e "📌 Service Management Commands:"
echo -e "   - View Logs:    ${YELLOW}pm2 logs infininoc${NC}"
echo -e "   - Restart App:  ${YELLOW}pm2 restart infininoc${NC}"
echo -e "   - Check Status: ${YELLOW}pm2 status infininoc${NC}"
echo ""
echo -e "${PURPLE}Engineered by Infiniforge Technologies - Know Your Network. Before Your Customers Do.${NC}"
echo "=============================================================================="
