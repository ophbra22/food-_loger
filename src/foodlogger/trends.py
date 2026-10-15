"""Bounded deterministic projections. Missing intake and weight never become zeroes."""

from datetime import timedelta
from decimal import Decimal

from foodlogger.foundation import lock_owner
from foodlogger.goals import effective_goal, progress
from foodlogger.storage import Journal, summarize_entries
from foodlogger.tracking import date_range, total

NUTRIENTS = ("calories", "protein", "carbs", "fat")


def average(values):
    if not values or any(v is None for v in values):
        return None
    return float(sum((Decimal(str(v)) for v in values), Decimal(0)) / len(values))


def period(start, end, meals, measurements, goals):
    by_day = {}
    tracked = {}
    for entry in meals:
        by_day.setdefault(entry["day"], []).append(entry)
    for entry in measurements:
        tracked.setdefault((entry["local_date"], entry["kind"]), []).append(entry)
    days = []
    for n in range((end - start).days + 1):
        day = str(start + timedelta(days=n))
        entries = by_day.get(day, [])
        summary = summarize_entries(entries)
        goal = effective_goal(goals, day)
        weights = tracked.get((day, "weight"), [])
        weight = max(weights, key=lambda r: (r["occurred_at"], r["id"]), default=None)
        water = tracked.get((day, "water"), [])
        days.append(
            dict(
                date=day,
                logged=bool(entries),
                logging_status="logged_incomplete" if entries else "unlogged",
                **{k: summary[k] if entries else None for k in NUTRIENTS},
                known_totals=summary["known_totals"] if entries else {k: None for k in NUTRIENTS},
                partial=summary["partial"],
                targets=goal,
                calorie_status=progress(summary, goal)["calories"]["status"],
                # Nutrient source claims remain in original snapshots, not upgraded by analytics.
                nutrition_status="recorded_snapshot" if entries else "missing",
                nutrition_sources=sorted(
                    {
                        e.get("details", {})
                        .get("canonical_item", {})
                        .get("source", {})
                        .get("verified_status", "legacy_unknown")
                        for e in entries
                    }
                ),
                estimated=any(
                    e.get("details", {})
                    .get("canonical_item", {})
                    .get("portion", {})
                    .get("estimated", False)
                    for e in entries
                ),
                weight=weight["value"] if weight else None,
                weight_source=weight["source"] if weight else None,
                water=total(water) if water else None,
                water_sources=sorted({r["source"] for r in water}),
            )
        )
    logged = [d for d in days if d["logged"]]
    measured = [d for d in days if d["weight"] is not None]
    watered = [d for d in days if d["water"] is not None]
    eligible = [
        d
        for d in logged
        if d["calories"] is not None and d["targets"] and d["targets"]["calorie_target"] is not None
    ]
    statistics = dict(
        logged_days=len(logged),
        unlogged_days=len(days) - len(logged),
        measured_days=len(measured),
        water_logged_days=len(watered),
        average={
            **{k: average([d[k] for d in logged]) for k in NUTRIENTS},
            "weight": average([d["weight"] for d in measured]),
            "water": average([d["water"] for d in watered]),
        },
        partial_days={k: sum(d["partial"][k] for d in logged) for k in NUTRIENTS},
        calorie_in_range=sum(d["calorie_status"] == "in_range" for d in eligible),
        calorie_eligible_days=len(eligible),
        insufficient_data=len(logged) < len(days),
        logging_complete=False,
    )
    return {"from": str(start), "to": str(end), "days": days, "statistics": statistics}


class Trends:
    def __init__(self, database):
        self.database = database

    def get(self, owner, start, end):
        date_range(start, end)
        try:
            previous_end = start - timedelta(days=1)
            previous_start = start - timedelta(days=(end - start).days + 1)
        except OverflowError:
            raise ValueError("The prior comparison falls outside supported dates.") from None
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            # One range read each, never one database query per chart point. Existing
            # owner/day indexes.
            meals = [
                Journal._public(r)
                for r in db.execute(
                    "SELECT * FROM meals WHERE user_id=? AND day BETWEEN ? AND ?",
                    (owner, str(previous_start), str(end)),
                ).fetchall()
            ]
            measurements = [
                dict(r)
                for r in db.execute(
                    "SELECT * FROM tracking_entries WHERE user_id=? "
                    "AND kind IN ('water','weight') AND deleted=0 AND local_date BETWEEN ? AND ?",
                    (owner, str(previous_start), str(end)),
                ).fetchall()
            ]
            # One winning revision per date plus the effective baseline. No unbounded goal
            # history read.
            revisions = [
                dict(r)
                for r in db.execute(
                    "SELECT g.* FROM user_nutrition_goal_revisions g WHERE g.user_id=? "
                    "AND g.effective_local_date BETWEEN ? AND ? AND NOT EXISTS (SELECT 1 "
                    "FROM user_nutrition_goal_revisions n WHERE n.user_id=g.user_id "
                    "AND n.effective_local_date=g.effective_local_date AND n.version>g.version)",
                    (owner, str(previous_start), str(end)),
                ).fetchall()
            ]
            baseline = db.execute(
                "SELECT * FROM user_nutrition_goal_revisions WHERE user_id=? "
                "AND effective_local_date<? "
                "ORDER BY effective_local_date DESC,version DESC LIMIT 1",
                (owner, str(previous_start)),
            ).fetchone()
            if baseline:
                revisions.append(dict(baseline))
            for revision in revisions:
                revision.pop("user_id", None)
            goals = {"revisions": revisions}
            current = period(start, end, meals, measurements, goals)
            previous = period(previous_start, previous_end, meals, measurements, goals)
            comparison = {}
            for key, value in current["statistics"]["average"].items():
                before = previous["statistics"]["average"][key]
                comparison[key] = (
                    float(Decimal(str(value)) - Decimal(str(before)))
                    if value is not None and before is not None
                    else None
                )
            return dict(
                current=current,
                previous=previous,
                comparison=comparison,
                comparison_basis="preceding_equal_length",
                schema_version=1,
            )
