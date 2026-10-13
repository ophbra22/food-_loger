"""Explicit offline SQLite v2 migration. Stop all writers and keep the backup.

Never run on startup. Follows SQLite's generalized table-rebuild procedure;
refuses unknown columns/views rather than guessing how to migrate extensions.
"""

import sqlite3
from pathlib import Path

MEALS_SQL = """CREATE TABLE meals (
    id TEXT PRIMARY KEY, day TEXT NOT NULL, meal_type TEXT NOT NULL,
    food_id TEXT NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL,
    grams REAL NOT NULL CHECK (grams >= 0.0001 AND grams <= 2000),
    calories REAL, protein REAL, carbs REAL, fat REAL, created_at TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '__legacy__', details TEXT NOT NULL DEFAULT '{}'
)"""
COLUMNS = (
    "id",
    "day",
    "meal_type",
    "food_id",
    "name",
    "emoji",
    "grams",
    "calories",
    "protein",
    "carbs",
    "fat",
    "created_at",
    "user_id",
    "details",
)


def partial_storage_ready(database):
    with database.connect() as db:
        if database.postgres:
            row = db.execute("SELECT version FROM schema_version WHERE id=1").fetchone()
            return bool(row and row["version"] == 2)
        columns = {r["name"]: r for r in db.execute("PRAGMA table_info(meals)")}
        sql = db.execute("SELECT sql FROM sqlite_master WHERE name='meals'").fetchone()
        return bool(
            sql
            and "grams >= 0.0001" in sql["sql"]
            and all(
                k in columns and not columns[k]["notnull"]
                for k in ("calories", "protein", "carbs", "fat")
            )
        )


def migrate_sqlite(path: Path, backup: Path):
    path, backup = Path(path), Path(backup)
    if path.resolve() == backup.resolve():
        raise ValueError("Backup must be a separate file.")
    if not path.is_file():
        raise FileNotFoundError(path)
    # Exclusive creation means a previous backup can never be overwritten.
    with backup.open("xb"):
        pass
    with sqlite3.connect(path) as db:
        with sqlite3.connect(backup) as target:
            db.backup(target)
        db.execute("PRAGMA foreign_keys=OFF")
        db.execute("BEGIN EXCLUSIVE")
        try:
            columns = {r[1] for r in db.execute("PRAGMA table_info(meals)")}
            if columns != set(COLUMNS):
                raise ValueError("Unknown meals schema; manual migration review required.")
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='view'").fetchone():
                raise ValueError("Database has views; manual migration review required.")
            objects = db.execute(
                "SELECT sql FROM sqlite_master WHERE tbl_name='meals' "
                "AND type IN ('index','trigger') AND sql IS NOT NULL"
            ).fetchall()
            db.execute(MEALS_SQL.replace("CREATE TABLE meals", "CREATE TABLE meals_v2"))
            names = ",".join(COLUMNS)
            db.execute(f"INSERT INTO meals_v2 ({names}) SELECT {names} FROM meals")
            db.execute("DROP TABLE meals")
            db.execute("ALTER TABLE meals_v2 RENAME TO meals")
            for (sql,) in objects:
                db.execute(sql)
            if db.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Foreign key verification failed; migration rolled back.")
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.execute("PRAGMA foreign_keys=ON")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    parser.add_argument("backup", type=Path)
    args = parser.parse_args()
    migrate_sqlite(args.database, args.backup)
