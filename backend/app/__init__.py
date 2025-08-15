# app/__init__.py
import os
from flask import Flask, send_from_directory
from .config import config_map
from app.routes.tasks import tasks_bp
from app.routes.routines import routines_bp
from app.routes.settings import settings_bp

def create_app(config_name=None):
    # 環境変数 APP_MODE があれば優先、なければ引数、それもなければ 'development'
    cfg = config_name or os.getenv('APP_MODE', 'development')
    app = Flask(
        __name__,
        static_folder='../../frontend/build',
        static_url_path=''
    )
    # 設定読み込み
    app.config.from_object(config_map[cfg])

    # 静的ファイル配信ルート
    @app.route('/static/<path:filename>')
    def static_files(filename):
        return send_from_directory(os.path.join(app.static_folder, 'static'), filename)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_app(path):
        file_path = os.path.join(app.static_folder, path)
        if path and os.path.exists(file_path):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    # Blueprint 登録
    app.register_blueprint(tasks_bp)
    app.register_blueprint(routines_bp)
    app.register_blueprint(settings_bp)

    return app
