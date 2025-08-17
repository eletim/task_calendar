# backend/app/routes/_authutil.py
from flask_jwt_extended import get_jwt_identity
from ..models import User   # routesパッケージの一つ上 (= backend.app) から models を参照

def require_user():
    """JWTのidentityからUserを取得（@jwt_required() は各ルート側で付けてください）"""
    uid = get_jwt_identity()
    return User.query.get(uid)
