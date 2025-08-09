from flask import Blueprint, jsonify, request
import os
import json

# Blueprint for calendar settings
settings_bp = Blueprint('settings', __name__)

# Determine the path to the settings data file. We store settings in a
# JSON file alongside routines.json in the project’s data directory.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'settings.json')

# Default values for all settings. These values are used only when
# a setting is missing from the file; we do not write defaults back
# to the file unless the settings are explicitly updated via the API.
DEFAULT_SETTINGS = {
    "theme": "default",  # possible values: "default", "dark", "light"
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
            "length": 3,
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


def load_settings():
    """
    Load the current settings from the JSON file. If the file is malformed or
    missing, return a copy of DEFAULT_SETTINGS.
    """
    ensure_file()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            # If the file contains something unexpected, ignore it
            return DEFAULT_SETTINGS.copy()
        # Merge any missing default keys into the loaded settings without
        # mutating the original structure.
        def merge_defaults(default, current):
            result = {}
            for key, default_value in default.items():
                if key in current:
                    if isinstance(default_value, dict) and isinstance(current[key], dict):
                        result[key] = merge_defaults(default_value, current[key])
                    else:
                        result[key] = current[key]
                else:
                    # use default if missing
                    if isinstance(default_value, dict):
                        result[key] = json.loads(json.dumps(default_value))
                    else:
                        result[key] = default_value
            # include any extra keys present in current
            for key, value in current.items():
                if key not in result:
                    result[key] = value
            return result
        return merge_defaults(DEFAULT_SETTINGS, data)
    except Exception:
        # On any read error, fall back to defaults
        return DEFAULT_SETTINGS.copy()


def save_settings(data):
    """Persist the given settings dictionary to the JSON file."""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    """Retrieve the current calendar settings."""
    return jsonify(load_settings())


@settings_bp.route('/api/settings', methods=['POST'])
def update_settings():
    """
    Update the calendar settings. The request body should be a JSON object. Keys
    provided in the payload are merged into the existing settings; missing keys
    are left unchanged. The updated settings are saved and returned.
    Example payload:
        {
            "theme": "dark",
            "routine": {
                "value": {
                    "display": false,
                    "description": "Percentage of completion"
                },
                "flags": {
                    "length": 4
                }
            }
        }
    """
    body = request.get_json(force=True) or {}
    if not isinstance(body, dict):
        return jsonify({'error': 'Invalid payload format'}), 400
    current = load_settings()

    # Recursively merge the body into the current settings
    def recursive_update(original, updates):
        for key, value in updates.items():
            if isinstance(value, dict) and isinstance(original.get(key), dict):
                original[key] = recursive_update(original[key], value)
            else:
                original[key] = value
        return original

    updated = recursive_update(current, body)
    save_settings(updated)
    return jsonify(updated)