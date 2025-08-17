from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from .. import db
from ..models import Routine, Setting
from ._authutil import require_user

routines_bp = Blueprint('routines', __name__)

# ----- 設定から制限長を取得 -----
def get_current_limits(user):
    s = Setting.query.filter_by(user_id=user.id).first()
    data = (s.data if s else {}) or {}
    routine = data.get('routine', {})
    flags_len = int(routine.get('flags', {}).get('length', 3) or 3)
    ifthen_len = int(routine.get('if_then_rules', {}).get('length', 3) or 3)
    flags_len = flags_len if flags_len > 0 else 3
    ifthen_len = ifthen_len if ifthen_len > 0 else 3
    return flags_len, ifthen_len

def make_bools(n): return [False] * max(0, int(n or 0))
def to_bool_list(x): return [bool(v) for v in x] if isinstance(x, list) else None

def normalize_for_response(rec, user):
    max_flags_len, max_ifthen_len = get_current_limits(user)
    if not rec:
        return {"flags": make_bools(max_flags_len), "if_then_rules": make_bools(max_ifthen_len), "value": 0}
    flags = to_bool_list(rec.flags) if rec.flags is not None else make_bools(max_flags_len)
    iftr  = to_bool_list(rec.if_then_rules) if rec.if_then_rules is not None else make_bools(max_ifthen_len)
    value = rec.value or 0
    return {"flags": flags, "if_then_rules": iftr, "value": value}

# ----- API -----
@routines_bp.get('/api/routines')
@jwt_required()
def get_routines():
    user = require_user()
    rows = Routine.query.filter_by(user_id=user.id).all()
    out = {}
    for r in rows:
        out[r.date] = normalize_for_response(r, user)
    return jsonify(out)

@routines_bp.post('/api/routines/flags')
@jwt_required()
def update_flags():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); idx = body.get('index')
    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error':'invalid payload'}), 400

    max_flags_len, _ = get_current_limits(user)
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
    resp = normalize_for_response(rec, user)
    return jsonify({"date": date, "state": resp["flags"], "value": resp["value"], "if_then_rules": resp["if_then_rules"]})

@routines_bp.put('/api/routines/flags')
@jwt_required()
def put_flags():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); arr = to_bool_list(body.get('flags'))
    if not isinstance(date, str) or arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    max_flags_len, _ = get_current_limits(user)
    if len(arr) > max_flags_len:
        return jsonify({'error': f'flags length exceeds maximum {max_flags_len}'}), 400

    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec: rec = Routine(user_id=user.id, date=date, value=0)
    rec.flags = arr
    db.session.add(rec); db.session.commit()

    resp = normalize_for_response(rec, user)
    return jsonify({"date": date, "state": resp["flags"], "if_then_rules": resp["if_then_rules"], "value": resp["value"]})

@routines_bp.post('/api/routines/if_then_rules')
@jwt_required()
def update_if_then_rules():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); idx = body.get('index')
    if not isinstance(date, str) or not isinstance(idx, int):
        return jsonify({'error':'invalid payload'}), 400

    _, max_ifthen_len = get_current_limits(user)
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

    resp = normalize_for_response(rec, user)
    return jsonify({"date": date, "if_then_rules": resp["if_then_rules"], "value": resp["value"], "state": resp["flags"]})

@routines_bp.put('/api/routines/if_then_rules')
@jwt_required()
def put_if_then_rules():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); arr = to_bool_list(body.get('if_then_rules'))
    if not isinstance(date, str) or arr is None:
        return jsonify({'error': 'invalid payload'}), 400

    _, max_ifthen_len = get_current_limits(user)
    if len(arr) > max_ifthen_len:
        return jsonify({'error': f'if_then_rules length exceeds maximum {max_ifthen_len}'}), 400

    rec = Routine.query.filter_by(user_id=user.id, date=date).first()
    if not rec: rec = Routine(user_id=user.id, date=date, value=0)
    rec.if_then_rules = arr
    db.session.add(rec); db.session.commit()

    resp = normalize_for_response(rec, user)
    return jsonify({"date": date, "if_then_rules": resp["if_then_rules"], "value": resp["value"], "state": resp["flags"]})

@routines_bp.post('/api/routines/value')
@jwt_required()
def update_value():
    user = require_user()
    body = request.get_json(force=True)
    date = body.get('date'); value = body.get('value')
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

    resp = normalize_for_response(rec, user)
    return jsonify({"date": date, "value": resp["value"], "state": resp["flags"], "if_then_rules": resp["if_then_rules"]})
