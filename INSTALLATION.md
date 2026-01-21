# FilaMama Installation Guide

## Overview

FilaMama can be installed as a systemd service that runs automatically on system boot, ensuring it's always available.

## Installation

### Step 1: Run the Installation Script

```bash
cd /home/flatstone/Claude/FLATSTONE/FilaMama
./install.sh
```

The script will:
1. ✅ Check prerequisites (Python3, Node.js, npm)
2. ✅ Set up Python virtual environment
3. ✅ Install backend dependencies (FastAPI, Uvicorn, etc.)
4. ✅ Install frontend dependencies (React, Vite, etc.)
5. ✅ Build frontend for production
6. ✅ Create data directories
7. ✅ Configure and install systemd services
8. ✅ Enable services to start on boot
9. ✅ Start both services

### Step 2: Verify Installation

After installation completes, check that services are running:

```bash
sudo systemctl status filamama-backend
sudo systemctl status filamama-frontend
```

Both should show "active (running)" in green.

### Step 3: Access FilaMama

Open your browser to:
- **Frontend UI:** http://spark.local:1030
- **Backend API:** http://spark.local:1031
- **API Docs:** http://spark.local:1031/docs

**Note:** The production service runs on ports 1030-1031. Development mode (using `./start.sh`) runs on ports 8010-8011, allowing you to run both simultaneously.

## Service Management

### Status Commands

```bash
# Check if services are running
sudo systemctl status filamama-backend
sudo systemctl status filamama-frontend

# Check if services are enabled (start on boot)
sudo systemctl is-enabled filamama-backend
sudo systemctl is-enabled filamama-frontend
```

### Start/Stop Commands

```bash
# Stop services
sudo systemctl stop filamama-backend
sudo systemctl stop filamama-frontend

# Start services
sudo systemctl start filamama-backend
sudo systemctl start filamama-frontend

# Restart services (useful after config changes)
sudo systemctl restart filamama-backend
sudo systemctl restart filamama-frontend
```

### Log Viewing

```bash
# View backend logs (follow mode - live updates)
sudo journalctl -u filamama-backend -f

# View frontend logs (follow mode)
sudo journalctl -u filamama-frontend -f

# View last 50 lines of backend logs
sudo journalctl -u filamama-backend -n 50

# View last 50 lines of frontend logs
sudo journalctl -u filamama-frontend -n 50
```

### Enable/Disable Auto-Start

```bash
# Disable auto-start on boot
sudo systemctl disable filamama-backend
sudo systemctl disable filamama-frontend

# Re-enable auto-start on boot
sudo systemctl enable filamama-backend
sudo systemctl enable filamama-frontend
```

## Uninstallation

To remove the systemd services (keeps your data):

```bash
cd /home/flatstone/Claude/FLATSTONE/FilaMama
./uninstall.sh
```

This will:
- Stop both services
- Disable auto-start on boot
- Remove systemd service files
- Keep your application files and data intact

To completely remove FilaMama including data:

```bash
cd /home/flatstone/Claude/FLATSTONE
rm -rf FilaMama
```

## Updating FilaMama

After making code changes:

### Backend Changes

```bash
# Restart the backend service
sudo systemctl restart filamama-backend

# View logs to check for errors
sudo journalctl -u filamama-backend -f
```

### Frontend Changes

```bash
# Rebuild the frontend
cd /home/flatstone/Claude/FLATSTONE/FilaMama/frontend
npm run build

# Restart the frontend service
sudo systemctl restart filamama-frontend

# View logs to check for errors
sudo journalctl -u filamama-frontend -f
```

### Dependency Changes

If you update `requirements.txt` or `package.json`:

```bash
# Reinstall dependencies
cd /home/flatstone/Claude/FLATSTONE/FilaMama
./install.sh

# The script will detect existing installations and update them
```

## Troubleshooting

### Service Won't Start

1. Check the logs for error messages:
   ```bash
   sudo journalctl -u filamama-backend -n 50
   sudo journalctl -u filamama-frontend -n 50
   ```

2. Verify the ports aren't in use:
   ```bash
   ss -tlnp | grep -E ':(8010|8011)'
   ```

3. Check file permissions:
   ```bash
   ls -la /home/flatstone/Claude/FLATSTONE/FilaMama
   ```

### Port Conflicts

If ports 1030 or 1031 are already in use:

1. Find what's using the port:
   ```bash
   sudo lsof -i :1030
   sudo lsof -i :1031
   ```

2. Either stop the conflicting service or update `ports.json` with new ports

3. Update the systemd service files:
   ```bash
   sudo nano /etc/systemd/system/filamama-backend.service
   sudo nano /etc/systemd/system/filamama-frontend.service
   ```

4. Reload and restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart filamama-backend
   sudo systemctl restart filamama-frontend
   ```

**Port Allocation:**
- Production (systemd): 1030-1031
- Development (./start.sh): 8010-8011

### Frontend Build Fails

If the frontend build fails during installation:

1. Check for TypeScript errors:
   ```bash
   cd frontend
   npx tsc --noEmit
   ```

2. Check for missing dependencies:
   ```bash
   npm install
   ```

3. Clear the build cache:
   ```bash
   rm -rf dist node_modules/.vite
   npm run build
   ```

### Backend Won't Start

Common issues:

1. **Python virtual environment issues:**
   ```bash
   rm -rf backend/venv
   python3 -m venv backend/venv
   source backend/venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. **Config file issues:**
   Check `backend/config.yaml` for syntax errors

3. **Permission issues:**
   Ensure the user running the service has access to the root_path in config.yaml

## Files Created

The installation creates these files:

- `/etc/systemd/system/filamama-backend.service` - Backend systemd service
- `/etc/systemd/system/filamama-frontend.service` - Frontend systemd service
- `backend/venv/` - Python virtual environment
- `frontend/node_modules/` - Node.js dependencies
- `frontend/dist/` - Production build of frontend
- `data/thumbnails/` - Generated thumbnail cache

## Configuration

### Backend Configuration

Edit `backend/config.yaml` to change:
- Root directory for file browsing
- Thumbnail settings
- Upload limits

After changing config, restart the backend:
```bash
sudo systemctl restart filamama-backend
```

### Port Configuration

Edit `ports.json` to document port allocations:
```json
{
  "project": "FilaMama",
  "basePort": 8010,
  "range": 10,
  "allocated": {
    "frontend": 8010,
    "backend": 8011
  }
}
```

## Development vs Production

### Development Mode (Ports 8010-8011)

Use `./start.sh` for development:
- Hot reload for frontend changes
- Auto-reload for backend changes
- Detailed error messages
- Not persistent (stops when terminal closes)
- Frontend: http://spark.local:8010
- Backend: http://spark.local:8011

### Production Mode (Ports 1030-1031)

Use `./install.sh` for production:
- Runs as system service
- Auto-starts on boot
- Runs in background
- Managed by systemd
- Production-optimized build
- Frontend: http://spark.local:1030
- Backend: http://spark.local:1031

**You can run both simultaneously!** Development and production use different ports, so you can test changes in dev mode while keeping production running.

## Security Notes

The systemd services include basic security hardening:
- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Isolated /tmp directory
- Runs as non-root user (your user account)

For additional security:
- Configure firewall rules for ports 8010/8011
- Use HTTPS with a reverse proxy (nginx, Caddy)
- Restrict file browser root path in config.yaml
- Enable authentication if exposing to network
