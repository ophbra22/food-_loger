"""The packaging smoke must validate its new report, never a prior success."""

import io
import json
import runpy
import subprocess
import tarfile
import venv
import zipfile
from pathlib import Path

import pytest

from foodlogger.measurement_report import main

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "docs/biteflow/evidence/p14/check-package-final.py"


@pytest.mark.parametrize("current", ["valid", "invalid", "missing"])
def test_packaging_checks_current_report_even_with_prior_success(tmp_path, monkeypatch, current):
    scratch = tmp_path / ".superpowers/sdd/p14-plan"
    scratch.mkdir(parents=True)
    # A clean run has no old output; failure cases have a genuine older success.
    old_output = scratch / "installed-report"
    if current != "valid":
        assert main(["--output", str(old_output)]) == 0
    old_bytes = (old_output / "report.json").read_bytes() if old_output.exists() else None

    modules = ("foodlogger/measurement.py", "foodlogger/measurement_report.py")
    for name in modules:
        path = tmp_path / "src" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((ROOT / "src" / name).read_bytes())
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode="w"):
        pass

    def git_output(command, **kwargs):
        if command == ["git", "rev-parse", "HEAD"]:
            return "a" * 40 + "\n"
        assert command == ["git", "archive", "a" * 40]
        return archive.getvalue()

    def package_command(command, *, cwd, check, **kwargs):
        assert check is True
        if command[1:] == ["-m", "build", "--no-isolation"]:
            dist = Path(cwd) / "dist"
            dist.mkdir()
            with zipfile.ZipFile(dist / "fixture.whl", "w") as wheel:
                for name in modules:
                    wheel.write(tmp_path / "src" / name, name)
            (dist / "fixture.tar.gz").write_bytes(archive.getvalue())
        elif command[1:4] == ["-m", "pip", "install"]:
            assert "--no-index" in command and "--no-deps" in command
        else:
            assert command[1:4] == ["-m", "foodlogger.measurement_report", "--output"]
            output = Path(command[4])
            assert main(["--output", str(output)]) == 0
            if current == "invalid":
                report = json.loads((output / "report.json").read_text())
                report["acceptance"] = "PASS"
                (output / "report.json").write_text(json.dumps(report))
            elif current == "missing":
                (output / "report.json").unlink()
        return subprocess.CompletedProcess(command, 0)

    # Replace only expensive packaging/process boundaries. The helper, report
    # generation, path selection, validation and manifest writes all run for real.
    monkeypatch.setattr(subprocess, "check_output", git_output)
    monkeypatch.setattr(subprocess, "run", package_command)
    monkeypatch.setattr(venv.EnvBuilder, "create", lambda self, path: None)
    monkeypatch.chdir(tmp_path)

    if current == "valid":
        runpy.run_path(str(HELPER), run_name="__main__")
        manifest = json.loads((scratch / "package-manifest.json").read_text())
        assert manifest["p14_acceptance"] == "BLOCKED"
        assert not old_output.exists()
    else:
        error = AssertionError if current == "invalid" else FileNotFoundError
        with pytest.raises(error):
            runpy.run_path(str(HELPER), run_name="__main__")
        fresh = scratch / "installed-report-reviewed"
        assert (fresh / "dashboard.html").is_file()
        if current == "invalid":
            assert json.loads((fresh / "report.json").read_text())["acceptance"] == "PASS"
        else:
            assert not (fresh / "report.json").exists()
        assert not (scratch / "package-manifest.json").exists()
        assert (old_output / "report.json").read_bytes() == old_bytes
