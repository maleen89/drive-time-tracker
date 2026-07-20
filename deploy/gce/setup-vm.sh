#!/usr/bin/env bash
set -euo pipefail

# Run on a fresh Debian/Ubuntu e2-micro VM as root (or with sudo).
# Example: curl -fsSL ... | bash   OR   sudo bash deploy/gce/setup-vm.sh

APP_USER=dtt
APP_DIR=/opt/drive-time-tracker
DATA_DIR=/var/lib/drive-time-tracker/data
REPO_URL="${REPO_URL:-https://github.com/maleen89/drive-time-tracker.git}"
DOMAIN="${DOMAIN:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl git ca-certificates gnupg sqlite3

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi

if [[ ! -f /etc/drive-time-tracker.env ]]; then
  cp "$APP_DIR/deploy/gce/env.example" /etc/drive-time-tracker.env
  chmod 600 /etc/drive-time-tracker.env
  echo ""
  echo "Created /etc/drive-time-tracker.env — edit secrets before continuing."
fi

if [[ -n "$DOMAIN" ]]; then
  sed "s/YOUR_DOMAIN/$DOMAIN/g" "$APP_DIR/deploy/gce/Caddyfile.example" > /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl restart caddy
fi

cp "$APP_DIR/deploy/gce/drive-time-tracker.service" /etc/systemd/system/drive-time-tracker.service
systemctl daemon-reload
systemctl enable drive-time-tracker

echo ""
echo "Next steps:"
echo "  1. Edit /etc/drive-time-tracker.env"
echo "  2. Set DOMAIN and configure /etc/caddy/Caddyfile if not done"
echo "  3. Run: sudo bash $APP_DIR/deploy/gce/update-app.sh"
echo "  4. Open firewall: allow tcp:443 (and tcp:80 for HTTPS redirect)"
