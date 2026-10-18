"""Verify the retained local rollback APK and preservation boundaries; no network."""

import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[4]
evidence = Path(__file__).parent
manifest = json.loads((evidence / "manifest.json").read_text())


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root, text=True).strip()


for tree, expected in manifest["source_trees"].items():
    assert git("rev-parse", f"HEAD:{tree}") == expected, tree
    assert not git("diff", "HEAD", "--", tree), f"Uncommitted {tree} changes"
artifact = manifest["artifact"]
apk = Path(artifact["path"])
assert apk.stat().st_size == artifact["bytes"]
assert hashlib.sha256(apk.read_bytes()).hexdigest() == artifact["sha256"]
with zipfile.ZipFile(apk) as package:
    assert package.testzip() is None
    bundle = package.read("assets/index.android.bundle")
assert hashlib.sha256(bundle).hexdigest() == artifact["bundle_sha256"]
with tempfile.TemporaryDirectory(prefix="biteflow-rollback-inspect-") as temp:
    path = Path(temp) / "index.android.bundle"
    path.write_bytes(bundle)
    bytecode = subprocess.check_output(
        [str(root / "mobile/node_modules/hermes-compiler/hermesc/osx-bin/hermesc"),
         "-b", "-dump-bytecode", str(path)], text=True
    )
flag = re.search(r"^Function<accountExportDisabled>[^\n]*\n([^\n]+)\n([^\n]+)", bytecode, re.M)
assert flag and "LoadConstTrue" in flag[1] and "Ret" in flag[2]
assert "Function<clearPrivateFiles>" in bytecode
assert r"^biteflow-account-[a-zA-Z0-9-]+\.json$" in bytecode
assert "Function<sharePrivateExport>" in bytecode
assert "Private temporary files could not be cleared." in bytecode
assert "retryPrivateCleanup" in bytecode
base = manifest["base"]
for preserved in (
    "mobile/src/storage/private-files.ts",
    "mobile/src/storage/export-session.ts",
    "src/foodlogger/privacy.py",
):
    assert not git("diff", base, "--", preserved), preserved
marker = "## Complete inherited P12 register (verbatim)"
old = git("show", f"{base}:docs/biteflow/p13-open-gates.md")
current = (root / "docs/biteflow/p13-open-gates.md").read_text().strip()
assert old.split(marker, 1)[1] == current.split(marker, 1)[1]
print("PASS: source trees, APK/bundle hashes and ZIP integrity; compiled accountExportDisabled returns true.")
print("PASS: packaged cleanup/archive matcher/share helper and visible cleanup retry retained; cleanup/session/privacy source unchanged; full inherited gate register unchanged.")
print("LIMIT: static artifact inspection and mocked lifecycle tests do not prove physical cleanup, signed rollout or OS retention.")
