#!/bin/bash

# FilaMama Installation Script
# Sets up FilaMama as a systemd service that always runs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the absolute path of the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    FilaMama Installation Script     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}Error: Please run this script as your regular user, not as root.${NC}"
   echo "The script will use sudo when needed."
   exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists python3; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}Error: node is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites found${NC}"
echo ""

# Step 1: Set up backend
echo -e "${YELLOW}Step 1: Setting up backend...${NC}"

# Create Python virtual environment if it doesn't exist
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv backend/venv
else
    echo "Python virtual environment already exists"
fi

# Activate venv and install dependencies
echo "Installing backend dependencies..."
source backend/venv/bin/activate
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt
deactivate

echo -e "${GREEN}✓ Backend setup complete${NC}"
echo ""

# Step 2: Set up frontend
echo -e "${YELLOW}Step 2: Setting up frontend...${NC}"

cd frontend

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Frontend dependencies already installed"
fi

# Build for production
echo "Building frontend for production..."
npm run build

cd ..

echo -e "${GREEN}✓ Frontend setup complete${NC}"
echo ""

# Step 3: Create data directories
echo -e "${YELLOW}Step 3: Creating data directories...${NC}"

mkdir -p data/files
mkdir -p data/thumbnails

echo -e "${GREEN}✓ Data directories created${NC}"
echo ""

# Step 4: Install systemd services
echo -e "${YELLOW}Step 4: Installing systemd services...${NC}"

# Get current user and group
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Update service files with current user and actual paths
echo "Configuring service files..."

# Create temporary service files with correct paths
cat > /tmp/filamama-backend.service <<EOF
[Unit]
Description=FilaMama Backend - FastAPI File Manager Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_GROUP
WorkingDirectory=$PROJECT_DIR/backend
Environment="PATH=$PROJECT_DIR/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=$PROJECT_DIR/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 1031
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Detect Node path
NODE_PATH=$(which node)
NODE_DIR=$(dirname "$NODE_PATH")
NPM_PATH=$(which npm)

cat > /tmp/filamama-frontend.service <<EOF
[Unit]
Description=FilaMama Frontend - React File Manager UI
After=network.target filamama-backend.service
Requires=filamama-backend.service

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_GROUP
WorkingDirectory=$PROJECT_DIR/frontend
Environment="PATH=$NODE_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_ENV=production"
ExecStart=$NPM_PATH run preview -- --host 0.0.0.0 --port 1030
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Copy service files to systemd directory (requires sudo)
echo "Installing service files (requires sudo)..."
sudo cp /tmp/filamama-backend.service /etc/systemd/system/
sudo cp /tmp/filamama-frontend.service /etc/systemd/system/

# Clean up temporary files
rm /tmp/filamama-backend.service /tmp/filamama-frontend.service

# Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable services to start on boot
echo "Enabling services to start on boot..."
sudo systemctl enable filamama-backend.service
sudo systemctl enable filamama-frontend.service

echo -e "${GREEN}✓ Systemd services installed${NC}"
echo ""

# Step 5: Start services
echo -e "${YELLOW}Step 5: Starting services...${NC}"

# Stop services if already running
sudo systemctl stop filamama-frontend.service 2>/dev/null || true
sudo systemctl stop filamama-backend.service 2>/dev/null || true

# Start services
echo "Starting backend service..."
sudo systemctl start filamama-backend.service

# Wait for backend to be ready
sleep 3

echo "Starting frontend service..."
sudo systemctl start filamama-frontend.service

# Wait for frontend to be ready
sleep 2

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Step 6: Verify installation
echo -e "${YELLOW}Step 6: Verifying installation...${NC}"

# Check backend service status
if sudo systemctl is-active --quiet filamama-backend.service; then
    echo -e "${GREEN}✓ Backend service is running${NC}"
else
    echo -e "${RED}✗ Backend service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u filamama-backend.service -n 50"
fi

# Check frontend service status
if sudo systemctl is-active --quiet filamama-frontend.service; then
    echo -e "${GREEN}✓ Frontend service is running${NC}"
else
    echo -e "${RED}✗ Frontend service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u filamama-frontend.service -n 50"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete! 🎉       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}FilaMama is now installed and running as a system service.${NC}"
echo ""
echo "Access URLs (Production):"
echo "  Frontend: http://spark.local:1030"
echo "  Backend:  http://spark.local:1031"
echo "  API Docs: http://spark.local:1031/docs"
echo ""
echo "Development server ports (when using ./start.sh):"
echo "  Frontend: http://spark.local:8010"
echo "  Backend:  http://spark.local:8011"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status filamama-backend   # Check backend status"
echo "  sudo systemctl status filamama-frontend  # Check frontend status"
echo "  sudo systemctl stop filamama-backend     # Stop backend"
echo "  sudo systemctl stop filamama-frontend    # Stop frontend"
echo "  sudo systemctl start filamama-backend    # Start backend"
echo "  sudo systemctl start filamama-frontend   # Start frontend"
echo "  sudo systemctl restart filamama-backend  # Restart backend"
echo "  sudo systemctl restart filamama-frontend # Restart frontend"
echo "  sudo journalctl -u filamama-backend -f   # View backend logs"
echo "  sudo journalctl -u filamama-frontend -f  # View frontend logs"
echo ""
echo "The services will automatically start on system boot."
echo ""
