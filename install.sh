#!/usr/bin/env bash
# ==============================================================================
# InfiniNOC - One-Command Automated VPS Installer
# Engineered & Maintained by Infiniforge Technologies
# "Know Your Network. Before Your Customers Do."
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

INSTALL_DIR="/opt/infininoc"
REPO_URL="https://github.com/abhishekaddepalli/InfiniNOC.git"
NODE_VERSION="20"
PORT=3001

echo -e "${CYAN}"
echo "=============================================================================="
echo "               InfiniNOC - One-Command VPS Automated Installer               "
echo "                      Powered by Infiniforge Technologies                     "
echo "=============================================================================="
echo -e "${NC}"

# Check root privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run this installation script as root or with sudo.${NC}"
  echo "Usage: curl -fsSL https://raw.githubusercontent.com/abhishekaddepalli/InfiniNOC/main/install.sh | sudo bash"
  exit 1
fi

# Detect Package Manager
echo -e "${BLUE}[1/6] Checking system package manager and OS...${NC}"
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

# Update system & install essential tools
echo -e "${BLUE}[2/6] Installing essential dependencies (curl, git, build tools)...${NC}"
if [ "$OS_TYPE" == "debian" ]; then
    apt-get update -y
    apt-get install -y curl git build-essential python3 sqlite3 ca-certificates gnupg
elif [ "$OS_TYPE" == "redhat" ]; then
    yum update -y
    yum install -y curl git make gcc gcc-c++ python3 sqlite ca-certificates
fi

# Check or Install Node.js & npm
echo -e "${BLUE}[3/6] Verifying Node.js environment...${NC}"
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]; then
    echo -e "${YELLOW}Installing Node.js v${NODE_VERSION} LTS...${NC}"
    if [ "$OS_TYPE" == "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
    elif [ "$OS_TYPE" == "redhat" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
        yum install -y nodejs
    fi
fi

echo -e "${GREEN}Node.js Version: $(node -v)${NC}"
echo -e "${GREEN}npm Version: $(npm -v)${NC}"

# Install PM2 globally if missing
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2 Process Manager globally...${NC}"
    npm install -g pm2
fi

# Clone or Update Repository
echo -e "${BLUE}[4/6] Setting up InfiniNOC at ${INSTALL_DIR}...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}Directory ${INSTALL_DIR} exists. Syncing latest codebase...${NC}"
    cd "$INSTALL_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install Node dependencies & build frontend bundle
echo -e "${BLUE}[5/6] Installing NPM packages and building production assets...${NC}"
npm install --production=false
npm run build

# Configure PM2 Daemon
echo -e "${BLUE}[6/6] Launching InfiniNOC backend server under PM2...${NC}"
pm2 stop infininoc 2>/dev/null || true
pm2 delete infininoc 2>/dev/null || true
pm2 start server/server.js --name "infininoc"
pm2 save

# Detect Server Public IP
SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}' || echo "localhost")

echo -e "${GREEN}"
echo "=============================================================================="
echo "           🎉 InfiniNOC Installation Completed Successfully! 🎉               "
echo "=============================================================================="
echo -e "${NC}"
echo -e "InfiniNOC is now LIVE and running in the background on your VPS!"
echo ""
echo -e "🌐 Access Dashboard URL:    ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo ""
echo -e "📌 Important Setup Steps:"
echo -e "   1. Open ${CYAN}http://${SERVER_IP}:${PORT}${NC} in your web browser."
echo -e "   2. Create your initial admin account to start monitoring your infrastructure."
echo ""
echo -e "⚙️ Useful Commands:"
echo -e "   - Check Logs:   ${YELLOW}pm2 logs infininoc${NC}"
echo -e "   - Restart Server: ${YELLOW}pm2 restart infininoc${NC}"
echo -e "   - Check Status:   ${YELLOW}pm2 status${NC}"
echo ""
echo -e "${PURPLE}Engineered by Infiniforge Technologies - Know Your Network. Before Your Customers Do.${NC}"
echo "=============================================================================="
