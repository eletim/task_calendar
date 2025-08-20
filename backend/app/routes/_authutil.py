# backend/app/routes/_authutil.py
from flask import abort
from flask_jwt_extended import get_jwt_identity
from ..models import User

def require_user():
    """JWTのidentityからUserを取得（@jwt_required() は各ルート側で付けてください）"""
    uid = get_jwt_identity()
    try:
        uid = int(uid)   # identity を int 想定。文字列になっても安全に。
    except (TypeError, ValueError):
        abort(401, description="invalid token identity")

    user = User.query.get(uid)
    if not user:
        abort(401, description="user not found")
    return user
