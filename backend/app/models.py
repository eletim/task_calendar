# app/models.py
from datetime import datetime
from sqlalchemy.orm import validates
from sqlalchemy import UniqueConstraint
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
    date = db.Column(db.String(10), nullable=True)      # 'YYYY-MM-DD' or None
    done = db.Column(db.Boolean, default=False)
    color = db.Column(db.String(7), default='#3788d8')  # '#RRGGBB'
    category = db.Column(db.String(16), default='normal')  # 'normal'|'recurring'|'low'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Routine(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(10), nullable=False)  # 'YYYY-MM-DD'
    flags = db.Column(db.JSON, nullable=True)        # [bool, ...]
    if_then_rules = db.Column(db.JSON, nullable=True)# [bool, ...]
    value = db.Column(db.Integer, default=0)         # 0..100
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'date', name='uq_routine_user_date'),)

class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON, nullable=False)  # settings.json の中身をそのまま
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
