from flask import Blueprint, jsonify, request
import os, json

tasks_bp = Blueprint('tasks', __name__)

# JSON ファイルのパス
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', 'data', 'tasks.json')

@tasks_bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        tasks = json.load(f)
    return jsonify(tasks)

@tasks_bp.route('/api/tasks', methods=['POST'])
def add_task():
    new_task = request.get_json()
    with open(DATA_FILE, 'r+', encoding='utf-8') as f:
        tasks = json.load(f)
        tasks.append(new_task)
        f.seek(0)
        json.dump(tasks, f, ensure_ascii=False, indent=2)
        f.truncate()
    return jsonify(new_task), 201

@tasks_bp.route('/api/tasks', methods=['PUT'])
def update_tasks():
    tasks_list = request.get_json()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(tasks_list, f, ensure_ascii=False, indent=2)
    return jsonify(tasks_list)