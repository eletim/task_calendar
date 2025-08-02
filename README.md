

# build

```sh
cd frontend
npm run build
```

# run 

```sh
cd backend
```

then, 

```sh
# 開発サーバー起動
$ python3 run.py --mode debug

# Gunicorn 経由で起動
$ python3 run.py --mode gunicorn --host 0.0.0.0 --port 8000
```

## ipv6
```sh
python3 run.py --mode gunicorn --host "[::]" --port 8000
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
dig +short A eletim.jp  # output: <your ipv4>
dig +short AAAA eletim.jp  # output: <your ipv6>
```

## server

```sh
sudo ufw allow proto tcp to any port 80,443 from ::/0
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


# TODO

- if then ルール
- 右クリックで変更できるようにする
- Task移動の際のUI改善：OptimisticなUseTaskフックの導入
- nginx
- TODOリスト内で優先度設定
- スマホアプリ化
- その日のメモあってもいい？
- パスワード設定、データベース
