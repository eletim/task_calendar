from flask import Blueprint, jsonify, request, abort
from flask_jwt_extended import jwt_required
from datetime import datetime
from .. import db
from ..models import Task
from ._authutil import require_user
import re

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')

def _is_valid_date(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d"); return True
    except Exception:
        return False

def _is_valid_date_or_none(x):
    return x is None or (isinstance(x, str) and _is_valid_date(x))

@tasks_bp.get('/')
@jwt_required()
def get_tasks():
    user = require_user()
    rows = Task.query.filter_by(user_id=user.id).order_by(Task.id.asc()).all()
    return jsonify([{
        'id': r.id, 'title': r.title, 'date': r.date, 'done': r.done,
        'color': r.color, 'category': r.category
    } for r in rows])

@tasks_bp.post('/')
@jwt_required()
def add_task():
    user = require_user()
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    category = data.get('category', 'normal')
    if category not in ('normal','recurring','low'):
        return jsonify({'error':'invalid category'}), 400

    color = (data.get('color') or '#3788d8').strip()
    if not re.fullmatch(r'#[0-9A-Fa-f]{6}', color):
        return jsonify({'error':'invalid color format'}), 400
    
    date = data.get('date')
    if not _is_valid_date_or_none(date):
        return jsonify({'error':'invalid date (must be YYYY-MM-DD or null)'}), 400
    
    t = Task(
        title=title,
        date=date,
        done=bool(data.get('done', False)),
        color=color,
        category=category,
        user_id=user.id
    )
    db.session.add(t); db.session.commit()
    return jsonify({
        'id': t.id, 'title': t.title, 'date': t.date, 'done': t.done,
        'color': t.color, 'category': t.category
    }), 201

@tasks_bp.route('/<int:task_id>', methods=['PUT','PATCH'])
@jwt_required()
def update_task(task_id):
    user = require_user()
    data = request.get_json() or {}
    if not any(k in data for k in ('title','date','done','color','category')):
        return jsonify({'error':'nothing to update'}), 400

    t = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not t: abort(404)

    if 'title' in data:
        title = (data['title'] or '').strip()
        if title: t.title = title
    if 'date' in data:
        if not _is_valid_date_or_none(data['date']):
            return jsonify({'error':'invalid date (must be YYYY-MM-DD or null)'}), 400
        t.date = data['date']
    if 'done' in data:
        t.done = bool(data['done'])
    if 'color' in data:
        color = (data['color'] or '').strip()
        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', color):
            abort(400, description='invalid color format')
        t.color = color
    if 'category' in data:
        cat = data['category']
        if cat not in ('normal','recurring','low'):
            abort(400, description='invalid category')
        t.category = cat

    db.session.commit()
    return jsonify({
        'id': t.id, 'title': t.title, 'date': t.date, 'done': t.done,
        'color': t.color, 'category': t.category
    })

@tasks_bp.delete('/<int:task_id>')
@jwt_required()
def delete_task(task_id):
    user = require_user()
    t = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not t: abort(404)
    db.session.delete(t); db.session.commit()
    return '', 204
