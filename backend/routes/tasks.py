from flask import Blueprint, jsonify, request, abort
import os, json

tasks_bp = Blueprint('tasks', __name__)

# JSON ファイルのパス
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', 'data', 'tasks.json')

def ensure_data_file():
    """tasks.json がなければ空のリストを作成しておく"""
    data_dir = os.path.dirname(DATA_FILE)
    os.makedirs(data_dir, exist_ok=True)
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
    if not tasks:
        return 1
    return max(t.get('id', 0) for t in tasks) + 1

@tasks_bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(load_tasks())

@tasks_bp.route('/api/tasks', methods=['POST'])
def add_task():
    new_task = request.get_json()
    if not new_task.get('title') or not new_task.get('date'):
        return jsonify({'error': 'title and date required'}), 400

    tasks = load_tasks()
    new_task['id'] = next_id(tasks)
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@tasks_bp.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    if 'title' not in data and 'date' not in data:
        return jsonify({'error': 'nothing to update'}), 400

    tasks = load_tasks()
    for t in tasks:
        if t.get('id') == task_id:
            # 更新可能なフィールドだけ反映
            if 'title' in data:
                t['title'] = data['title']
            if 'date' in data:
                t['date'] = data['date']
            save_tasks(tasks)
            return jsonify(t)
    abort(404)

@tasks_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_tasks()
    new_tasks = [t for t in tasks if t.get('id') != task_id]
    if len(new_tasks) == len(tasks):
        abort(404)
    save_tasks(new_tasks)
    return '', 204

