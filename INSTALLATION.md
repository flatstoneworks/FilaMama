# FilaMama Installation Guide

## Recommended: VPS Docker Install

FilaMama's recommended production path is a Docker Compose install on a Linux VPS using the prebuilt GHCR image.

```bash
curl -fsSL https://raw.githubusercontent.com/flatstoneworks/FilaMama/main/install-vps.sh | bash
```

The installer is idempotent and writes everything under `/opt/filamama`:

| Path | Description |
|------|-------------|
| `/opt/filamama/.env` | Browse path, auth credentials, domain/port settings |
| `/opt/filamama/docker-compose.yml` | Generated Compose stack |
| `/opt/filamama/Caddyfile` | Generated only when a domain is configured |

It asks for:

| Prompt | Default | Notes |
|--------|---------|-------|
| Browse path | `/srv/filamama/files` | Mounted into the container as `/browse` |
| Username | none | Required |
| Password | generated if blank | Existing password is kept on rerun when left blank |
| Domain | blank | Enables Caddy HTTPS mode when set |
| Port | `1031` | Only used in no-domain mode |

The generated stack always sets:

```env
FILAMAMA_ROOT_PATH=/browse
FILAMAMA_DATA_DIR=/data
FILAMAMA_AUTH_USER=...
FILAMAMA_AUTH_PASSWORD=...
```

Public VPS installs require Basic Auth. The VPS installer does not set `FILAMAMA_ALLOW_INSECURE=true`.

## No-Domain Mode

Leave the domain prompt blank to expose FilaMama directly:

```text
http://<vps-ip>:1031
```

The generated Compose file maps:

```yaml
ports:
  - "${FILAMAMA_PORT:-1031}:1031"
```

Open the chosen port in your firewall and use the Basic Auth credentials printed by the installer.

## Domain + Caddy HTTPS Mode

Enter a domain name during installation to run Caddy in front of FilaMama.

Caddy:

- obtains and renews HTTPS certificates automatically
- listens publicly on ports `80` and `443`
- reverse proxies to `filamama:1031` on the private Compose network

Before choosing this mode:

- create a DNS `A` record for the domain pointing to the VPS IP
- open inbound ports `80` and `443`
- do not expose port `1031` publicly

Generated `Caddyfile`:

```caddy
example.com {
    reverse_proxy filamama:1031
}
```

## VPS Operations

Run these from the VPS.

```bash
cd /opt/filamama

# Status
sudo docker compose ps

# Logs
sudo docker compose logs -f

# Update to the latest GHCR image
sudo docker compose pull
sudo docker compose up -d

# Stop
sudo docker compose down
```

To reconfigure, rerun the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/flatstoneworks/FilaMama/main/install-vps.sh | bash
```

Existing values become defaults. When a domain is already configured, enter `-` at the domain prompt to switch back to no-domain mode.

To uninstall the VPS stack:

```bash
cd /opt/filamama
sudo docker compose down
sudo rm -rf /opt/filamama
```

This removes the Compose stack and installer files. It does not remove the browse directory unless you delete that path separately.

## Manual Production Compose Examples

For no-domain production Compose, start from [`docker-compose.prod.yml`](docker-compose.prod.yml).

For Caddy HTTPS production Compose, start from [`docker-compose.caddy.yml`](docker-compose.caddy.yml) and create a `Caddyfile` next to it.

Both examples use:

```yaml
image: ghcr.io/flatstoneworks/filamama:latest
```

## Local Docker

For local testing from a checkout:

```bash
git clone https://github.com/flatstoneworks/FilaMama.git
cd FilaMama
docker compose up
```

The root `docker-compose.yml` builds from source and sets `FILAMAMA_ALLOW_INSECURE=true` for local-only development. Do not use that insecure setting for a public VPS.

## Advanced Native Install

The native installer builds from source, installs system dependencies, creates a Python venv, builds the frontend, writes `/etc/filamama/config.yaml`, and installs a systemd or launchd service.

```bash
git clone https://github.com/flatstoneworks/FilaMama.git
cd FilaMama
./install-filamama.sh
```

Commands:

```bash
./install-filamama.sh --status
./install-filamama.sh --update
./install-filamama.sh --configure
./install-filamama.sh --uninstall
```

Native service logs:

```bash
sudo journalctl -u filamama -f
```

## Configuration

Native config file:

```yaml
server:
  host: "0.0.0.0"
  port: 1031

root_path: "/home/user"

mounts: []

thumbnails:
  enabled: true
  cache_dir: "data/thumbnails"

transcoding:
  cache_dir: "data/transcoded"

upload:
  max_size_mb: 10240
```

### Environment Variable Overrides

| Variable | Description | Example |
|----------|-------------|---------|
| `FILAMAMA_CONFIG` | Config file path | `/etc/filamama/config.yaml` |
| `FILAMAMA_ROOT_PATH` | Root browse directory | `/browse` |
| `FILAMAMA_HOST` | Server bind host | `0.0.0.0` |
| `FILAMAMA_PORT` | Server bind port | `1031` |
| `FILAMAMA_DATA_DIR` | Thumbnail + transcoding cache | `/data` |
| `FILAMAMA_MAX_UPLOAD_MB` | Max upload size in MB | `10240` |
| `FILAMAMA_CORS_ORIGINS` | Comma-separated CORS origins | `https://files.example.com` |
| `FILAMAMA_FRONTEND_DIST` | Frontend dist directory | `/app/frontend/dist` |
| `FILAMAMA_AUTH_USER` | Basic Auth username | `admin` |
| `FILAMAMA_AUTH_PASSWORD` | Basic Auth password | `use-a-long-random-password` |
| `FILAMAMA_ALLOW_INSECURE` | Allow network-exposed startup without auth | `true` for local-only development |

## Troubleshooting

If the VPS stack does not start:

```bash
cd /opt/filamama
sudo docker compose ps
sudo docker compose logs -f
```

If Caddy cannot issue a certificate, verify DNS points to the VPS and ports `80` and `443` are open.

If FilaMama exits with an insecure startup error, set both `FILAMAMA_AUTH_USER` and `FILAMAMA_AUTH_PASSWORD`, then restart:

```bash
cd /opt/filamama
sudo docker compose up -d
```

## Security Notes

- Public VPS installs require Basic Auth.
- Caddy handles HTTPS but does not replace FilaMama's Basic Auth requirement.
- Keep `/opt/filamama/.env` private because it contains the Basic Auth password.
- FilaMama validates paths server-side so file operations stay inside the configured root or mount points.
