# infra/nginx/my_flask_app.conf.tpl

upstream my_flask_app {
    server 127.0.0.1:8000;
}

server {
    listen 80;            # IPv4
    listen [::]:80;       # IPv6
    server_name ${DOMAIN};

    location / {
        proxy_pass         http://my_flask_app;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
