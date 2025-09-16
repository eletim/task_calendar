from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
from .. import db
from ..models import Routine, Setting
from ._authutil import require_user

routines_bp = Blueprint('routines', __name__)

def make_bools(n): return [False] * max(0, int(n or 0))
def to_bool_list(x): return [bool(v) for v in x] if isinstance(x, list) else None

def _is_valid_date(s: str) -> bool:
    """'YYYY-MM-DD' を厳密チェック（存在しない日付はNG）"""
    if not isinstance(s, str):
        return False
    try:
        datetime.strptime(s, '%Y-%m-%d')
        return True
    except ValueError:
        return False

def get_current_limits_for(user):
    s = Setting.query.filter_by(user_id=user.id).first()
    data = (s.data if s else {}) or {}
    r = data.get('routine', {})
    flags_len  = int(r.get('flags', {}).get('length', 3) or 3)
    ifthen_len = int(r.get('if_then_rules', {}).get('length', 3) or 3)
    return (flags_len if flags_len > 0 else 3,
            ifthen_len if ifthen_len > 0 else 3)

def normalize_for_response(rec, flags_len, ifthen_len):
    if not rec:
        return {"flags": [False]*flags_len, "if_then_rules": [False]*ifthen_len, "value": 0}
    flags = [bool(v) for v in (rec.flags or [])]
    iftr  = [bool(v) for v in (rec.if_then_rules or [])]
    # 空や全Falseなら設定長で埋める
    if len(flags) == 0 or all(v is False for v in flags): flags = [False]*flags_len
    if len(iftr)  == 0 or all(v is False for v in iftr):  iftr  = [False]*ifthen_len
    return {"flags": flags, "if_then_rules": iftr, "value": rec.value or 0}

# ----- API -----
@routines_bp.get('/api/routines')
@jwt_required()
def get_routines():
    user = require_user()
    f_len, i_len = get_current_limits_for(user)
    rows = Routine.query.filter_by(user_id=user.id).all()
    out = {r.date: normalize_for_response(r, f_len, i_len) for r in rows}
    return jsonify(out)

@routines_bp.post('/api/routines/flags')
@jwt_required()
def update_flags():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); idx = body.get('index')
    if not (isinstance(idx, int) and _is_valid_date(date)):
        return jsonify({'error': 'invalid payload (date must be YYYY-MM-DD)'}), 400

    f_len, i_len = get_current_limits_for(user)
    max_flags_len = f_len
    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec:
        rec = Routine(user_id=user.id, date=date, flags=make_bools(max_flags_len), value=0)

    flags = to_bool_list(rec.flags) or []
    if idx == -1:
        current_len = len(flags) if len(flags) > 0 else max_flags_len
        flags = make_bools(current_len)
    else:
        if idx >= len(flags):
            if idx >= max_flags_len:
                return jsonify({'error': f'Index {idx} exceeds maximum length {max_flags_len}'}), 400
            flags.extend([False] * (idx + 1 - len(flags)))
        flags[idx] = not flags[idx]

    rec.flags = flags
    db.session.add(rec); db.session.commit()
    resp = normalize_for_response(rec, f_len, i_len)
    return jsonify({"date": date, "state": resp["flags"], "value": resp["value"], "if_then_rules": resp["if_then_rules"]})

@routines_bp.put('/api/routines/flags')
@jwt_required()
def put_flags():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); arr = to_bool_list(body.get('flags'))
    if not _is_valid_date(date):
        return jsonify({'error': 'invalid payload (date must be YYYY-MM-DD)'}), 400
    if arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    f_len, i_len = get_current_limits_for(user)
    if len(arr) > f_len:
        return jsonify({'error': f'flags length exceeds maximum {f_len}'}), 400
 
    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec:
        rec = Routine(user_id=user.id, date=date, flags=make_bools(f_len), value=0)
        db.session.add(rec)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    rec.flags = arr
    db.session.add(rec); db.session.commit()

    resp = normalize_for_response(rec, f_len, i_len)
    return jsonify({"date": date, "state": resp["flags"], "if_then_rules": resp["if_then_rules"], "value": resp["value"]})

@routines_bp.post('/api/routines/if_then_rules')
@jwt_required()
def update_if_then_rules():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); idx = body.get('index')
    if not (isinstance(idx, int) and _is_valid_date(date)):
        return jsonify({'error': 'invalid payload (date must be YYYY-MM-DD)'}), 400

    f_len, i_len = get_current_limits_for(user)
    max_ifthen_len = i_len
    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec: rec = Routine(user_id=user.id, date=date, value=0)

    arr = to_bool_list(rec.if_then_rules) or []
    if idx == -1:
        current_len = len(arr) if len(arr) > 0 else max_ifthen_len
        arr = make_bools(current_len)
    else:
        if idx >= len(arr):
            if idx >= max_ifthen_len:
                return jsonify({'error': f'Index {idx} exceeds maximum length {max_ifthen_len}'}), 400
            arr.extend([False] * (idx + 1 - len(arr)))
        arr[idx] = not arr[idx]

    rec.if_then_rules = arr
    db.session.add(rec); db.session.commit()

    resp = normalize_for_response(rec, f_len, i_len)
    return jsonify({"date": date, "if_then_rules": resp["if_then_rules"], "value": resp["value"], "state": resp["flags"]})

@routines_bp.put('/api/routines/if_then_rules')
@jwt_required()
def put_if_then_rules():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); arr = to_bool_list(body.get('if_then_rules'))
    if not _is_valid_date(date):
        return jsonify({'error': 'invalid payload (date must be YYYY-MM-DD)'}), 400
    if arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    f_len, i_len = get_current_limits_for(user)
    if len(arr) > i_len:
        return jsonify({'error': f'if_then_rules length exceeds maximum {i_len}'}), 400
 
    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec: rec = Routine(user_id=user.id, date=date, value=0)
    rec.if_then_rules = arr
    db.session.add(rec); db.session.commit()

    resp = normalize_for_response(rec, f_len, i_len)
    return jsonify({"date": date, "if_then_rules": resp["if_then_rules"], "value": resp["value"], "state": resp["flags"]})

@routines_bp.post('/api/routines/value')
@jwt_required()
def update_value():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); value = body.get('value')
    if not _is_valid_date(date):
        return jsonify({'error': 'invalid payload (date must be YYYY-MM-DD)'}), 400
    try:
        value = int(value)
    except:
        return jsonify({'error': 'value must be int'}), 400
    if not (0 <= value <= 100):
        return jsonify({'error': 'value must be 0-100'}), 400

    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec: rec = Routine(user_id=user.id, date=date)
    rec.value = value
    db.session.add(rec); db.session.commit()

    f_len, i_len = get_current_limits_for(user)
    resp = normalize_for_response(rec, f_len, i_len)
    return jsonify({"date": date, "value": resp["value"], "state": resp["flags"], "if_then_rules": resp["if_then_rules"]})
