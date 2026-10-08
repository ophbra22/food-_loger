"""Exercise libpq's real certificate validation without an external database."""

import shutil
import socket
import ssl
import struct
import subprocess
import threading
from pathlib import Path

import pytest


@pytest.mark.parametrize("use_pooler_ca", [False, True])
@pytest.mark.parametrize(
    "hostname,trusted",
    [("database.test", True), ("wrong-host.test", True), ("database.test", False)],
)
def test_postgres_verifies_system_and_pooler_certificates(
    tmp_path, monkeypatch, hostname, trusted, use_pooler_ca
):
    pytest.importorskip("psycopg")
    import foodlogger.database as database_module
    from foodlogger.database import Database, DatabaseUnavailable

    expected_host = "database.test"
    if use_pooler_ca:
        expected_host = "aws-1-ap-northeast-2.pooler.supabase.com"
        hostname = expected_host if hostname == "database.test" else "wrong.pooler.supabase.com"

    if not shutil.which("openssl"):
        pytest.skip("OpenSSL CLI is needed for the local TLS fixture")
    certificate, key = tmp_path / "root.pem", tmp_path / "key.pem"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "1",
            "-keyout",
            str(key),
            "-out",
            str(certificate),
            "-subj",
            f"/CN={expected_host}",
            "-addext",
            f"subjectAltName=DNS:{expected_host}",
        ],
        check=True,
        capture_output=True,
    )
    paths = ssl.get_default_verify_paths()
    if use_pooler_ca:
        monkeypatch.setattr(
            database_module, "SUPABASE_CA", certificate if trusted else Path(paths.cafile)
        )
    elif trusted:
        paths = paths._replace(cafile=str(certificate))
    monkeypatch.setattr(ssl, "get_default_verify_paths", lambda: paths)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certificate, key)
    accepted = threading.Event()
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        listener.settimeout(5)
        port = listener.getsockname()[1]

        def postgres_tls_probe():
            with listener.accept()[0] as connection:
                connection.settimeout(5)
                assert connection.recv(8) == struct.pack("!II", 8, 80877103)
                connection.sendall(b"S")
                try:
                    with context.wrap_socket(connection, server_side=True) as secured:
                        # libpq checks hostname after TLS negotiation; only a
                        # PostgreSQL startup packet proves it accepted the peer.
                        startup = secured.recv(8)
                        if len(startup) != 8:
                            return
                        assert startup[4:] == struct.pack("!I", 196608)
                        accepted.set()
                        error = b"SFATAL\x00C28000\x00MTLS probe complete\x00\x00"
                        secured.sendall(b"E" + struct.pack("!I", len(error) + 4) + error)
                except (ssl.SSLError, ConnectionError):
                    pass  # The old broken CA selection fails before startup.

        thread = threading.Thread(target=postgres_tls_probe, daemon=True)
        thread.start()
        database = Database(
            f"postgresql://probe:fixture-only@{hostname}:{port}/postgres"
            "?hostaddr=127.0.0.1&sslmode=verify-full&connect_timeout=3"
        )
        # The probe deliberately refuses database authentication, after the real
        # client has verified its hostname and trusted certificate chain.
        with pytest.raises(DatabaseUnavailable), database.connect():
            pass
        thread.join(timeout=5)
        assert not thread.is_alive()
        assert accepted.is_set() == (trusted and hostname == expected_host)
        assert database.connection_options["sslmode"] == "verify-full"
