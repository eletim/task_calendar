from flask import Blueprint, jsonify, request
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
        return json.load(f)

def save_tasks(tasks):
    """Python のリストを JSON ファイルへ書き込む"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)

@tasks_bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = load_tasks()
    return jsonify(tasks)

@tasks_bp.route('/api/tasks', methods=['POST'])
def add_task():
    new_task = request.get_json()
    tasks = load_tasks()
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@tasks_bp.route('/api/tasks', methods=['PUT'])
def update_tasks():
    tasks_list = request.get_json()
    save_tasks(tasks_list)
    return jsonify(tasks_list)
