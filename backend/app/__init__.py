# backend/app/__init__.py
import os
import sqlite3
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
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

from dotenv import load_dotenv
load_dotenv()  # .env を自動で読み込み

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

    def env_bool(name, default=False):
        return str(os.getenv(name, str(int(default)))).lower() in ("1","true","yes","on")

    # 秘密鍵は環境変数があればそれを、なければ既存設定/フォールバック
    app.config["SECRET_KEY"]       = os.getenv("SECRET_KEY", app.config.get("SECRET_KEY", "change-me"))
    app.config["JWT_SECRET_KEY"]   = os.getenv("JWT_SECRET_KEY", app.config.get("JWT_SECRET_KEY", "change-me"))

    # クッキー運用へ切り替え（デフォはheadersのことが多い）
    app.config["JWT_TOKEN_LOCATION"]     = ["cookies"]
    app.config["JWT_COOKIE_SECURE"]      = env_bool("JWT_COOKIE_SECURE", False)   # HTTPの間は False、HTTPS化したら True
    app.config["JWT_COOKIE_SAMESITE"]    = os.getenv("JWT_COOKIE_SAMESITE", "Lax")# 跨ぐなら "None"（※HTTPS必須）
    app.config["JWT_COOKIE_CSRF_PROTECT"]= env_bool("JWT_COOKIE_CSRF_PROTECT", False)  # 切り分け中 False。本番は True 推奨
    if os.getenv("JWT_COOKIE_DOMAIN"):
        app.config["JWT_COOKIE_DOMAIN"]  = os.getenv("JWT_COOKIE_DOMAIN")

    # 拡張初期化
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    @app.teardown_request
    def _teardown_request(exc):
        if exc:
            db.session.rollback()
        db.session.remove()

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

    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://eletim.jp",        # 本番Web
                "capacitor://localhost",    # Capacitor 同梱
                "http://localhost",         # ローカル開発（必要なら）
                "http://127.0.0.1"          # ローカル開発（必要なら）
            ],
            "supports_credentials": True,   # Cookie を送受信できるように
            "methods": ["GET","POST","PATCH","DELETE","OPTIONS"],
            "allow_headers": ["Content-Type","X-CSRF-TOKEN","Authorization"]
        }
    })

    return app
