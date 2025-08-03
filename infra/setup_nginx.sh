#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <domain>"
  echo "  <domain> → server_name に設定するドメイン名（例: example.jp）"
  exit 1
}

if [ $# -ne 1 ]; then
  usage
fi

DOMAIN=$1

# this script’s directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/nginx"
TEMPLATE_FILE="$TEMPLATE_DIR/my_flask_app.conf.tpl"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: template not found: $TEMPLATE_FILE"
  exit 1
fi

AVAILABLE="/etc/nginx/sites-available/$DOMAIN.conf"
ENABLED="/etc/nginx/sites-enabled/$DOMAIN.conf"

echo "→ Generating nginx config for domain: $DOMAIN"

# substitute ${DOMAIN} in template
TMPFILE=$(mktemp)
export DOMAIN
envsubst '${DOMAIN}' < "$TEMPLATE_FILE" > "$TMPFILE"

sudo mv "$TMPFILE" "$AVAILABLE"
echo "  • moved to $AVAILABLE"

# remove old symlink if exists
if [ -L "$ENABLED" ] || [ -e "$ENABLED" ]; then
  sudo rm -f "$ENABLED"
  echo "  • removed old symlink $ENABLED"
fi

sudo ln -s "$AVAILABLE" "$ENABLED"
echo "  • linked to $ENABLED"

echo "→ Testing nginx configuration..."
sudo nginx -t

echo "→ Reloading nginx..."
sudo systemctl reload nginx

echo "✅ nginx is now configured for $DOMAIN"
