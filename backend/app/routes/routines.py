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

DEFAULT_FLAGS_LEN   = 3
DEFAULT_IFTHEN_LEN  = 3
DEFAULT_VALUE       = 0  # 0..100


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
    - list だけが入っている古い形式は flags として扱い、value=DEFAULT_VALUE, if_then_rules=既定長
    - dict の場合、各フィールドが無ければ既定値を "レスポンス上だけ" 付与（保存はしない）
    """
    if isinstance(rec, list):
        return {
            "flags": to_bool_list(rec) or make_bools(DEFAULT_FLAGS_LEN),
            "if_then_rules": make_bools(DEFAULT_IFTHEN_LEN),
            "value": DEFAULT_VALUE,
        }
    if isinstance(rec, dict):
        flags = to_bool_list(rec.get("flags"))
        if_then_rules = to_bool_list(rec.get("if_then_rules"))
        value = rec.get("value", DEFAULT_VALUE)
        return {
            "flags": flags if flags is not None else make_bools(DEFAULT_FLAGS_LEN),
            "if_then_rules": if_then_rules if if_then_rules is not None else make_bools(DEFAULT_IFTHEN_LEN),
            "value": value,
        }
    # それ以外の型は空として扱う
    return {
        "flags": make_bools(DEFAULT_FLAGS_LEN),
        "if_then_rules": make_bools(DEFAULT_IFTHEN_LEN),
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
    flags の可変長トグル。
    payload: { "date": "YYYY-MM-DD", "index": -1|0|1|... }
      - index == -1: 現在長で全 False（長さ0なら既定長で生成）
      - index >= 0 : 範囲外なら False でパディングしてからトグル
    ※ このエンドポイントでは if_then_rules は保存上は触らない（レスポンスでは既定値を付与）。
    """
    body = request.get_json(force=True)
    date = body.get('date')
    idx = body.get('index')

    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error': 'invalid payload'}), 400

    all_data = load_raw()
    rec = all_data.get(date)

    # 後方互換：古い list は flags とみなして dict 化
    if rec is None:
        rec = {"flags": make_bools(DEFAULT_FLAGS_LEN), "value": DEFAULT_VALUE}
    elif isinstance(rec, list):
        rec = {"flags": to_bool_list(rec) or make_bools(DEFAULT_FLAGS_LEN), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {"flags": make_bools(DEFAULT_FLAGS_LEN), "value": DEFAULT_VALUE}

    flags = to_bool_list(rec.get("flags")) or []
    if idx == -1:
        flags = make_bools(len(flags) if len(flags) > 0 else DEFAULT_FLAGS_LEN)
    else:
        if idx >= len(flags):
            flags.extend([False] * (idx + 1 - len(flags)))
        flags[idx] = not flags[idx]

    rec["flags"] = flags
    # ここでは if_then_rules を新規保存しない（過去データは無変更ポリシー）
    all_data[date] = rec
    save_all(all_data)

    # レスポンスでは正規化を返す（保存はしない）
    resp_norm = normalize_for_response(rec)
    return jsonify({
        "date": date,
        "state": resp_norm["flags"],         # 既存互換
        "value": resp_norm["value"],
        "if_then_rules": resp_norm["if_then_rules"]
    })


@routines_bp.route('/api/routines/if_then_rules', methods=['POST'])
def update_if_then_rules():
    """
    if_then_rules の可変長トグル。
    payload: { "date": "YYYY-MM-DD", "index": -1|0|1|... }
      - index == -1: 現在長で全 False（長さ0なら既定長で生成）
      - index >= 0 : 範囲外なら False でパディングしてからトグル
    ※ このエンドポイントは 'if_then_rules' フィールドをファイルに保存する（明示操作）。
    """
    body = request.get_json(force=True)
    date = body.get('date')
    idx = body.get('index')

    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error': 'invalid payload'}), 400

    all_data = load_raw()
    rec = all_data.get(date)

    # 後方互換（list → dict 化）は必要最小限に留める
    if rec is None:
        rec = {"value": DEFAULT_VALUE}
    if isinstance(rec, list):
        rec = {"flags": to_bool_list(rec) or make_bools(DEFAULT_FLAGS_LEN), "value": DEFAULT_VALUE}
    if not isinstance(rec, dict):
        rec = {"value": DEFAULT_VALUE}

    arr = to_bool_list(rec.get("if_then_rules")) or []
    if idx == -1:
        arr = make_bools(len(arr) if len(arr) > 0 else DEFAULT_IFTHEN_LEN)
    else:
        if idx >= len(arr):
            arr.extend([False] * (idx + 1 - len(arr)))
        arr[idx] = not arr[idx]

    rec["if_then_rules"] = arr
    # flags はこのAPIでは触らない（存在すれば維持、無ければそのまま）
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


@routines_bp.route('/api/routines/value', methods=['POST'])
def update_value():
    """
    数値変更用
    payload: { "date": "YYYY-MM-DD", "value": 0..100 }
    ※ このエンドポイントでは if_then_rules を新規保存しない（過去データは無変更ポリシー）。
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
        rec = {"flags": to_bool_list(rec) or make_bools(DEFAULT_FLAGS_LEN), "value": DEFAULT_VALUE}
    elif not isinstance(rec, dict):
        rec = {}

    rec["value"] = value
    # if_then_rules はこのAPIでは追加保存しない
    all_data[date] = rec
    save_all(all_data)

    resp_norm = normalize_for_response(rec)
    return jsonify({
        "date": date,
        "value": resp_norm["value"],
        "state": resp_norm["flags"],
        "if_then_rules": resp_norm["if_then_rules"]
    })
