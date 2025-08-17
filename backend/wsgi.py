# backend/wsgi.py
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))  # backend/
ROOT = os.path.dirname(HERE)                        # プロジェクトルート
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.app import create_app

# 本番想定の既定は 'production'（環境変数 APP_MODE で上書き可）
application = create_app(os.getenv('APP_MODE', 'production'))
