#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DB整合性チェック + テーブルフェッチ + APIスモーク（任意）
- 既存の重複/不正値チェック
- ORMでのサンプル取得（実データが取れているか確認）
- インデックス/ユニーク制約の存在確認
- （デフォルトON）APIスモーク: /api/auth/login → /api/settings,/api/tasks,/api/routines を 200 確認

使い方:
  python3 scripts/check_db.py -e you@example.com -p pass
  python3 scripts/check_db.py -e you@example.com -p pass --register   # ログイン失敗時は自動登録して再試行
  python3 scripts/check_db.py --no-api                                # APIスモークなし（DBチェックのみ）

終了コード:
  0 = すべてOK
  1 = 重複/不正値あり
  2 = APIログイン失敗 or API取得失敗
"""

import sys
import os
import json
import argparse
from sqlalchemy import text, inspect

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import User, Task, Routine, Setting

def print_title(t):
    print("\n" + "=" * 8 + f" {t} " + "=" * 8)

def check_db(engine):
    ok = True

    print_title("Engine Info")
    print("DB URL  :", str(engine.url))
    print("Dialect :", engine.dialect.name)

    # 件数
    print_title("Row Counts")
    counts = {
        'user'   : db.session.execute(text('SELECT COUNT(*) FROM "user"')).scalar() or 0,
        'task'   : db.session.execute(text('SELECT COUNT(*) FROM task')).scalar() or 0,
        'routine': db.session.execute(text('SELECT COUNT(*) FROM routine')).scalar() or 0,
        'setting': db.session.execute(text('SELECT COUNT(*) FROM setting')).scalar() or 0,
    }
    print(counts)

    # ORMサンプル
    print_title("Sample Fetch (ORM)")
    u = User.query.first()
    print("user:", {'id': u.id, 'email': u.email} if u else None)

    t = Task.query.order_by(Task.id.asc()).limit(3).all()
    print("tasks:", [{'id': x.id, 'title': x.title, 'date': x.date, 'done': x.done,
                    'color': x.color, 'category': x.category} for x in t])

    r = Routine.query.order_by(Routine.date.asc()).limit(3).all()
    print("routines:", [{'date': x.date, 'value': x.value,
                        'flags': x.flags, 'if_then_rules': x.if_then_rules} for x in r])

    s = Setting.query.first()
    print("settings keys:", list((s.data or {}).keys()) if s else None)

    # 重複/不正値
    print_title("Duplicates / Bad Values")
    dup_r = db.session.execute(text(
        "SELECT user_id, date, COUNT(*) c FROM routine GROUP BY user_id, date HAVING c > 1"
    )).fetchall()
    dup_s = db.session.execute(text(
        "SELECT user_id, COUNT(*) c FROM setting GROUP BY user_id HAVING c > 1"
    )).fetchall()
    bad_v = db.session.execute(text(
        "SELECT id, user_id, date, value FROM routine WHERE value < 0 OR value > 100"
    )).fetchall()
    print("dup_routine:", dup_r)
    print("dup_setting:", dup_s)
    print("bad_value  :", bad_v)

    if dup_r or dup_s or bad_v:
        ok = False

    # インデックス/ユニーク制約
    print_title("Indexes / Constraints (Inspector)")
    insp = inspect(engine)
    try:
        print("task indexes   :", insp.get_indexes('task'))
    except Exception as e:
        print("task indexes   : <unavailable>", e)
    try:
        print("routine indexes:", insp.get_indexes('routine'))
    except Exception as e:
        print("routine indexes: <unavailable>", e)
    try:
        print("setting uniques:", insp.get_unique_constraints('setting'))
    except Exception as e:
        print("setting uniques: <unavailable>", e)
    try:
        print("routine uniques:", insp.get_unique_constraints('routine'))
    except Exception as e:
        print("routine uniques: <unavailable>", e)

    if engine.dialect.name == 'sqlite':
        try:
            fk_on = db.session.execute(text('PRAGMA foreign_keys')).fetchone()[0]
            print("sqlite foreign_keys pragma:", fk_on)
        except Exception:
            pass

    return ok

def api_smoke(app, email: str, password: str, auto_register: bool) -> bool:
    print_title("API Smoke (login → GET settings/tasks/routines)")
    client = app.test_client()

    # 1) login
    res = client.post('/api/auth/login', json={'email': email, 'password': password})
    if res.status_code != 200:
        if auto_register:
            print("login failed; try register and login again...")
            r = client.post('/api/auth/register', json={'email': email, 'password': password})
            print("register status:", r.status_code)
            res = client.post('/api/auth/login', json={'email': email, 'password': password})
        else:
            print("login status:", res.status_code)
            return False

    print("login status:", res.status_code)
    data = res.get_json() or {}
    token = data.get('access_token')
    if not token:
        print("No access_token in response.")
        return False

    headers = {'Authorization': f'Bearer {token}'}

    # 2) /api/settings
    r1 = client.get('/api/settings', headers=headers)
    print("GET /api/settings →", r1.status_code)
    if r1.status_code != 200:
        return False
    try:
        js = r1.get_json()
        print("settings keys:", list(js.keys()))
    except Exception as e:
        print("settings json parse error:", e)
        return False

    # 3) /api/tasks/
    r2 = client.get('/api/tasks/', headers=headers)
    print("GET /api/tasks/   →", r2.status_code)
    if r2.status_code != 200:
        return False
    try:
        js = r2.get_json()
        print("tasks count:", len(js), "sample:", js[:2])
    except Exception as e:
        print("tasks json parse error:", e)
        return False

    # 4) /api/routines
    r3 = client.get('/api/routines', headers=headers)
    print("GET /api/routines →", r3.status_code)
    if r3.status_code != 200:
        return False
    try:
        js = r3.get_json()
        print("routines days:", len(js), "first 3 dates:", list(js.keys())[:3])
    except Exception as e:
        print("routines json parse error:", e)
        return False

    return True

def main():
    parser = argparse.ArgumentParser(
        description="DB整合性チェック & APIスモーク（ログイン→各GET）",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-e", "--email", help="APIスモーク用のメールアドレス")
    parser.add_argument("-p", "--password", help="APIスモーク用のパスワード")
    parser.add_argument("--no-api", action="store_true", help="APIスモークを実行しない（DBチェックのみ）")
    parser.add_argument("-r", "--register", action="store_true", help="ログイン失敗時に自動登録して再度ログインを試みる")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        engine = db.get_engine()
        db_ok = check_db(engine)

        api_ok = True
        if not args.no_api:
            # APIスモークをやる時は email/password 必須
            if not (args.email and args.password):
                print("\n[ERROR] APIスモークを有効にするには -e/--email と -p/--password が必要です。")
                print("       例) python3 scripts/check_db.py -e you@example.com -p pass")
                return 2
            api_ok = api_smoke(app, args.email, args.password, args.register)

        print_title("RESULT")
        print(f"DB OK : {db_ok}")
        print(f"API OK: {api_ok}")

        if not db_ok:
            return 1
        if not api_ok:
            return 2
        return 0

if __name__ == "__main__":
    sys.exit(main())
