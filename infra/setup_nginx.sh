#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <domain>"
  echo "  <domain> → server_name に設定するドメイン名（例: example.jp / localhost）"
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

echo "→ Opening firewall (80/443)…"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp || true
  sudo ufw allow 443/tcp || true
fi

echo "→ Testing nginx configuration..."
sudo nginx -t

echo "→ Reloading nginx..."
sudo systemctl reload nginx

# ---- 分岐：localhost なら自己署名／それ以外は certbot ----
if [[ "$DOMAIN" = "localhost" || "$DOMAIN" = "127.0.0.1" ]]; then
  echo "→ Localhost detected: skipping certbot; generating self-signed TLS"

  CRT="/etc/ssl/certs/localhost.crt"
  KEY="/etc/ssl/private/localhost.key"

  if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
    sudo openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout "$KEY" \
      -out "$CRT" \
      -subj "/CN=localhost"
    echo "  • self-signed cert issued: $CRT / $KEY"
  else
    echo "  • self-signed cert already exists, reusing"
  fi

  # まだ 443 サーバーが無ければ追記
  if ! sudo grep -q "listen 443" "$AVAILABLE"; then
    echo "→ Appending 443 server block to $AVAILABLE"
    sudo tee -a "$AVAILABLE" >/dev/null <<EOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     $CRT;
    ssl_certificate_key $KEY;

    # アプリへのプロキシ
    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_read_timeout 300;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html { root /usr/share/nginx/html; }
}
EOF
  fi

  echo "→ Testing nginx configuration (with TLS)…"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "✅ https://localhost is ready (self-signed; browser will warn)"

else
  echo "→ Ensuring certbot is installed…"
  if ! command -v certbot >/dev/null 2>&1; then
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
  fi

  echo "→ Requesting/auto-configuring HTTPS with Let's Encrypt…"
  sudo certbot --nginx -d "$DOMAIN" --agree-tos -m you@example.com --no-eff-email --redirect

  echo "→ Testing nginx configuration after TLS…"
  sudo nginx -t
  sudo systemctl reload nginx

  echo "→ Testing auto-renewal (dry run)…"
  sudo certbot renew --dry-run

  echo "✅ HTTPS is now configured for $DOMAIN"
fi
