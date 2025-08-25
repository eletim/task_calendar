
# setup

### npm

```sh
sudo apt update
sudo apt install npm
cd frontend
npm install
```

### flask

```sh
sudo apt update
sudo apt install -y python3.12-venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install flask gunicorn SQLAlchemy flask_sqlalchemy flask-migrate flask-bcrypt flask-jwt-extended
```

### nginx

```sh
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

```bash
infra/setup_nginx.sh your-domain.com
```

### sqlite3

```sh
sudo apt update
sudo apt install -y sqlite3
```

# build

```sh
cd frontend
npm run build
```

# run 

```sh
cd backend
export DATABASE_URL=sqlite:////home/ubuntu/task_calendar/instance/app.db
# export FLASK_APP=backend.wsgi:application
```

then, 

```sh
# 開発サーバー起動
$ python3 backend/run.py --mode debug

# Gunicorn 経由で起動
$ python3 backend/run.py --mode gunicorn --host 0.0.0.0 --port 8000
```

## ipv6
```sh
python3 backend/run.py --mode gunicorn --host "[::]" --port 8000
```

# ngrok

settings:
```sh
sudo snap install ngrok --classic
ngrok config add-authtoken <YOUR_AUTH_TOKEN>
```

run:
```ss
ngrok http 8000
```

# public domain name

## レコード設定確認

```md
<domain_name> 3600 IN AAAA <global_ipv6>
```

AレコードやAAAAレコードのDOMAIN設定がうまくいっているかは、下記で確認可能。  
正しく行っていれば、設定したglobal ipが帰ってくる  
```sh
dig +short A <your_domain_name>  # output: <your ipv4>
dig +short AAAA <your_domain_name>  # output: <your ipv6>
```

## server

ipv4とipv6両方
```sh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### debug port

```sh
sudo ufw allow 8000/tcp
sudo ufw enable
```

### debug tools

```sh
curl -6 "http://[<your ipv6>]:8000/"
curl -6 "http://[<your domain name>]:8000/"
```



## infra 構成

```sh
task\_calendar/
├── infra
│   ├── nginx
│   │   └── my\_flask\_app.conf.tpl
│   └── setup\_nginx.sh
└── README.md
```


# migration


```sh
python3 -m flask --app 'backend.app:create_app' db init
python3 -m flask --app 'backend.app:create_app' db migrate -m "init tables"
python3 -m flask --app 'backend.app:create_app' db upgrade
```

```sh
flask db migrate -m "mutable json, indexes, unique constraints"
flask db upgrade
```

# TODO

- Task移動の際のUI改善：OptimisticなUseTaskフックの導入
- スマホアプリ化
- その日のメモあってもいい？
- 画像メモがあってもいい？　→過去の参照は必要なのか問題
- 月表示ならタスクの省略表示
