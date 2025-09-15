server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Let's Encrypt http-01 用
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    # /calendar → /calendar/ に揃える（ディレクトリURLに統一）
    location = /calendar { return 301 /calendar/; }

    # /calendar/ 以下をアプリ(:8000)へ
    location /calendar/ {
        # ← 末尾スラッシュ付きで“剥がす”
        #    /calendar/foo → backend には /foo として渡る
        proxy_pass http://127.0.0.1:8000/;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket使う場合の定型
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # （任意）アプリにプレフィックスを伝えたい場合
        # proxy_set_header X-Forwarded-Prefix /calendar;
    }

    # ルートは別物として扱う（必要なら別のサイトや静的配信に）
    location = / { return 302 /calendar/; }  # 任意。トップをcalendarへ飛ばす例

    error_page 500 502 503 504 /50x.html;
    location = /50x.html { root /usr/share/nginx/html; }
}
