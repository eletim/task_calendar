# backend/run.py
import os
import sys
import click

# プロジェクトルートを import path に追加（backend/ からの実行でも動くように）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.app import create_app  # ← ここが重要（旧: from app import create_app）

@click.command()
@click.option('--mode', type=click.Choice(['debug','gunicorn']), default='debug',
              help='起動モード: debug または gunicorn')
@click.option('--host', default='0.0.0.0', help='バインドするホスト')
@click.option('--port', default=8000, help='バインドするポート')
def main(mode, host, port):
    """
    起動例:
      # 開発サーバー
      python backend/run.py --mode debug

      # Gunicorn 経由で起動
      python backend/run.py --mode gunicorn --host 0.0.0.0 --port 8000
    """
    if mode == 'debug':
        app = create_app(os.getenv('APP_MODE', 'development'))
        app.run(host=host, port=port, debug=True)
    else:
        # Gunicorn モード: backend.wsgi:application を起点にする
        os.execvp('gunicorn', [
            'gunicorn',
            '--bind', f'{host}:{port}',
            'backend.wsgi:application'
        ])

if __name__ == '__main__':
    main()
