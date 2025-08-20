#!/usr/bin/env python3
import argparse
import json
import os
import sys

# プロジェクトルートを PYTHONPATH に追加（スクリプトをどこから実行してもOKにする）
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models import User, Task, Routine, Setting


def parse_args():
    p = argparse.ArgumentParser(
        description="Import tasks/routines/settings JSON into DB for a specified user."
    )
    p.add_argument("--email", required=True, help="User email (will be created if not exists)")
    p.add_argument("--password", required=True, help="User password (set only on create by default)")
    p.add_argument("--data-dir", default=os.path.join(ROOT, "data"),
                   help="Directory containing tasks.json, routines.json, settings.json (default: ./data)")
    p.add_argument("--update-password", action="store_true",
                   help="If user already exists, update password to the provided one")
    return p.parse_args()


def main():
    args = parse_args()

    app = create_app()
    with app.app_context():
        # 1) Ensure user
        email = args.email.strip().lower()
        password = args.password

        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(email=email)
            u.set_password(password)
            db.session.add(u)
            db.session.commit()
            print(f"[user] created: {email}")
        else:
            print(f"[user] exists: {email}")
            if args.update_password:
                u.set_password(password)
                db.session.add(u)
                db.session.commit()
                print("[user] password updated")

        data_dir = os.path.abspath(args.data_dir)
        if not os.path.isdir(data_dir):
            print(f"[warn] data dir not found: {data_dir}")
        imported_counts = {"tasks": 0, "routines": 0, "settings": 0}

        # 2) tasks.json
        tp = os.path.join(data_dir, "tasks.json")
        if os.path.exists(tp):
            try:
                tasks = json.load(open(tp, "r", encoding="utf-8"))
                for t in tasks:
                    db.session.add(Task(
                        title=t.get("title", ""),
                        date=t.get("date"),
                        done=bool(t.get("done", False)),
                        color=t.get("color", "#3788d8"),
                        category=t.get("category", "normal"),
                        user_id=u.id
                    ))
                    imported_counts["tasks"] += 1
                print(f"[tasks] imported: {imported_counts['tasks']}")
            except Exception as e:
                print(f"[tasks] ERROR: {e}")
        else:
            print("[tasks] tasks.json not found (skipped)")

        # 3) routines.json
        rp = os.path.join(data_dir, "routines.json")
        if os.path.exists(rp):
            try:
                routines = json.load(open(rp, "r", encoding="utf-8"))
                for date, rec in routines.items():
                    # 後方互換: list は flags のみ
                    flags = rec if isinstance(rec, list) else rec.get("flags")
                    iftr  = None if isinstance(rec, list) else rec.get("if_then_rules")
                    val   = 0 if isinstance(rec, list) else rec.get("value", 0)
                    db.session.add(Routine(
                        date=date, flags=flags, if_then_rules=iftr, value=val, user_id=u.id
                    ))
                    imported_counts["routines"] += 1
                print(f"[routines] imported: {imported_counts['routines']}")
            except Exception as e:
                print(f"[routines] ERROR: {e}")
        else:
            print("[routines] routines.json not found (skipped)")

        # 4) settings.json
        sp = os.path.join(data_dir, "settings.json")
        if os.path.exists(sp):
            try:
                sdata = json.load(open(sp, "r", encoding="utf-8"))
                s = Setting.query.filter_by(user_id=u.id).first()
                if not s:
                    s = Setting(user_id=u.id, data=sdata)
                else:
                    s.data = sdata
                db.session.add(s)
                imported_counts["settings"] = 1
                print("[settings] imported")
            except Exception as e:
                print(f"[settings] ERROR: {e}")
        else:
            print("[settings] settings.json not found (skipped)")

        db.session.commit()
        print("Imported.")
        print(f"Summary: tasks={imported_counts['tasks']} routines={imported_counts['routines']} settings={imported_counts['settings']}")


if __name__ == "__main__":
    main()
