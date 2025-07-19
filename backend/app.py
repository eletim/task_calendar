from flask import Flask, send_from_directory
from routes.tasks import tasks_bp
import os

# build した React 静的ファイルを置くディレクトリを指定
app = Flask(
    __name__,
    static_folder='../frontend/build',    # React のビルド先
    static_url_path=''                 # ルート直下で静的ファイルを公開
)

# まずは静的ファイル（CSS/JS/画像など）を返す
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.static_folder, 'static'), filename)

# それ以外はすべて index.html を返して React Router に任せる
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_app(path):
    # 存在するファイルであればそのまま返す
    file_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    # それ以外はシングルページアプリのエントリへ
    return send_from_directory(app.static_folder, 'index.html')

# Blueprint を登録
app.register_blueprint(tasks_bp)

if __name__ == '__main__':
    # 開発時は以下、運用時は gunicorn 等をご検討ください
    app.run(host='0.0.0.0', port=8000, debug=True)
