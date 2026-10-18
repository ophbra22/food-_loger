"""Prepare local P14 reports.

Usage: PYTHONPATH=src python scripts/report_release_metrics.py --help"""

from foodlogger.measurement_report import main

if __name__ == "__main__":
    raise SystemExit(main())
