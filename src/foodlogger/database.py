"""SQLite locally; verified-TLS PostgreSQL in a private schema when configured."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path


class DatabaseUnavailable(RuntimeError):
    """A database operation failed without exposing credentials or driver details."""


class PostgresConnection:
    """Adapt our fixed, parameterized SQL statements to psycopg's placeholders."""

    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=()):
        # Statements are application constants, never user-supplied SQL.
        return self.connection.execute(statement.replace("?", "%s"), parameters)


class Database:
    def __init__(self, location: str | Path):
        value = str(location)
        self.postgres = value.startswith(("postgresql://", "postgres://"))
        self.path = None
        self.connection_options = {}
        if self.postgres:
            try:
                from psycopg.conninfo import conninfo_to_dict

                options = conninfo_to_dict(value)
            except ImportError:
                raise RuntimeError("Install the postgres extra to use DATABASE_URL.") from None
            except Exception:
                raise ValueError("Invalid PostgreSQL connection URL.") from None
            host = options.get("host", "")
            if not host or not options.get("dbname") or not options.get("user"):
                raise ValueError("PostgreSQL URL requires a host, database and user.")
            if host not in {"localhost", "127.0.0.1", "::1"}:
                if options.get("sslmode", "verify-full") != "verify-full":
                    raise ValueError(
                        "Remote PostgreSQL requires verified TLS (sslmode=verify-full)."
                    )
                options["sslmode"] = "verify-full"
                options.setdefault("sslrootcert", "system")
            options.setdefault("connect_timeout", "5")
            options["application_name"] = "foodlogger"
            self.connection_options = options
        else:
            if "://" in value or not value:
                raise ValueError("Use a PostgreSQL URL or a local SQLite file path.")
            self.path = Path(location)
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def __repr__(self):
        return f"Database(backend={'postgresql' if self.postgres else 'sqlite'})"

    @contextmanager
    def connect(self):
        if not self.postgres:
            db = sqlite3.connect(self.path, timeout=10)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
            try:
                with db:
                    yield db
            finally:
                db.close()
            return
        import psycopg
        from psycopg.rows import dict_row

        try:
            # No prepared statements: compatible with Supabase's transaction pooler.
            with psycopg.connect(
                **self.connection_options, row_factory=dict_row, prepare_threshold=None
            ) as db:
                # Transaction-local settings do not leak between pooled connections.
                db.execute("SET LOCAL search_path TO foodlogger, pg_catalog")
                db.execute("SET LOCAL statement_timeout = '10s'")
                db.execute("SET LOCAL lock_timeout = '5s'")
                yield PostgresConnection(db)
        except psycopg.IntegrityError:
            raise sqlite3.IntegrityError("Database constraint rejected the operation.") from None
        except psycopg.Error:
            raise DatabaseUnavailable("The journal database is temporarily unavailable.") from None

    def check_schema(self):
        if self.postgres:
            with self.connect() as db:
                version = db.execute("SELECT version FROM schema_version WHERE id = 1").fetchone()
                if not version or version["version"] != 1:
                    raise DatabaseUnavailable("The journal database schema needs setup.")
