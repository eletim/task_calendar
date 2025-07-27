# run.py
import os
import click
from app import create_app

@click.command()
@click.option('--mode', type=click.Choice(['debug','gunicorn']), default='debug',
              help='起動モード: debug または gunicorn')
@click.option('--host', default='0.0.0.0', help='バインドするホスト')
@click.option('--port', default=8000, help='バインドするポート')
def main(mode, host, port):
    """
    起動例:
      # 開発サーバー
      python run.py --mode debug

      # Gunicorn 経由で起動
      python run.py --mode gunicorn --host 0.0.0.0 --port 8000
    """
    if mode == 'debug':
        app = create_app('development')
        app.run(host=host, port=port, debug=True)
    else:
        # Gunicorn モード: プロセス置き換え
        os.execvp('gunicorn', [
            'gunicorn',
            '--bind', f'{host}:{port}',
            'wsgi:application'
        ])

if __name__ == '__main__':
    main()
