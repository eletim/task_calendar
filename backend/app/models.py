# app/models.py
from datetime import datetime
from sqlalchemy.orm import validates
from sqlalchemy import UniqueConstraint, Index, CheckConstraint, ForeignKey
from sqlalchemy.ext.mutable import MutableList, MutableDict
import re

from .extensions import db, bcrypt

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(320), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    routines = db.relationship('Routine', backref='user', lazy=True, cascade='all, delete-orphan')
    settings = db.relationship('Setting', backref='user', uselist=False, cascade='all, delete-orphan')

    def set_password(self, raw): self.password_hash = bcrypt.generate_password_hash(raw).decode('utf-8')
    def check_password(self, raw): return bcrypt.check_password_hash(self.password_hash, raw)

    @validates('email')
    def validate_email(self, key, value):
        v = (value or '').strip().lower()
        if '@' not in v:
            raise ValueError('invalid email')
        return v

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    date = db.Column(db.String(10), nullable=True)         # 'YYYY-MM-DD' or None（将来は Date 型も可）
    done = db.Column(db.Boolean, default=False, nullable=False)
    color = db.Column(db.String(7), default='#3788d8', nullable=False)  # '#RRGGBB'
    category = db.Column(db.String(16), default='normal', nullable=False)  # 'normal'|'recurring'|'low'
    user_id = db.Column(db.Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (
        Index('ix_task_user_date', 'user_id', 'date'),
        CheckConstraint("category in ('normal','recurring','low')", name='ck_task_category'),
    )

    @validates('category')
    def validate_category(self, key, val):
        v = (val or 'normal').strip()
        return v if v in ('normal','recurring','low') else 'normal'

    @validates('color')
    def validate_color(self, key, val):
        v = (val or '#3788d8').strip()
        return v if re.fullmatch(r'#[0-9A-Fa-f]{6}', v) else '#3788d8'

class Routine(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(10), nullable=False)  # 'YYYY-MM-DD'
    # JSON のインプレース変更を検知できるよう as_mutable を付与
    flags = db.Column(MutableList.as_mutable(db.JSON), nullable=True)         # [bool, ...]
    if_then_rules = db.Column(MutableList.as_mutable(db.JSON), nullable=True) # [bool, ...]
    value = db.Column(db.Integer, default=0, nullable=False)                  # 0..100
    user_id = db.Column(db.Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_routine_user_date'),
        Index('ix_routine_user_date', 'user_id', 'date'),
    )

class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # 設定の辞書をインプレース更新しても変更検知されるように
    data = db.Column(MutableDict.as_mutable(db.JSON), nullable=False)
    user_id = db.Column(db.Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', name='uq_setting_user'),  # ← 1ユーザー1レコードを保証
    )
