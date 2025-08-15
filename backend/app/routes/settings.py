# backend/settings.py など（元の settings_bp を定義していたファイル）
from flask import Blueprint, jsonify, request
import os
import json

# Blueprint for calendar settings
settings_bp = Blueprint('settings', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'settings.json')

# --- 変更点 ---
# 1) デフォルト構造を要求どおりに更新（if_then_rules.length を 1 に）
# 2) display を正式採用（元から存在） / show は廃止
DEFAULT_SETTINGS = {
    "theme": "default",  # "default" | "dark" | "light"
    "routine": {
        "value": {
            "display": True,
            "description": ""
        },
        "flags": {
            "display": True,
            "length": 3,
            "description": ""
        },
        "if_then_rules": {
            "display": True,
            "length": 1,   # ★ デフォルトを 1 に変更
            "description": ""
        }
    }
}


def ensure_file():
    """Create the settings file and its directories if they do not exist."""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_SETTINGS, f, ensure_ascii=False, indent=2)


def _deepcopy(obj):
    return json.loads(json.dumps(obj))


def _merge_defaults(default, current):
    """
    default をベースに current の値を優先して再帰的にマージ。
    current に余計なキーがあればそれも残す（後方互換のため）。
    """
    result = {}
    for key, def_val in default.items():
        if key in current:
            cur_val = current[key]
            if isinstance(def_val, dict) and isinstance(cur_val, dict):
                result[key] = _merge_defaults(def_val, cur_val)
            else:
                result[key] = cur_val
        else:
            result[key] = _deepcopy(def_val) if isinstance(def_val, dict) else def_val
    # current 側の追加キーも維持
    for key, val in current.items():
        if key not in result:
            result[key] = val
    return result


def _migrate_legacy_keys(data):
    """
    既存ファイルに残っている廃止キー 'show' を 'display' に移行し、'show' を削除。
    必要に応じて型の正規化も行う。
    """
    if not isinstance(data, dict):
        return data

    routine = data.get("routine")
    if isinstance(routine, dict):
        # if_then_rules の show -> display
        itr = routine.get("if_then_rules")
        if isinstance(itr, dict):
            # show を display に移行（display が未指定なら show の値を使う）
            if "show" in itr and "display" not in itr:
                itr["display"] = bool(itr["show"])
            itr.pop("show", None)

        # flags / value 側は特に移行不要だが、念のため display を bool 正規化
        flg = routine.get("flags")
        if isinstance(flg, dict) and "display" in flg:
            flg["display"] = bool(flg["display"])
        val = routine.get("value")
        if isinstance(val, dict) and "display" in val:
            val["display"] = bool(val["display"])

    return data


def _normalize_types(data):
    """
    値の型を正規化する（length は int、display は bool、theme は既知値に丸めるなど）
    """
    if not isinstance(data, dict):
        return data

    # theme
    theme = data.get("theme")
    if theme not in ("default", "dark", "light"):
        data["theme"] = "default"

    routine = data.get("routine")
    if isinstance(routine, dict):
        # value.display
        value = routine.get("value")
        if isinstance(value, dict):
            value["display"] = bool(value.get("display", True))
            # description は文字列化
            desc = value.get("description", "")
            value["description"] = str(desc) if desc is not None else ""

        # flags
        flags = routine.get("flags")
        if isinstance(flags, dict):
            flags["display"] = bool(flags.get("display", True))
            # length
            try:
                length = int(flags.get("length", 3))
            except Exception:
                length = 3
            # 極端な値のガード（必要なら調整）
            if length < 0: length = 0
            if length > 12: length = 12
            flags["length"] = length
            # description
            desc = flags.get("description", "")
            flags["description"] = str(desc) if desc is not None else ""

        # if_then_rules
        itr = routine.get("if_then_rules")
        if isinstance(itr, dict):
            itr["display"] = bool(itr.get("display", True))
            # length
            try:
                length = int(itr.get("length", 1))
            except Exception:
                length = 1
            if length < 0: length = 0
            if length > 12: length = 12
            itr["length"] = length
            # description
            desc = itr.get("description", "")
            itr["description"] = str(desc) if desc is not None else ""

    return data


def load_settings():
    """JSON を読み込み、デフォルト補完 → レガシー移行 → 型正規化して返す。"""
    ensure_file()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return _deepcopy(DEFAULT_SETTINGS)

        merged = _merge_defaults(DEFAULT_SETTINGS, raw)
        migrated = _migrate_legacy_keys(merged)
        normalized = _normalize_types(migrated)
        return normalized
    except Exception:
        return _deepcopy(DEFAULT_SETTINGS)


def save_settings(data):
    """保存前に最終正規化してから保存。"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    data = _normalize_types(_migrate_legacy_keys(_merge_defaults(DEFAULT_SETTINGS, data)))
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(load_settings())


@settings_bp.route('/api/settings', methods=['POST', 'PUT'])  # ← PUT も受けられるように
def update_settings():
    """
    受け取った JSON を現在設定にマージ。'show' が来ても display に移行して保存。
    例:
      {
        "theme": "dark",
        "routine": {
          "value": { "display": true },
          "flags": { "length": 4, "display": false },
          "if_then_rules": { "length": 2, "display": true }
        }
      }
    """
    body = request.get_json(force=True) or {}
    if not isinstance(body, dict):
        return jsonify({'error': 'Invalid payload format'}), 400

    current = load_settings()

    def recursive_update(original, updates):
        for key, val in updates.items():
            if isinstance(val, dict) and isinstance(original.get(key), dict):
                original[key] = recursive_update(original[key], val)
            else:
                original[key] = val
        return original

    updated = recursive_update(_deepcopy(current), body)
    # レガシー -> 正規化 -> 保存
    save_settings(updated)
    return jsonify(load_settings())
