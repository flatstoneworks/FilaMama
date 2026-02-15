#!/bin/bash

# FilaMama — Smart Install Script
# Supports Linux (apt/dnf/pacman) and macOS (brew)
# Usage: ./install-filamama.sh [--install|--update|--uninstall|--configure|--status]

set -e

# ─── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Globals ───────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$PROJECT_DIR/templates"

# Defaults (overridden by config wizard or flags)
FILAMAMA_PORT="${FILAMAMA_PORT:-1031}"
FILAMAMA_ROOT_PATH="${FILAMAMA_ROOT_PATH:-$HOME}"
FILAMAMA_MAX_UPLOAD_MB="${FILAMAMA_MAX_UPLOAD_MB:-10240}"
SKIP_SERVICE=false
SKIP_WIZARD=false

# ─── Helpers ───────────────────────────────────────────────────────────

banner() {
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║          FilaMama Installer              ║${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

info()    { echo -e "${BLUE}[info]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
err()     { echo -e "${RED}[error]${NC} $*"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
    case "$(uname -s)" in
        Linux*)  OS="linux" ;;
        Darwin*) OS="macos" ;;
        *)       err "Unsupported OS: $(uname -s)"; exit 1 ;;
    esac
}

detect_pkg_manager() {
    if [ "$OS" = "macos" ]; then
        if command_exists brew; then
            PKG="brew"
        else
            err "Homebrew is required on macOS. Install from https://brew.sh"
            exit 1
        fi
    elif command_exists apt-get; then
        PKG="apt"
    elif command_exists dnf; then
        PKG="dnf"
    elif command_exists pacman; then
        PKG="pacman"
    else
        err "No supported package manager found (apt, dnf, pacman, brew)"
        exit 1
    fi
}

pkg_install() {
    local pkgs=("$@")
    case "$PKG" in
        apt)    sudo apt-get update -qq && sudo apt-get install -y -qq "${pkgs[@]}" ;;
        dnf)    sudo dnf install -y -q "${pkgs[@]}" ;;
        pacman) sudo pacman -S --noconfirm --needed "${pkgs[@]}" ;;
        brew)   brew install "${pkgs[@]}" ;;
    esac
}

# ─── System Dependencies ──────────────────────────────────────────────

install_system_deps() {
    info "Installing system dependencies..."

    local to_install=()

    # ffmpeg
    if ! command_exists ffmpeg; then
        to_install+=(ffmpeg)
    else
        success "ffmpeg already installed"
    fi

    # ripgrep
    if ! command_exists rg; then
        case "$PKG" in
            apt|dnf) to_install+=(ripgrep) ;;
            pacman)  to_install+=(ripgrep) ;;
            brew)    to_install+=(ripgrep) ;;
        esac
    else
        success "ripgrep already installed"
    fi

    # libmagic — check for library file (package name varies across distros)
    if [ "$OS" = "linux" ]; then
        if ! ldconfig -p 2>/dev/null | grep -q libmagic; then
            case "$PKG" in
                apt)    to_install+=(libmagic1) ;;
                dnf)    to_install+=(file-libs) ;;
                pacman) to_install+=(file) ;;
            esac
        fi
    elif [ "$OS" = "macos" ]; then
        brew list libmagic >/dev/null 2>&1 || to_install+=(libmagic)
    fi

    # cairo + pango (for cairosvg) — check for library files
    if [ "$OS" = "linux" ]; then
        if ! ldconfig -p 2>/dev/null | grep -q libcairo.so; then
            case "$PKG" in
                apt)    to_install+=(libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0) ;;
                dnf)    to_install+=(cairo pango gdk-pixbuf2) ;;
                pacman) to_install+=(cairo pango gdk-pixbuf2) ;;
            esac
        fi
    elif [ "$OS" = "macos" ]; then
        brew list cairo >/dev/null 2>&1 || to_install+=(cairo pango gdk-pixbuf)
    fi

    # python3
    if ! command_exists python3; then
        case "$PKG" in
            apt)    to_install+=(python3 python3-venv python3-pip) ;;
            dnf)    to_install+=(python3 python3-pip) ;;
            pacman) to_install+=(python python-pip) ;;
            brew)   to_install+=(python@3.12) ;;
        esac
    else
        success "python3 already installed ($(python3 --version))"
        # Ensure venv module is available on Debian/Ubuntu
        if [ "$PKG" = "apt" ] && ! python3 -m venv --help >/dev/null 2>&1; then
            to_install+=(python3-venv)
        fi
    fi

    # node + npm
    if ! command_exists node; then
        if [ "$OS" = "macos" ]; then
            to_install+=(node)
        else
            warn "Node.js not found. Installing via NodeSource..."
            install_node_linux
        fi
    else
        NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            err "Node.js >= 18 required (found v$NODE_VERSION)"
            exit 1
        fi
        success "node already installed ($(node --version))"
    fi

    if [ ${#to_install[@]} -gt 0 ]; then
        info "Installing: ${to_install[*]}"
        pkg_install "${to_install[@]}"
    fi

    success "System dependencies satisfied"
}

install_node_linux() {
    if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        err "curl is required to install Node.js. Install curl first."
        exit 1
    fi
}

# ─── Python venv ───────────────────────────────────────────────────────

setup_python() {
    info "Setting up Python virtual environment..."

    if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
        python3 -m venv "$PROJECT_DIR/backend/venv"
        success "Created virtual environment"
    else
        success "Virtual environment already exists"
    fi

    "$PROJECT_DIR/backend/venv/bin/pip" install -q --upgrade pip
    "$PROJECT_DIR/backend/venv/bin/pip" install -q -r "$PROJECT_DIR/backend/requirements.txt"

    success "Python dependencies installed"
}

# ─── Frontend build ───────────────────────────────────────────────────

build_frontend() {
    info "Building frontend..."

    cd "$PROJECT_DIR/frontend"

    npm ci
    npm run build
    cd "$PROJECT_DIR"

    success "Frontend built"
}

# ─── Config wizard ─────────────────────────────────────────────────────

config_wizard() {
    if [ "$SKIP_WIZARD" = true ]; then
        return
    fi

    echo ""
    echo -e "${BOLD}Configuration${NC}"
    echo ""

    # Root path
    read -r -p "Root directory to browse [$FILAMAMA_ROOT_PATH]: " input
    FILAMAMA_ROOT_PATH="${input:-$FILAMAMA_ROOT_PATH}"

    # Validate root path exists
    if [ ! -d "$FILAMAMA_ROOT_PATH" ]; then
        err "Directory does not exist: $FILAMAMA_ROOT_PATH"
        exit 1
    fi

    # Port
    read -r -p "Port [$FILAMAMA_PORT]: " input
    FILAMAMA_PORT="${input:-$FILAMAMA_PORT}"

    # Upload limit
    read -r -p "Max upload size in MB [$FILAMAMA_MAX_UPLOAD_MB]: " input
    FILAMAMA_MAX_UPLOAD_MB="${input:-$FILAMAMA_MAX_UPLOAD_MB}"

    echo ""
    info "Configuration:"
    echo "  Root path:   $FILAMAMA_ROOT_PATH"
    echo "  Port:        $FILAMAMA_PORT"
    echo "  Upload max:  ${FILAMAMA_MAX_UPLOAD_MB}MB"
    echo ""
}

# ─── Generate config.yaml ─────────────────────────────────────────────

generate_config() {
    info "Generating config.yaml..."

    sed -e "s|__PORT__|$FILAMAMA_PORT|g" \
        -e "s|__ROOT_PATH__|$FILAMAMA_ROOT_PATH|g" \
        -e "s|__MAX_UPLOAD_MB__|$FILAMAMA_MAX_UPLOAD_MB|g" \
        "$TEMPLATES_DIR/config.yaml.template" > "$PROJECT_DIR/backend/config.yaml"

    success "Config written to backend/config.yaml"
}

# ─── Service setup ─────────────────────────────────────────────────────

migrate_old_services() {
    # Detect and remove old two-service setup
    if [ "$OS" = "linux" ]; then
        if systemctl list-unit-files filamama-backend.service >/dev/null 2>&1 || \
           systemctl list-unit-files filamama-frontend.service >/dev/null 2>&1; then
            warn "Detected old two-service setup (filamama-backend + filamama-frontend)"
            info "Migrating to unified filamama.service..."

            sudo systemctl stop filamama-frontend.service 2>/dev/null || true
            sudo systemctl stop filamama-backend.service 2>/dev/null || true
            sudo systemctl disable filamama-frontend.service 2>/dev/null || true
            sudo systemctl disable filamama-backend.service 2>/dev/null || true
            sudo rm -f /etc/systemd/system/filamama-backend.service
            sudo rm -f /etc/systemd/system/filamama-frontend.service
            sudo systemctl daemon-reload

            success "Old services removed"
        fi
    elif [ "$OS" = "macos" ]; then
        local old_plist="$HOME/Library/LaunchAgents/com.filamama.backend.plist"
        if [ -f "$old_plist" ]; then
            warn "Detected old launchd service"
            launchctl unload "$old_plist" 2>/dev/null || true
            rm -f "$old_plist"
            success "Old service removed"
        fi
    fi
}

setup_service() {
    if [ "$SKIP_SERVICE" = true ]; then
        warn "Skipping service setup (--no-service)"
        return
    fi

    local current_user
    current_user=$(whoami)
    local current_group
    current_group=$(id -gn)

    migrate_old_services

    if [ "$OS" = "linux" ]; then
        setup_systemd_service "$current_user" "$current_group"
    elif [ "$OS" = "macos" ]; then
        setup_launchd_service
    fi
}

setup_systemd_service() {
    local user="$1"
    local group="$2"

    info "Installing systemd service..."

    sed -e "s|__USER__|$user|g" \
        -e "s|__GROUP__|$group|g" \
        -e "s|__INSTALL_DIR__|$PROJECT_DIR|g" \
        -e "s|__ROOT_PATH__|$FILAMAMA_ROOT_PATH|g" \
        -e "s|__PORT__|$FILAMAMA_PORT|g" \
        -e "s|__MAX_UPLOAD_MB__|$FILAMAMA_MAX_UPLOAD_MB|g" \
        "$TEMPLATES_DIR/filamama.service.template" > /tmp/filamama.service

    sudo cp /tmp/filamama.service /etc/systemd/system/filamama.service
    rm /tmp/filamama.service

    sudo systemctl daemon-reload
    sudo systemctl enable filamama.service
    sudo systemctl restart filamama.service

    # Wait and verify
    sleep 3
    if sudo systemctl is-active --quiet filamama.service; then
        success "Service is running"
    else
        err "Service failed to start"
        echo "  Check logs: sudo journalctl -u filamama -n 50"
    fi
}

setup_launchd_service() {
    info "Installing launchd service..."

    local plist_dir="$HOME/Library/LaunchAgents"
    local plist_file="$plist_dir/com.filamama.plist"

    mkdir -p "$plist_dir"

    sed -e "s|__INSTALL_DIR__|$PROJECT_DIR|g" \
        -e "s|__ROOT_PATH__|$FILAMAMA_ROOT_PATH|g" \
        -e "s|__PORT__|$FILAMAMA_PORT|g" \
        -e "s|__MAX_UPLOAD_MB__|$FILAMAMA_MAX_UPLOAD_MB|g" \
        "$TEMPLATES_DIR/com.filamama.plist.template" > "$plist_file"

    launchctl unload "$plist_file" 2>/dev/null || true
    launchctl load "$plist_file"

    sleep 2
    if launchctl list com.filamama >/dev/null 2>&1; then
        success "Service is running"
    else
        err "Service failed to start"
        echo "  Check logs: cat /tmp/filamama.err.log"
    fi
}

# ─── Data directories ─────────────────────────────────────────────────

create_data_dirs() {
    mkdir -p "$PROJECT_DIR/data/thumbnails"
    mkdir -p "$PROJECT_DIR/data/transcoded"
    success "Data directories ready"
}

# ─── Subcommands ───────────────────────────────────────────────────────

cmd_install() {
    banner
    detect_os
    detect_pkg_manager

    info "OS: $OS | Package manager: $PKG"
    echo ""

    # Check not running as root
    if [ "$EUID" -eq 0 ]; then
        err "Do not run as root. The script uses sudo when needed."
        exit 1
    fi

    install_system_deps
    echo ""
    setup_python
    echo ""
    build_frontend
    echo ""
    create_data_dirs
    echo ""
    config_wizard
    generate_config
    echo ""
    setup_service

    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC}"
    echo ""
    echo "  FilaMama: http://$(hostname):$FILAMAMA_PORT"
    echo "  API docs: http://$(hostname):$FILAMAMA_PORT/docs"
    echo ""

    if [ "$OS" = "linux" ] && [ "$SKIP_SERVICE" = false ]; then
        echo "Commands:"
        echo "  sudo systemctl status filamama   # Check status"
        echo "  sudo systemctl restart filamama   # Restart"
        echo "  sudo journalctl -u filamama -f    # View logs"
    elif [ "$OS" = "macos" ] && [ "$SKIP_SERVICE" = false ]; then
        echo "Commands:"
        echo "  launchctl list com.filamama       # Check status"
        echo "  launchctl stop com.filamama        # Stop"
        echo "  launchctl start com.filamama       # Start"
        echo "  cat /tmp/filamama.err.log          # View logs"
    fi
    echo ""
}

cmd_update() {
    banner
    detect_os
    info "Updating FilaMama..."
    echo ""

    # Pull latest code
    cd "$PROJECT_DIR"
    if [ -d ".git" ]; then
        info "Pulling latest code..."
        git pull
        echo ""
    fi

    setup_python
    echo ""
    build_frontend
    echo ""

    # Restart service
    if [ "$OS" = "linux" ]; then
        if systemctl is-active --quiet filamama.service 2>/dev/null; then
            info "Restarting service..."
            sudo systemctl restart filamama.service
            sleep 2
            if sudo systemctl is-active --quiet filamama.service; then
                success "Service restarted"
            else
                err "Service failed to restart"
            fi
        fi
    elif [ "$OS" = "macos" ]; then
        if launchctl list com.filamama >/dev/null 2>&1; then
            info "Restarting service..."
            launchctl stop com.filamama
            sleep 1
            launchctl start com.filamama
            success "Service restarted"
        fi
    fi

    echo ""
    success "Update complete!"
    echo ""
}

cmd_uninstall() {
    banner
    detect_os

    echo -e "${YELLOW}This will stop and remove the FilaMama service.${NC}"
    echo "Your data and application files will be preserved."
    echo ""
    read -r -p "Continue? (y/N) " reply
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi

    echo ""

    if [ "$OS" = "linux" ]; then
        sudo systemctl stop filamama.service 2>/dev/null || true
        sudo systemctl disable filamama.service 2>/dev/null || true
        sudo rm -f /etc/systemd/system/filamama.service
        sudo systemctl daemon-reload

        # Also clean up old two-service setup if present
        sudo systemctl stop filamama-backend.service 2>/dev/null || true
        sudo systemctl stop filamama-frontend.service 2>/dev/null || true
        sudo systemctl disable filamama-backend.service 2>/dev/null || true
        sudo systemctl disable filamama-frontend.service 2>/dev/null || true
        sudo rm -f /etc/systemd/system/filamama-backend.service
        sudo rm -f /etc/systemd/system/filamama-frontend.service
        sudo systemctl daemon-reload
    elif [ "$OS" = "macos" ]; then
        local plist="$HOME/Library/LaunchAgents/com.filamama.plist"
        launchctl unload "$plist" 2>/dev/null || true
        rm -f "$plist"
    fi

    success "Service removed"
    echo ""
    echo "To completely remove FilaMama:"
    echo "  rm -rf $PROJECT_DIR"
    echo ""
}

cmd_configure() {
    banner
    detect_os

    config_wizard
    generate_config

    # Restart if service exists
    if [ "$OS" = "linux" ] && systemctl is-active --quiet filamama.service 2>/dev/null; then
        read -r -p "Restart service with new config? (Y/n) " reply
        if [[ ! "$reply" =~ ^[Nn]$ ]]; then
            sudo systemctl restart filamama.service
            success "Service restarted"
        fi
    fi

    echo ""
    success "Configuration updated"
    echo ""
}

cmd_status() {
    detect_os

    echo -e "${BOLD}FilaMama Status${NC}"
    echo ""

    if [ "$OS" = "linux" ]; then
        if systemctl is-active --quiet filamama.service 2>/dev/null; then
            echo -e "  Service: ${GREEN}running${NC}"
        else
            echo -e "  Service: ${RED}stopped${NC}"
        fi
        echo "  Config:  $PROJECT_DIR/backend/config.yaml"

        # Show config values if file exists
        if [ -f "$PROJECT_DIR/backend/config.yaml" ]; then
            local port root_path
            port=$(grep -m1 'port:' "$PROJECT_DIR/backend/config.yaml" | awk '{print $2}')
            root_path=$(grep 'root_path:' "$PROJECT_DIR/backend/config.yaml" | awk '{print $2}' | tr -d '"')
            echo "  Port:    $port"
            echo "  Root:    $root_path"
        fi
    elif [ "$OS" = "macos" ]; then
        if launchctl list com.filamama >/dev/null 2>&1; then
            echo -e "  Service: ${GREEN}running${NC}"
        else
            echo -e "  Service: ${RED}stopped${NC}"
        fi
    fi

    echo ""
}

# ─── Usage ─────────────────────────────────────────────────────────────

usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  --install      Install FilaMama (default)"
    echo "  --update       Pull latest code, rebuild, restart service"
    echo "  --uninstall    Remove service (keeps files)"
    echo "  --configure    Re-run config wizard"
    echo "  --status       Show service status"
    echo ""
    echo "Options:"
    echo "  --no-service   Skip service setup (just build)"
    echo "  --no-wizard    Skip interactive config wizard (use defaults/env vars)"
    echo "  --port N       Set port (default: 1031)"
    echo "  --root PATH    Set root browse path (default: \$HOME)"
    echo "  --help         Show this help"
    echo ""
    echo "Environment variables:"
    echo "  FILAMAMA_PORT           Port number"
    echo "  FILAMAMA_ROOT_PATH      Root browse directory"
    echo "  FILAMAMA_MAX_UPLOAD_MB  Max upload size in MB"
    echo ""
}

# ─── Main ──────────────────────────────────────────────────────────────

main() {
    local command="install"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --install)    command="install"; shift ;;
            --update)     command="update"; shift ;;
            --uninstall)  command="uninstall"; shift ;;
            --configure)  command="configure"; shift ;;
            --status)     command="status"; shift ;;
            --no-service) SKIP_SERVICE=true; shift ;;
            --no-wizard)  SKIP_WIZARD=true; shift ;;
            --port)       FILAMAMA_PORT="$2"; shift 2 ;;
            --root)       FILAMAMA_ROOT_PATH="$2"; shift 2 ;;
            --help|-h)    usage; exit 0 ;;
            *)            err "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    case "$command" in
        install)   cmd_install ;;
        update)    cmd_update ;;
        uninstall) cmd_uninstall ;;
        configure) cmd_configure ;;
        status)    cmd_status ;;
    esac
}

main "$@"
