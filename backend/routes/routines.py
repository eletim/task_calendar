from flask import Blueprint, jsonify, request
import os, json

routines_bp = Blueprint('routines', __name__)

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
DATA_FILE     = os.path.join(BASE_DIR, '..', '..', 'data', 'routines.json')
DEFAULT_FLAGS = [False, False, False]
DEFAULT_VALUE = 0  # 0〜100

# -----------------------
# util
# -----------------------
def ensure_file():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)

def load_all():
    ensure_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            raw = json.load(f)
        except json.JSONDecodeError:
            raw = {}

    # 後方互換：list → {"flags": list, "value":0}
    converted = {}
    for date, v in raw.items():
        if isinstance(v, list):
            converted[date] = {"flags": (v + DEFAULT_FLAGS)[:3], "value": DEFAULT_VALUE}
        elif isinstance(v, dict):
            flags = v.get("flags", DEFAULT_FLAGS)
            value = v.get("value", DEFAULT_VALUE)
            if len(flags) != 3:
                flags = DEFAULT_FLAGS
            converted[date] = {"flags": flags, "value": value}
        else:
            converted[date] = {"flags": DEFAULT_FLAGS, "value": DEFAULT_VALUE}
    return converted

def save_all(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# -----------------------
# API
# -----------------------

@routines_bp.route('/api/routines', methods=['GET'])
def get_routines():
    """全データ取得"""
    return jsonify(load_all())

@routines_bp.route('/api/routines/flags', methods=['POST'])
def update_flags():
    """
    既存の丸トグル用
    payload: { "date": "2025-07-23", "index": -1|0|1|2 }
    """
    body = request.get_json(force=True)
    date = body.get('date')
    idx  = body.get('index')

    if date is None or idx not in (-1, 0, 1, 2):
        return jsonify({'error': 'invalid payload'}), 400

    all_data = load_all()
    rec = all_data.get(date, {"flags": DEFAULT_FLAGS.copy(), "value": DEFAULT_VALUE})
    flags = rec["flags"][:]

    if idx == -1:
        flags = DEFAULT_FLAGS.copy()
    else:
        flags[idx] = not flags[idx]

    rec["flags"] = flags
    all_data[date] = rec
    save_all(all_data)

    return jsonify({'date': date, 'state': flags, 'value': rec['value']})

@routines_bp.route('/api/routines/value', methods=['POST'])
def update_value():
    """
    数値変更用
    payload: { "date": "2025-07-23", "value": 0-100 }
    """
    body  = request.get_json(force=True)
    date  = body.get('date')
    value = body.get('value')

    if date is None or value is None:
        return jsonify({'error': 'invalid payload'}), 400

    try:
        value = int(value)
    except (ValueError, TypeError):
        return jsonify({'error': 'value must be int'}), 400

    if not (0 <= value <= 100):
        return jsonify({'error': 'value must be 0-100'}), 400

    all_data = load_all()
    rec = all_data.get(date, {"flags": DEFAULT_FLAGS.copy(), "value": DEFAULT_VALUE})
    rec["value"] = value
    all_data[date] = rec
    save_all(all_data)

    return jsonify({'date': date, 'value': value, 'state': rec['flags']})
