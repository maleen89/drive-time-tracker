#!/usr/bin/env bash
set -euo pipefail

APP_USER=dtt
APP_DIR=/opt/drive-time-tracker

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ ! -f /etc/drive-time-tracker.env ]]; then
  echo "Missing /etc/drive-time-tracker.env"
  exit 1
fi

sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npm run build"

# Standalone build layout: static assets must sit beside server.js
rm -rf "$APP_DIR/.next/standalone/public" "$APP_DIR/.next/standalone/.next/static"
mkdir -p "$APP_DIR/.next/standalone/public" "$APP_DIR/.next/standalone/.next"
if [[ -d "$APP_DIR/public" ]]; then
  cp -r "$APP_DIR/public/." "$APP_DIR/.next/standalone/public/"
fi
cp -r "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/.next/standalone"

systemctl restart drive-time-tracker
systemctl --no-pager status drive-time-tracker

echo "Deployed. Tail logs with: journalctl -u drive-time-tracker -f"
