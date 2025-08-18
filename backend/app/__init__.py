# backend/app/__init__.py
import os
import sqlite3
from flask import Flask, send_from_directory, jsonify
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .config import config_map
from .extensions import db, migrate, bcrypt, jwt

# 既存 API Blueprints
from .routes.tasks import tasks_bp
from .routes.routines import routines_bp
from .routes.settings import settings_bp

# 認証 API
from .routes.auth import auth_bp


# --- SQLite の外部キーを有効化（Postgres 等では影響なし） ---
@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


def create_app(config_name=None):
    # 環境変数 APP_MODE があれば優先、なければ引数、それもなければ 'development'
    cfg = config_name or os.getenv('APP_MODE', 'development')

    app = Flask(
        __name__,
        # /static → frontend/build/static を指す
        static_folder='../../frontend/build/static',
        static_url_path='/static'
    )

    # 設定読み込み
    app.config.from_object(config_map[cfg])

    # 拡張初期化
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # --- JWT エラーを JSON に統一 ---
    @jwt.unauthorized_loader
    def _unauthorized(reason):
        return jsonify(error="Unauthorized", detail=reason), 401

    @jwt.invalid_token_loader
    def _invalid_token(reason):
        return jsonify(error="Invalid token", detail=reason), 401

    @jwt.expired_token_loader
    def _expired_token(jwt_header, jwt_payload):
        return jsonify(error="Token expired"), 401

    # --- SPA ルーティング（/login 等は index.html を返す） ---
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_app(path):
        """
        SPA フォールバック:
          1) build 直下（favicon.ico, manifest.json など）はそのまま返す
          2) それ以外は index.html を返し、React Router に委ねる
        """
        build_root = os.path.abspath(os.path.join(app.root_path, '../../frontend/build'))
        candidate = os.path.join(build_root, path)
        if path and os.path.exists(candidate) and not os.path.isdir(candidate):
            return send_from_directory(build_root, path)
        return send_from_directory(build_root, 'index.html')

    # --- Blueprint 登録 ---
    # ※ auth_bp 側で url_prefix を付けていない前提。
    #   もし auth_bp が既に url_prefix='/api/auth' なら、下の url_prefix は削除してください。
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(tasks_bp)
    app.register_blueprint(routines_bp)
    app.register_blueprint(settings_bp)

    return app
