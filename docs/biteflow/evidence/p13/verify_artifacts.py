"""Verify retained local candidate identities and readable archives, not release readiness."""
import hashlib
import json
import subprocess
import tarfile
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[4]
manifest = json.loads((Path(__file__).parent / 'manifest.json').read_text())
for path, expected in manifest['source_trees'].items():
    actual = subprocess.check_output(['git', 'rev-parse', f'HEAD:{path}'], cwd=root).decode().strip()
    assert actual == expected, path
for artifact in manifest['artifacts']:
    path = Path(artifact['path'])
    assert path.stat().st_size == artifact['bytes'], path
    assert hashlib.sha256(path.read_bytes()).hexdigest() == artifact['sha256'], path
    if path.suffix in {'.zip', '.apk', '.whl'}:
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None, path
            if path.suffix == '.whl':
                assert archive.read('foodlogger/privacy.py') == (root/'src/foodlogger/privacy.py').read_bytes()
    elif path.suffix == '.gz':
        with tarfile.open(path) as archive:
            assert archive.getmembers()
print(f"PASS: {len(manifest['artifacts'])} artifact hashes, archive integrity, source trees and packaged privacy code")
