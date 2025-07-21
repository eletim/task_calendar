from flask import Blueprint, jsonify, request
import os, json

routines_bp = Blueprint('routines', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', 'data', 'routines.json')

DEFAULT_STATE = [False, False, False]

def ensure_file():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)

def load_all():
    ensure_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_all(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@routines_bp.route('/api/routines', methods=['GET'])
def get_routines():
    return jsonify(load_all())

@routines_bp.route('/api/routines', methods=['POST'])
def update_routine():
    body = request.get_json()
    date = body.get('date')
    idx  = body.get('index')
    if date is None or idx not in (-1, 0, 1, 2):
        return jsonify({'error':'invalid payload'}), 400

    all_data = load_all()
    # 既存状態を取得 or デフォルト
    arr = all_data.get(date, DEFAULT_STATE.copy())
    # 常に長さ3に
    if len(arr) != 3:
        arr = DEFAULT_STATE.copy()

    # リセット or トグル
    if idx == -1:
        new_state = DEFAULT_STATE.copy()
    else:
        arr[idx] = not arr[idx]
        new_state = arr

    all_data[date] = new_state
    save_all(all_data)
    return jsonify({ 'date': date, 'state': new_state })
