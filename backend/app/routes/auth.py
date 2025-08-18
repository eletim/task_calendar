# app/routes/auth.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from ..extensions import db
from ..models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.post('/register')
def register():
    body = request.get_json(force=True) or {}
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    if not email or not password:
        return jsonify({'error': 'email and password required'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'email already registered'}), 409
    u = User(email=email)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    return jsonify({'message': 'registered'}), 201

@auth_bp.post('/login')
def login():
    body = request.get_json(force=True) or {}
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    u = User.query.filter_by(email=email).first()
    if not u or not u.check_password(password):
        return jsonify({'error': 'invalid credentials'}), 401
    token = create_access_token(identity=u.id)
    return jsonify({'access_token': token})

@auth_bp.post('/refresh')
@jwt_required(refresh=True)
def refresh_token():
    uid = get_jwt_identity()
    return jsonify(access_token=create_access_token(identity=uid))
