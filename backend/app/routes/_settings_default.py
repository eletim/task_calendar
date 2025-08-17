# backend/app/routes/_settings_default.py
import json

# --- デフォルト設定（あなたの要件どおり） ---
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
            "length": 1,   # ★ デフォルトを 1
            "description": ""
        }
    }
}

def _deepcopy(obj):
    return json.loads(json.dumps(obj))

def merge_defaults(default: dict, current: dict) -> dict:
    """
    default を下敷きに current を優先で再帰マージ。
    current 側の余分キーは維持（後方互換）。
    """
    if not isinstance(default, dict) or not isinstance(current, dict):
        return _deepcopy(default) if current is None else current

    result = {}
    # 既知キー: defaultをベースにcurrentを優先
    for k, dv in default.items():
        if k in current:
            cv = current[k]
            if isinstance(dv, dict) and isinstance(cv, dict):
                result[k] = merge_defaults(dv, cv)
            else:
                result[k] = cv
        else:
            result[k] = _deepcopy(dv) if isinstance(dv, dict) else dv
    # 追加キー: current側をそのまま残す
    for k, cv in current.items():
        if k not in result:
            result[k] = cv
    return result

def migrate_legacy(data: dict) -> dict:
    """
    レガシーキー 'show' → 'display' への移行など。
    """
    if not isinstance(data, dict):
        return data

    routine = data.get("routine")
    if isinstance(routine, dict):
        # if_then_rules の show → display
        itr = routine.get("if_then_rules")
        if isinstance(itr, dict):
            if "show" in itr and "display" not in itr:
                itr["display"] = bool(itr["show"])
            itr.pop("show", None)

        # flags/value の display は bool 化
        flg = routine.get("flags")
        if isinstance(flg, dict) and "display" in flg:
            flg["display"] = bool(flg["display"])
        val = routine.get("value")
        if isinstance(val, dict) and "display" in val:
            val["display"] = bool(val["display"])

    return data

def normalize_types(data: dict) -> dict:
    """
    値の型/範囲を正規化（theme, display, length, description）。
    """
    if not isinstance(data, dict):
        return data

    # theme の丸め
    theme = data.get("theme")
    if theme not in ("default", "dark", "light"):
        data["theme"] = "default"

    routine = data.get("routine")
    if isinstance(routine, dict):
        # value
        value = routine.get("value")
        if isinstance(value, dict):
            value["display"] = bool(value.get("display", True))
            desc = value.get("description", "")
            value["description"] = str(desc) if desc is not None else ""

        # flags
        flags = routine.get("flags")
        if isinstance(flags, dict):
            flags["display"] = bool(flags.get("display", True))
            try:
                length = int(flags.get("length", 3))
            except Exception:
                length = 3
            if length < 0: length = 0
            if length > 12: length = 12
            flags["length"] = length
            desc = flags.get("description", "")
            flags["description"] = str(desc) if desc is not None else ""

        # if_then_rules
        itr = routine.get("if_then_rules")
        if isinstance(itr, dict):
            itr["display"] = bool(itr.get("display", True))
            try:
                length = int(itr.get("length", 1))
            except Exception:
                length = 1
            if length < 0: length = 0
            if length > 12: length = 12
            itr["length"] = length
            desc = itr.get("description", "")
            itr["description"] = str(desc) if desc is not None else ""

    return data
