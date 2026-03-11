# FilaMama Installation Guide

## Overview

FilaMama runs as a single-process service (FastAPI serves both API and frontend). Configuration lives in `/etc/filamama/config.yaml`, separate from the application code.

## Quick Install

```bash
git clone https://github.com/flatstoneworks/FilaMama.git
cd FilaMama
./install-filamama.sh
```

The installer will:
1. Install system dependencies (FFmpeg, ripgrep, libmagic, Cairo)
2. Set up Python virtual environment and install backend dependencies
3. Build the frontend for production
4. Run the interactive config wizard (root path, port, mount points)
5. Write config to `/etc/filamama/config.yaml`
6. Install and start the systemd service (Linux) or launchd service (macOS)

## Configuration

### Config File

Production config is stored at `/etc/filamama/config.yaml`. This is separate from the application directory so updates and reinstalls don't overwrite your settings.

```yaml
# /etc/filamama/config.yaml
server:
  host: "0.0.0.0"
  port: 1031

root_path: "/home/user"

mounts:
  - name: "External"
    path: "/media/external-drive"
    icon: "hard-drive"
  - name: "NAS"
    path: "/mnt/nas"
    icon: "hard-drive"

thumbnails:
  enabled: true
  cache_dir: "data/thumbnails"
  # ...

upload:
  max_size_mb: 10240
  chunk_size_mb: 10
```

### Reconfigure

Run the config wizard again to change settings:

```bash
./install-filamama.sh --configure
```

This updates `/etc/filamama/config.yaml` and optionally restarts the service.

### Environment Variable Overrides

All config values can be overridden via environment variables without editing the config file:

| Variable | Description | Example |
|----------|-------------|---------|
| `FILAMAMA_CONFIG` | Config file path | `/etc/filamama/config.yaml` |
| `FILAMAMA_ROOT_PATH` | Root browse directory | `/home/user` |
| `FILAMAMA_HOST` | Server bind host | `0.0.0.0` |
| `FILAMAMA_PORT` | Server bind port | `1031` |
| `FILAMAMA_DATA_DIR` | Thumbnail + transcoding cache | `/data` |
| `FILAMAMA_MAX_UPLOAD_MB` | Max upload size in MB | `10240` |
| `FILAMAMA_CORS_ORIGINS` | Comma-separated CORS origins | `http://host:1031` |
| `FILAMAMA_FRONTEND_DIST` | Frontend dist directory | `/app/frontend/dist` |

## Service Management

### Commands

```bash
# Check status
./install-filamama.sh --status

# Or use systemctl directly
sudo systemctl status filamama
sudo systemctl restart filamama
sudo systemctl stop filamama

# View logs
sudo journalctl -u filamama -f
sudo journalctl -u filamama -n 50
```

### Update

Pull latest code, rebuild, and restart:

```bash
./install-filamama.sh --update
```

### Uninstall

Removes the service and `/etc/filamama/` config. Application files are preserved:

```bash
./install-filamama.sh --uninstall
```

## Installer Options

```
Usage: ./install-filamama.sh [command] [options]

Commands:
  --install      Install FilaMama (default)
  --update       Pull latest code, rebuild, restart service
  --uninstall    Remove service and config (keeps files)
  --configure    Re-run config wizard
  --status       Show service status and config

Options:
  --no-service   Skip service setup (just build)
  --no-wizard    Skip interactive config wizard (use defaults/env vars)
  --port N       Set port (default: 1031)
  --root PATH    Set root browse path (default: $HOME)
```

## URLs

| Mode | URL | Description |
|------|-----|-------------|
| Production | `http://<hostname>:1031` | Single-process (API + frontend) |
| Production | `http://<hostname>:1031/docs` | Swagger API docs |
| Development | `http://<hostname>:8010` | Frontend dev server (hot reload) |
| Development | `http://<hostname>:8011` | Backend dev server |

Development and production use different ports, so you can run both simultaneously.

## Docker

```bash
docker compose up
```

Or manually:

```bash
docker build -t filamama .
docker run -p 1031:1031 -v ~/:/browse filamama
```

## Files Created

| Path | Description |
|------|-------------|
| `/etc/filamama/config.yaml` | Production config |
| `/etc/systemd/system/filamama.service` | systemd unit (Linux) |
| `~/Library/LaunchAgents/com.filamama.plist` | launchd plist (macOS) |
| `backend/venv/` | Python virtual environment |
| `frontend/dist/` | Production frontend build |
| `data/thumbnails/` | Thumbnail cache |
| `data/transcoded/` | Transcoded video cache |

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u filamama -n 50

# Check port in use
sudo lsof -i :1031

# Verify config
cat /etc/filamama/config.yaml
```

### Config not found

If the service can't find the config:

```bash
# Verify the file exists
ls -la /etc/filamama/config.yaml

# Re-run config wizard
./install-filamama.sh --configure
```

### Port conflicts

Change the port via the config wizard or edit `/etc/filamama/config.yaml` directly, then restart:

```bash
sudo systemctl restart filamama
```

## Security

The systemd service includes:
- `NoNewPrivileges=true` — prevents privilege escalation
- `PrivateTmp=true` — isolated /tmp directory
- Runs as non-root user
- Path traversal protection on all file operations
- Server-side upload size enforcement
