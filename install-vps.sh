#!/usr/bin/env bash

# FilaMama VPS installer
# Intended use:
#   curl -fsSL https://raw.githubusercontent.com/flatstoneworks/FilaMama/main/install-vps.sh | bash

set -euo pipefail

INSTALL_DIR="/opt/filamama"
DEFAULT_BROWSE_PATH="/srv/filamama/files"
DEFAULT_PORT="1031"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info() { printf "${BLUE}[info]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[ok]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[warn]${NC} %s\n" "$*"; }
err() { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

require_linux() {
    if [ "$(uname -s)" != "Linux" ]; then
        err "This installer is for Linux VPS hosts."
        exit 1
    fi
}

setup_sudo() {
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
        SUDO=""
    else
        if ! command_exists sudo; then
            err "sudo is required when running as a non-root user."
            exit 1
        fi
        sudo -v
        SUDO="sudo"
    fi
}

setup_tty() {
    if [ -r /dev/tty ] && [ -w /dev/tty ]; then
        TTY="/dev/tty"
    else
        err "Interactive terminal required. Re-run this installer from a TTY."
        exit 1
    fi
}

prompt() {
    local message="$1"
    local value
    printf "%s" "$message" >"$TTY"
    IFS= read -r value <"$TTY"
    printf "%s" "$value"
}

prompt_secret() {
    local message="$1"
    local value
    printf "%s" "$message" >"$TTY"
    stty -echo <"$TTY"
    IFS= read -r value <"$TTY"
    stty echo <"$TTY"
    printf "\n" >"$TTY"
    printf "%s" "$value"
}

generate_password() {
    if command_exists openssl; then
        openssl rand -hex 18
    else
        dd if=/dev/urandom bs=18 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'
    fi
}

strip_quotes() {
    local value="$1"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf "%s" "$value"
}

read_existing_env_value() {
    local key="$1"
    local env_file="$INSTALL_DIR/.env"
    local line value

    if [ ! -f "$env_file" ]; then
        return 0
    fi

    line=$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)
    if [ -z "$line" ]; then
        return 0
    fi

    value="${line#*=}"
    strip_quotes "$value"
}

env_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\$}"
    printf '"%s"' "$value"
}

normalize_domain() {
    local value="$1"
    value="${value#http://}"
    value="${value#https://}"
    value="${value%%/*}"
    printf "%s" "$value"
}

collect_config() {
    local existing_browse existing_user existing_domain existing_port input generated

    existing_browse=$(read_existing_env_value "FILAMAMA_BROWSE_PATH")
    existing_user=$(read_existing_env_value "FILAMAMA_AUTH_USER")
    existing_domain=$(read_existing_env_value "FILAMAMA_DOMAIN")
    existing_port=$(read_existing_env_value "FILAMAMA_PORT")

    FILAMAMA_BROWSE_PATH="${existing_browse:-$DEFAULT_BROWSE_PATH}"
    FILAMAMA_AUTH_USER="${existing_user:-}"
    FILAMAMA_DOMAIN="${existing_domain:-}"
    FILAMAMA_PORT="${existing_port:-$DEFAULT_PORT}"

    printf "\n${BOLD}FilaMama VPS configuration${NC}\n\n" >"$TTY"

    input=$(prompt "Browse path [$FILAMAMA_BROWSE_PATH]: ")
    FILAMAMA_BROWSE_PATH="${input:-$FILAMAMA_BROWSE_PATH}"

    while true; do
        if [ -n "$FILAMAMA_AUTH_USER" ]; then
            input=$(prompt "Basic Auth username [$FILAMAMA_AUTH_USER]: ")
            FILAMAMA_AUTH_USER="${input:-$FILAMAMA_AUTH_USER}"
        else
            input=$(prompt "Basic Auth username (required): ")
            FILAMAMA_AUTH_USER="$input"
        fi

        if [ -n "$FILAMAMA_AUTH_USER" ]; then
            break
        fi
        warn "Username is required."
    done

    if [ -n "$(read_existing_env_value "FILAMAMA_AUTH_PASSWORD")" ]; then
        input=$(prompt_secret "Basic Auth password [keep existing if blank]: ")
        if [ -n "$input" ]; then
            FILAMAMA_AUTH_PASSWORD="$input"
        else
            FILAMAMA_AUTH_PASSWORD=$(read_existing_env_value "FILAMAMA_AUTH_PASSWORD")
        fi
    else
        input=$(prompt_secret "Basic Auth password [generate if blank]: ")
        if [ -n "$input" ]; then
            FILAMAMA_AUTH_PASSWORD="$input"
        else
            generated=$(generate_password)
            FILAMAMA_AUTH_PASSWORD="$generated"
            GENERATED_PASSWORD="true"
        fi
    fi

    if [ -n "$FILAMAMA_DOMAIN" ]; then
        input=$(prompt "Domain name [$FILAMAMA_DOMAIN, '-' to disable]: ")
        if [ "$input" = "-" ]; then
            FILAMAMA_DOMAIN=""
        else
            FILAMAMA_DOMAIN=$(normalize_domain "${input:-$FILAMAMA_DOMAIN}")
        fi
    else
        input=$(prompt "Domain name (optional, blank for no-domain mode): ")
        FILAMAMA_DOMAIN=$(normalize_domain "$input")
    fi

    if [ -z "$FILAMAMA_DOMAIN" ]; then
        input=$(prompt "Public HTTP port [$FILAMAMA_PORT]: ")
        FILAMAMA_PORT="${input:-$FILAMAMA_PORT}"
        if ! [[ "$FILAMAMA_PORT" =~ ^[0-9]+$ ]] || [ "$FILAMAMA_PORT" -lt 1 ] || [ "$FILAMAMA_PORT" -gt 65535 ]; then
            err "Port must be a number between 1 and 65535."
            exit 1
        fi
    fi
}

install_docker_apt() {
    local id codename

    # shellcheck source=/dev/null
    . /etc/os-release
    id="${ID:-}"
    case "$id" in
        ubuntu|debian) ;;
        linuxmint|pop|elementary)
            id="ubuntu"
            codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
            ;;
        *) warn "Attempting Docker install using the $id apt repository settings." ;;
    esac

    codename="${codename:-${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}}"
    if [ -z "$codename" ]; then
        err "Could not determine Debian/Ubuntu codename for Docker repository."
        exit 1
    fi

    $SUDO apt-get update
    $SUDO apt-get install -y ca-certificates curl gnupg
    $SUDO install -m 0755 -d /etc/apt/keyrings

    curl -fsSL "https://download.docker.com/linux/$id/gpg" | $SUDO tee /etc/apt/keyrings/docker.asc >/dev/null
    $SUDO chmod a+r /etc/apt/keyrings/docker.asc

    printf "deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n" \
        "$(dpkg --print-architecture)" "$id" "$codename" | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

    $SUDO apt-get update
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_dnf() {
    local repo="centos"

    # shellcheck source=/dev/null
    . /etc/os-release
    if [ "${ID:-}" = "fedora" ]; then
        repo="fedora"
    fi

    $SUDO dnf install -y dnf-plugins-core
    if $SUDO dnf config-manager --help 2>/dev/null | grep -q -- '--add-repo'; then
        $SUDO dnf config-manager --add-repo "https://download.docker.com/linux/$repo/docker-ce.repo"
    else
        $SUDO dnf config-manager addrepo --from-repofile="https://download.docker.com/linux/$repo/docker-ce.repo"
    fi
    $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_pacman() {
    $SUDO pacman -Syu --noconfirm --needed docker docker-compose
}

install_docker() {
    if command_exists docker; then
        success "Docker already installed"
    else
        info "Docker not found. Installing Docker Engine..."
        if command_exists apt-get; then
            install_docker_apt
        elif command_exists dnf; then
            install_docker_dnf
        elif command_exists pacman; then
            install_docker_pacman
        else
            err "No supported package manager found. Install Docker Engine, then rerun this script."
            exit 1
        fi
    fi

    if command_exists systemctl; then
        $SUDO systemctl enable --now docker
    elif command_exists service; then
        $SUDO service docker start
    fi

    if ! $SUDO docker compose version >/dev/null 2>&1; then
        warn "Docker Compose plugin not found. Attempting to install it..."
        if command_exists apt-get; then
            $SUDO apt-get update
            $SUDO apt-get install -y docker-compose-plugin
        elif command_exists dnf; then
            $SUDO dnf install -y docker-compose-plugin
        elif command_exists pacman; then
            $SUDO pacman -S --noconfirm --needed docker-compose
        fi
    fi

    if ! $SUDO docker compose version >/dev/null 2>&1; then
        err "Docker Compose plugin is required but was not found."
        exit 1
    fi

    success "Docker Compose ready"
}

write_env_file() {
    local env_tmp
    env_tmp=$(mktemp)

    {
        printf "FILAMAMA_BROWSE_PATH=%s\n" "$(env_quote "$FILAMAMA_BROWSE_PATH")"
        printf "FILAMAMA_PORT=%s\n" "$(env_quote "$FILAMAMA_PORT")"
        printf "FILAMAMA_DOMAIN=%s\n" "$(env_quote "$FILAMAMA_DOMAIN")"
        printf "FILAMAMA_AUTH_USER=%s\n" "$(env_quote "$FILAMAMA_AUTH_USER")"
        printf "FILAMAMA_AUTH_PASSWORD=%s\n" "$(env_quote "$FILAMAMA_AUTH_PASSWORD")"
    } >"$env_tmp"

    $SUDO install -m 0600 "$env_tmp" "$INSTALL_DIR/.env"
    rm -f "$env_tmp"
}

write_compose_file() {
    local compose_tmp
    compose_tmp=$(mktemp)

    if [ -n "$FILAMAMA_DOMAIN" ]; then
        cat >"$compose_tmp" <<'COMPOSE'
services:
  filamama:
    image: ghcr.io/flatstoneworks/filamama:latest
    restart: unless-stopped
    expose:
      - "1031"
    volumes:
      - "${FILAMAMA_BROWSE_PATH:-/srv/filamama/files}:/browse"
      - filamama-data:/data
    environment:
      FILAMAMA_ROOT_PATH: /browse
      FILAMAMA_DATA_DIR: /data
      FILAMAMA_AUTH_USER: ${FILAMAMA_AUTH_USER:?set FILAMAMA_AUTH_USER in .env}
      FILAMAMA_AUTH_PASSWORD: ${FILAMAMA_AUTH_PASSWORD:?set FILAMAMA_AUTH_PASSWORD in .env}

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - filamama
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  filamama-data:
  caddy-data:
  caddy-config:
COMPOSE
    else
        cat >"$compose_tmp" <<'COMPOSE'
services:
  filamama:
    image: ghcr.io/flatstoneworks/filamama:latest
    restart: unless-stopped
    ports:
      - "${FILAMAMA_PORT:-1031}:1031"
    volumes:
      - "${FILAMAMA_BROWSE_PATH:-/srv/filamama/files}:/browse"
      - filamama-data:/data
    environment:
      FILAMAMA_ROOT_PATH: /browse
      FILAMAMA_DATA_DIR: /data
      FILAMAMA_AUTH_USER: ${FILAMAMA_AUTH_USER:?set FILAMAMA_AUTH_USER in .env}
      FILAMAMA_AUTH_PASSWORD: ${FILAMAMA_AUTH_PASSWORD:?set FILAMAMA_AUTH_PASSWORD in .env}

volumes:
  filamama-data:
COMPOSE
    fi

    $SUDO install -m 0644 "$compose_tmp" "$INSTALL_DIR/docker-compose.yml"
    rm -f "$compose_tmp"
}

write_caddyfile() {
    local caddy_tmp

    if [ -z "$FILAMAMA_DOMAIN" ]; then
        $SUDO rm -f "$INSTALL_DIR/Caddyfile"
        return
    fi

    caddy_tmp=$(mktemp)
    cat >"$caddy_tmp" <<CADDY
$FILAMAMA_DOMAIN {
    reverse_proxy filamama:1031
}
CADDY
    $SUDO install -m 0644 "$caddy_tmp" "$INSTALL_DIR/Caddyfile"
    rm -f "$caddy_tmp"
}

prepare_filesystem() {
    info "Preparing $INSTALL_DIR and $FILAMAMA_BROWSE_PATH..."
    $SUDO mkdir -p "$INSTALL_DIR" "$FILAMAMA_BROWSE_PATH"
    write_env_file
    write_compose_file
    write_caddyfile
    success "Compose configuration written"
}

start_stack() {
    info "Starting FilaMama..."
    (cd "$INSTALL_DIR" && $SUDO docker compose up -d)
    success "FilaMama stack started"
}

server_ip() {
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    printf "%s" "${ip:-$(hostname)}"
}

print_summary() {
    local url docker_prefix

    if [ -n "$FILAMAMA_DOMAIN" ]; then
        url="https://$FILAMAMA_DOMAIN"
    else
        url="http://$(server_ip):$FILAMAMA_PORT"
    fi

    if [ -n "$SUDO" ]; then
        docker_prefix="sudo docker compose"
    else
        docker_prefix="docker compose"
    fi

    printf "\n${GREEN}${BOLD}FilaMama VPS install complete${NC}\n\n"
    printf "URL: %s\n" "$url"
    printf "Username: %s\n" "$FILAMAMA_AUTH_USER"
    if [ "${GENERATED_PASSWORD:-false}" = "true" ]; then
        printf "Generated password: %s\n" "$FILAMAMA_AUTH_PASSWORD"
    fi
    printf "\n"
    printf "Status:\n"
    (cd "$INSTALL_DIR" && $SUDO docker compose ps)
    printf "\nCommands:\n"
    printf "  Logs:   cd %s && %s logs -f\n" "$INSTALL_DIR" "$docker_prefix"
    printf "  Update: cd %s && %s pull && %s up -d\n" "$INSTALL_DIR" "$docker_prefix" "$docker_prefix"
    printf "  Stop:   cd %s && %s down\n" "$INSTALL_DIR" "$docker_prefix"
    printf "\n"

    if [ -n "$FILAMAMA_DOMAIN" ]; then
        printf "Caddy will request HTTPS certificates automatically after DNS points to this VPS and ports 80/443 are open.\n"
    else
        printf "No-domain mode exposes FilaMama directly on port %s. Keep Basic Auth enabled.\n" "$FILAMAMA_PORT"
    fi
}

main() {
    GENERATED_PASSWORD="false"
    require_linux
    setup_sudo
    setup_tty
    collect_config
    install_docker
    prepare_filesystem
    start_stack
    print_summary
}

main "$@"
