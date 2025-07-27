from flask import Blueprint, jsonify, request, abort
import os, json

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')

# JSON ファイルのパス
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'tasks.json')

def ensure_data_file():
    """tasks.json がなければ空のリストを作成しておく"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)

def load_tasks():
    """ファイルを読み込んで Python のリストで返す"""
    ensure_data_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_tasks(tasks):
    """Python のリストを JSON ファイルへ書き込む"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)

def next_id(tasks):
    """既存タスクの最大 id + 1 を返す"""
    return max((t.get('id', 0) for t in tasks), default=0) + 1

@tasks_bp.route('/', methods=['GET'])
def get_tasks():
    """全タスク取得"""
    return jsonify(load_tasks())

@tasks_bp.route('/', methods=['POST'])
def add_task():
    """
    新規タスク作成
    必須：title
    任意：date (YYYY-MM-DD)、done (boolean)
    """
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    tasks = load_tasks()
    new_task = {
        'id':    next_id(tasks),
        'title': title,
        # date フィールドがあればそのまま、なければ None (フロントで振り分け)
        'date':  data.get('date'),
        # done フラグは任意、指定がなければ False
        'done':  bool(data.get('done', False))
    }
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@tasks_bp.route('/<int:task_id>', methods=['PUT', 'PATCH'])
def update_task(task_id):
    """
    タスク更新（部分更新にも対応）
    受け付けるフィールド：title, date, done
     - date = null でカレンダー→リスト移動
     - date = 'YYYY-MM-DD' でリスト→カレンダー移動
    """
    data = request.get_json() or {}
    # 更新対象フィールドが一つもなければエラー
    if not any(k in data for k in ('title', 'date', 'done')):
        return jsonify({'error': 'nothing to update'}), 400

    tasks = load_tasks()
    for t in tasks:
        if t.get('id') == task_id:
            if 'title' in data:
                t['title'] = data['title'].strip() or t['title']
            if 'date' in data:
                # 明示的に null を許容 → JSON では None
                t['date'] = data['date']
            if 'done' in data:
                t['done'] = bool(data['done'])
            save_tasks(tasks)
            return jsonify(t)
    abort(404)

@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """タスク削除"""
    tasks = load_tasks()
    new_tasks = [t for t in tasks if t.get('id') != task_id]
    if len(new_tasks) == len(tasks):
        abort(404)
    save_tasks(new_tasks)
    return '', 204
