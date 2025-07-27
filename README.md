

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

# TODO

- if then ルール
- Taskの色の変更
- 右クリックで変更できるようにする
- Task移動の際のUI改善：OptimisticなUseTaskフックの導入
