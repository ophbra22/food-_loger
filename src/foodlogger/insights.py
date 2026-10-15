"""Recorded facts and bounded bilingual templates; no unsupported dietary inference."""

from collections import OrderedDict
from copy import deepcopy
from datetime import timedelta
from threading import Lock
from time import monotonic

from foodlogger.meal_service import digest
from foodlogger.storage import summarize_entries
from foodlogger.trends import Trends, average


class DerivedCache:
    """Process-local, owner-separated, expiring derived data. Never credentials or raw prompts."""

    def __init__(self, limit=128, ttl=300, now=monotonic):
        self.limit, self.ttl, self.now = limit, ttl, now
        self.entries = OrderedDict()
        self.lock = Lock()
        self.generation = 0

    def get(self, owner, key):
        with self.lock:
            for k in list(self.entries):
                if self.entries[k][0] <= self.now():
                    del self.entries[k]
            value = self.entries.get((owner, key))
            if value is None:
                return None
            self.entries.move_to_end((owner, key))
            return deepcopy(value[1])

    def put(self, owner, key, value, *, generation=None):
        with self.lock:
            if generation is not None and generation != self.generation:
                return
            self.entries[(owner, key)] = (self.now() + self.ttl, deepcopy(value))
            self.entries.move_to_end((owner, key))
            while len(self.entries) > self.limit:
                self.entries.popitem(last=False)

    def forget(self, owner):
        with self.lock:
            self.generation += 1
            for k in list(self.entries):
                if k[0] == owner:
                    del self.entries[k]


def distribution(meals, start, end):
    result = []
    for category in ("breakfast", "lunch", "dinner", "snack"):
        rows = [m for m in meals if start <= m["day"] <= end and m["meal_type"] == category]
        days = sorted({m["day"] for m in rows})
        summaries = [summarize_entries([m for m in rows if m["day"] == day]) for day in days]
        result.append(
            dict(
                category=category,
                entry_count=len(rows),
                logged_days=len(days),
                calories_average=average([s["calories"] for s in summaries]),
                protein_average=average([s["protein"] for s in summaries]),
            )
        )
    return result


def sentences(trends, protein, language):
    s = trends["current"]["statistics"]
    a = s["average"]
    he = language == "he"

    def number(n):
        return "—" if n is None else f"{n:,.1f}".rstrip("0").rstrip(".")

    prior = trends["previous"]
    prior_cal = number(prior["statistics"]["average"]["calories"])
    prior_dates = prior["from"] + "–" + prior["to"]
    rows = [
        (
            "coverage",
            f"Recorded on {s['logged_days']} days; {s['unlogged_days']} days have no food logs."
            if not he
            else f"תועדו {s['logged_days']} ימים; ב־{s['unlogged_days']} ימים אין רישומי מזון.",
        ),
        (
            "averages",
            (
                f"Average on logged days: {number(a['calories'])} kcal, "
                f"{number(a['protein'])} g protein."
            )
            if not he
            else (
                f"ממוצע בימים מתועדים: {number(a['calories'])} קק״ל, "
                f"{number(a['protein'])} גרם חלבון."
            ),
        ),
        (
            "calories",
            (
                f"Calorie range met on {s['calorie_in_range']} of {s['logged_days']} logged days "
                f"({s['calorie_eligible_days']} with enough data and a goal)."
            )
            if not he
            else (
                f"טווח הקלוריות הושג ב־{s['calorie_in_range']} מתוך "
                f"{s['logged_days']} ימים מתועדים "
                f"({s['calorie_eligible_days']} עם נתונים ויעד)."
            ),
        ),
        (
            "protein",
            f"Protein goal met on {protein['met']} of {protein['eligible']} eligible days."
            if not he
            else (
                f"יעד החלבון הושג ב־{protein['met']} מתוך {protein['eligible']} "
                "ימים עם נתונים ויעד."
            ),
        ),
        (
            "comparison",
            f"Previous period {prior_dates}: average recorded calories {prior_cal} kcal."
            if not he
            else f"התקופה הקודמת {prior_dates}: ממוצע קלוריות מתועדות {prior_cal} קק״ל.",
        ),
        (
            "caution",
            (
                "Logs may be incomplete. Missing values are unknown; "
                "this is a summary of recorded food, not a measure of complete intake."
            )
            if not he
            else (
                "הרישומים עשויים להיות חלקיים. ערכים חסרים אינם ידועים; "
                "הסיכום מתאר מזון שתועד ולא בהכרח את מלוא הצריכה."
            ),
        ),
    ]
    return [dict(id=k, text=v) for k, v in rows]


class Insights:
    def __init__(self, database, cache=None):
        self.database = database
        self.cache = cache or DerivedCache()

    def get(self, owner, start, language="en"):
        if start.weekday() != 6:
            raise ValueError("A review week starts Sunday.")
        generation = self.cache.generation
        end = start + timedelta(days=6)
        trends, meals = Trends(self.database).snapshot(owner, start, end)
        days = trends["current"]["days"]
        eligible = [
            d
            for d in days
            if d["logged"]
            and d["protein"] is not None
            and d["targets"]
            and d["targets"]["protein_g"] is not None
        ]
        protein = dict(
            met=sum(d["protein"] >= d["targets"]["protein_g"] for d in eligible),
            eligible=len(eligible),
            logged=trends["current"]["statistics"]["logged_days"],
        )
        meals_by_type = distribution(meals, str(start), str(end))
        revision = digest(dict(trends=trends, meals=meals_by_type))
        key = "insight:" + language + ":" + revision
        cached = self.cache.get(owner, key)
        if cached is not None:
            return cached
        result = dict(
            schema_version=1,
            week_start=str(start),
            language=language,
            revision=revision,
            trends=trends,
            protein_achievement=protein,
            meal_distribution=meals_by_type,
            sentences=sentences(trends, protein, language),
            ai_status="not_requested",
        )
        self.cache.put(owner, key, result, generation=generation)
        return result
