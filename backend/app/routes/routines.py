# backend/app/routes/routines.py
from flask import Blueprint, jsonify, request
import os
import json

routines_bp = Blueprint('routines', __name__)

# -----------------------
# Config
# -----------------------
BASE_DIR            = os.path.dirname(os.path.abspath(__file__))
DATA_FILE           = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'routines.json')
SETTINGS_FILE       = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'settings.json')

DEFAULT_FLAGS_LEN   = 3
DEFAULT_IFTHEN_LEN  = 3
DEFAULT_VALUE       = 0  # 0..100


# -----------------------
# Settings Utils
# -----------------------
def load_settings():
    """設定ファイルから現在の設定を読み込む"""
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        return data
    except:
        return {}

def get_current_limits():
    """現在の設定から最大長を取得"""
    settings = load_settings()
    routine = settings.get('routine', {})
    
    flags_config = routine.get('flags', {})
    ifthen_config = routine.get('if_then_rules', {})
    
    flags_len = flags_config.get('length', DEFAULT_FLAGS_LEN)
    ifthen_len = ifthen_config.get('length', DEFAULT_IFTHEN_LEN)
    
    # 数値として有効な値のみ使用
    try:
        flags_len = int(flags_len)
        if flags_len <= 0:
            flags_len = DEFAULT_FLAGS_LEN
    except:
        flags_len = DEFAULT_FLAGS_LEN
    
    try:
        ifthen_len = int(ifthen_len)
        if ifthen_len <= 0:
            ifthen_len = DEFAULT_IFTHEN_LEN
    except:
        ifthen_len = DEFAULT_IFTHEN_LEN
    
    return flags_len, ifthen_len


# -----------------------
# Utils
# -----------------------
def ensure_file():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)


def load_raw():
    """ファイルの中身をそのまま返す（後方互換の正規化はしない）。"""
    ensure_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            if not isinstance(data, dict):
                return {}
            return data
        except json.JSONDecodeError:
            return {}


def save_all(data: dict):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def make_bools(n: int):
    try:
        n = int(n)
    except Exception:
        n = 0
    return [False] * max(0, n)


def to_bool_list(x):
    if not isinstance(x, list):
        return None
    return [bool(v) for v in x]


def normalize_for_response(rec):
    """
    レスポンス用に後方互換で正規化する。
    既存データの配列長は保持し、新規データのみ設定長を使用。
    """
    max_flags_len, max_ifthen_len = get_current_limits()
    
    if isinstance(rec, list):
        # 古い形式：listはflagsとして扱い、既存の長さを保持
        flags = to_bool_list(rec) or make_bools(max_flags_len)
        return {
            "flags": flags,
            "if_then_rules": make_bools(max_ifthen_len),
            "value": DEFAULT_VALUE,
        }
    
    if isinstance(rec, dict):
        flags = to_bool_list(rec.get("flags"))
        if_then_rules = to_bool_list(rec.get("if_then_rules"))
        value = rec.get("value", DEFAULT_VALUE)
        
        # 既存データがあればそのまま、なければ設定長で作成
        if flags is None:
            flags = make_bools(max_flags_len)
        if if_then_rules is None:
            if_then_rules = make_bools(max_ifthen_len)
        
        return {
            "flags": flags,
            "if_then_rules": if_then_rules,
            "value": value,
        }
    
    # それ以外の型は空として扱う（設定長で新規作成）
    return {
        "flags": make_bools(max_flags_len),
        "if_then_rules": make_bools(max_ifthen_len),
        "value": DEFAULT_VALUE,
    }


# -----------------------
# API
# -----------------------
@routines_bp.route('/api/routines', methods=['GET'])
def get_routines():
    """
    全データ取得（レスポンス時のみ正規化。ファイルは書き換えない）
    返却例:
    {
      "2025-08-09": {
        "flags": [true, false, true, false],
        "if_then_rules": [false, false],
        "value": 40
      }
    }
    """
    raw = load_raw()
    out = {}
    for date, rec in raw.items():
        out[date] = normalize_for_response(rec)
    return jsonify(out)


@routines_bp.route('/api/routines/flags', methods=['POST'])
def update_flags():
    """
    flags の制限付きトグル。
    payload: { "date": "YYYY-MM-DD", "index": -1|0|1|... }
      - index == -1: 既存長で全 False（既存データなしなら設定長）
      - index >= 0 : 既存データの範囲を超える場合のみ設定長制限を適用
    """
    body = request.get_json(force=True)
    date = body.get('date')
    idx = body.get('index')

    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error': 'invalid payload'}), 400

    max_flags_len, _ = get_current_limits()

    all_data = load_raw()
    rec = all_data.get(date)

    # 後方互換：古い list は flags とみなして dict 化
    if rec is None:
        rec = {"flags": make_bools(max_flags_len), "value": DEFAULT_VALUE}
    elif isinstance(rec, list):
        rec = {"flags": to_bool_list(rec) or make_bools(max_flags_len), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {"flags": make_bools(max_flags_len), "value": DEFAULT_VALUE}

    flags = to_bool_list(rec.get("flags")) or []
    
    if idx == -1:
        # 全クリア：既存の長さを保持（既存データなしなら設定長）
        current_len = len(flags) if len(flags) > 0 else max_flags_len
        flags = make_bools(current_len)
    else:
        # 既存データの範囲内なら拡張
        if idx >= len(flags):
            # 設定長を超える拡張は制限
            if idx >= max_flags_len:
                return jsonify({'error': f'Index {idx} exceeds maximum length {max_flags_len}'}), 400
            flags.extend([False] * (idx + 1 - len(flags)))
        flags[idx] = not flags[idx]

    rec["flags"] = flags
    all_data[date] = rec
    save_all(all_data)

    # レスポンスでは正規化を返す
    resp_norm = normalize_for_response(rec)
    return jsonify({
        "date": date,
        "state": resp_norm["flags"],         # 既存互換
        "value": resp_norm["value"],
        "if_then_rules": resp_norm["if_then_rules"]
    })

@routines_bp.route('/api/routines/flags', methods=['PUT'])
def put_flags():
    body = request.get_json(force=True)
    date = body.get('date')
    arr  = to_bool_list(body.get('flags'))

    if not isinstance(date, str) or arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    max_flags_len, _ = get_current_limits()
    if len(arr) > max_flags_len:
        return jsonify({'error': f'flags length exceeds maximum {max_flags_len}'}), 400

    all_data = load_raw()
    rec = all_data.get(date)

    # list→dict 化（最小限）
    if rec is None:
        rec = {}
    elif isinstance(rec, list):
        rec = {"flags": to_bool_list(rec) or make_bools(max_flags_len), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {}

    # 保存は受け取った配列のまま（長さ不足はそのまま）
    rec["flags"] = arr
    all_data[date] = rec
    save_all(all_data)

    resp = normalize_for_response(rec)  # 表示は既定長拡張
    return jsonify({
        "date": date,
        "state": resp["flags"],            # 既存互換キー
        "if_then_rules": resp["if_then_rules"],
        "value": resp["value"]
    })

@routines_bp.route('/api/routines/if_then_rules', methods=['POST'])
def update_if_then_rules():
    """
    if_then_rules の制限付きトグル。
    payload: { "date": "YYYY-MM-DD", "index": -1|0|1|... }
      - index == -1: 既存長で全 False（既存データなしなら設定長）
      - index >= 0 : 既存データの範囲を超える場合のみ設定長制限を適用
    """
    body = request.get_json(force=True)
    date = body.get('date')
    idx = body.get('index')

    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error': 'invalid payload'}), 400

    _, max_ifthen_len = get_current_limits()

    all_data = load_raw()
    rec = all_data.get(date)

    # 後方互換（list → dict 化）は必要最小限に留める
    if rec is None:
        rec = {"value": DEFAULT_VALUE}
    if isinstance(rec, list):
        max_flags_len, _ = get_current_limits()
        rec = {"flags": to_bool_list(rec) or make_bools(max_flags_len), "value": DEFAULT_VALUE}
    if not isinstance(rec, dict):
        rec = {"value": DEFAULT_VALUE}

    arr = to_bool_list(rec.get("if_then_rules")) or []
    
    if idx == -1:
        # 全クリア：既存の長さを保持（既存データなしなら設定長）
        current_len = len(arr) if len(arr) > 0 else max_ifthen_len
        arr = make_bools(current_len)
    else:
        # 既存データの範囲内なら拡張
        if idx >= len(arr):
            # 設定長を超える拡張は制限
            if idx >= max_ifthen_len:
                return jsonify({'error': f'Index {idx} exceeds maximum length {max_ifthen_len}'}), 400
            arr.extend([False] * (idx + 1 - len(arr)))
        arr[idx] = not arr[idx]

    rec["if_then_rules"] = arr
    all_data[date] = rec
    save_all(all_data)

    # レスポンスは正規化
    resp_norm = normalize_for_response(rec)
    return jsonify({
        "date": date,
        "if_then_rules": resp_norm["if_then_rules"],
        "value": resp_norm["value"],
        "state": resp_norm["flags"]  # 既存互換
    })

@routines_bp.route('/api/routines/if_then_rules', methods=['PUT'])
def put_if_then_rules():
    body = request.get_json(force=True)
    date = body.get('date')
    arr  = to_bool_list(body.get('if_then_rules'))

    if not isinstance(date, str) or arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    _, max_ifthen_len = get_current_limits()
    if len(arr) > max_ifthen_len:
        return jsonify({'error': f'if_then_rules length exceeds maximum {max_ifthen_len}'}), 400

    all_data = load_raw()
    rec = all_data.get(date)

    # list → dict 化（必要最小限）
    if rec is None:
        rec = {}
    elif isinstance(rec, list):
        max_flags_len, _ = get_current_limits()
        rec = {"flags": to_bool_list(rec) or make_bools(max_flags_len), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {}

    # 受け取った配列をそのまま保存（短いままでもOK）
    rec["if_then_rules"] = arr
    all_data[date] = rec
    save_all(all_data)

    resp = normalize_for_response(rec)  # 表示は既定長に拡張
    return jsonify({
        "date": date,
        "if_then_rules": resp["if_then_rules"],
        "value": resp["value"],
        "state": resp["flags"]  # 既存互換
    })

@routines_bp.route('/api/routines/value', methods=['POST'])
def update_value():
    """
    数値変更用
    payload: { "date": "YYYY-MM-DD", "value": 0..100 }
    """
    body = request.get_json(force=True)
    date = body.get('date')
    value = body.get('value')

    if not isinstance(date, str) or value is None:
        return jsonify({'error': 'invalid payload'}), 400

    try:
        value = int(value)
    except (ValueError, TypeError):
        return jsonify({'error': 'value must be int'}), 400

    if not (0 <= value <= 100):
        return jsonify({'error': 'value must be 0-100'}), 400

    all_data = load_raw()
    rec = all_data.get(date)

    # list → dict 化は必要最小限
    if rec is None:
        rec = {}
    elif isinstance(rec, list):
        max_flags_len, _ = get_current_limits()
        rec = {"flags": to_bool_list(rec) or make_bools(max_flags_len), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {}

    rec["value"] = value
    all_data[date] = rec
    save_all(all_data)

    resp_norm = normalize_for_response(rec)
    return jsonify({
        "date": date,
        "value": resp_norm["value"],
        "state": resp_norm["flags"],
        "if_then_rules": resp_norm["if_then_rules"]
    })
