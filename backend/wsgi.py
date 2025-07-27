# wsgi.py
import os
from app import create_app

# 環境変数 APP_MODE=production|development に応じて生成
mode = os.getenv('APP_MODE', 'production')
application = create_app(mode)

# Gunicorn からは以下で起動:
#   APP_MODE=production gunicorn wsgi:application -b 0.0.0.0:8000
