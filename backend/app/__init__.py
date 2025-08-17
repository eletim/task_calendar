# app/__init__.py
import os
from flask import Flask, send_from_directory
from .config import config_map

# ← 追加: 拡張の初期化を集約
from .extensions import db, migrate, bcrypt, jwt

# 既存のAPI
from .routes.tasks import tasks_bp
from .routes.routines import routines_bp
from .routes.settings import settings_bp

# ← 追加: 認証API
from .routes.auth import auth_bp


def create_app(config_name=None):
    # 環境変数 APP_MODE があれば優先、なければ引数、それもなければ 'development'
    cfg = config_name or os.getenv('APP_MODE', 'development')

    app = Flask(
        __name__,
        static_folder='../../frontend/build/static',
        static_url_path='/static'
    )

    # 設定読み込み
    app.config.from_object(config_map[cfg])

    # --- 追加: 拡張の初期化 ---
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_app(path):
      """
      SPA ルーティング用フォールバック：
        1) build 直下（favicon.ico, manifest.json など）はそのまま返す
        2) それ以外は index.html を返して React Router に任せる
      """
      build_root = os.path.abspath(os.path.join(app.root_path, '../../frontend/build'))
      # 直下ファイル（例: /favicon.ico, /asset-manifest.json, /robots.txt など）
      candidate = os.path.join(build_root, path)
      if path and os.path.exists(candidate) and not os.path.isdir(candidate):
          return send_from_directory(build_root, path)
      # それ以外は index.html
      return send_from_directory(build_root, 'index.html')

    # Blueprint 登録
    app.register_blueprint(auth_bp, url_prefix='/api/auth')  # ← 追加
    app.register_blueprint(tasks_bp)
    app.register_blueprint(routines_bp)
    app.register_blueprint(settings_bp)

    return app
