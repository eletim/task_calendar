from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from .. import db
from ..models import Setting
from ._settings_default import DEFAULT_SETTINGS, merge_defaults, migrate_legacy, normalize_types
from ._authutil import require_user

settings_bp = Blueprint('settings', __name__)

def _get_or_init_user_settings(user):
    s = Setting.query.filter_by(user_id=user.id).first()
    if not s:
        s = Setting(user_id=user.id, data=copy.deepcopy(DEFAULT_SETTINGS))
        db.session.add(s)
        db.session.commit()
    return s

@settings_bp.get('/api/settings')
@jwt_required()
def get_settings():
    user = require_user()
    s = _get_or_init_user_settings(user)
    # 後方互換のマージ＆正規化
    merged = merge_defaults(DEFAULT_SETTINGS, s.data or {})
    normalized = normalize_types(migrate_legacy(merged))

    if s.data != normalized:
        s.data = normalized
        db.session.commit()
    
    return jsonify(normalized)

@settings_bp.route('/api/settings', methods=['POST','PUT'])
@jwt_required()
def update_settings():
    user = require_user()
    s = _get_or_init_user_settings(user)
    body = request.get_json(force=True) or {}
    if not isinstance(body, dict):
        return jsonify({'error':'Invalid payload'}), 400
    # マージ → レガシー移行 → 型正規化
    merged = merge_defaults(s.data or DEFAULT_SETTINGS, body)
    normalized = normalize_types(migrate_legacy(merged))
    s.data = normalized
    db.session.commit()
    return jsonify(normalized)
