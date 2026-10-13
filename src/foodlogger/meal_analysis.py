"""Image preparation, private short-lived result caching and reference grounding."""

import hashlib
import threading
import time
from collections import OrderedDict
from io import BytesIO
from uuid import uuid4

import numpy as np
from PIL import Image

from foodlogger.analysis_schemas import AnalysisOptions, AnalysisResult, AnalyzedFood
from foodlogger.images import InvalidImage, decode_image
from foodlogger.nutrition_reference import ReferenceCatalog, aggregate, scale_nutrients
from foodlogger.vision import configured_vision


def prepare_image(data: bytes):
    with decode_image(data) as decoded:
        if min(decoded.size) < 128:
            raise InvalidImage("Choose a photo at least 128 pixels on each side.")
        decoded.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        with decoded.convert("L") as gray:
            gray.thumbnail((256, 256))
            pixels = np.asarray(gray, dtype=float)
        warnings = []
        if pixels.mean() < 35:
            warnings.append("poor_lighting")
        # Texture/contrast heuristic, not a calibrated blur detector. Warn, don't reject.
        edge = np.diff(pixels, axis=0).var() + np.diff(pixels, axis=1).var()
        if edge < 30:
            warnings.append("low_detail")
        stream = BytesIO()
        decoded.save(stream, "JPEG", quality=90)  # strips EXIF/GPS; never stores the photo
        return stream.getvalue(), warnings


class AnalysisService:
    def __init__(self, provider=None, references=None, now=time.monotonic, *, gateway=None):
        self.provider = provider or configured_vision()
        self.gateway = gateway
        self.references = references or ReferenceCatalog()
        self.now = now
        self._cache = OrderedDict()
        self._lock = threading.Lock()

    def clear_user(self, user_id):
        with self._lock:
            for key in list(self._cache):
                if key[0] == user_id:
                    del self._cache[key]

    def analyze(self, images: list[bytes], options: AnalysisOptions, user_id: str, key: str):
        if not 1 <= len(images) <= 2:
            raise InvalidImage("Use one image and optionally a second angle.")
        fingerprint = hashlib.sha256(options.model_dump_json().encode())
        for data in images:
            fingerprint.update(hashlib.sha256(data).digest())
        digest = fingerprint.hexdigest()
        cache_key = (user_id, key)
        started = self.now()
        # A single bounded request slot is also enforced at the HTTP upload boundary.
        with self._lock:
            for old in list(self._cache):
                if started - self._cache[old][0] > 600:
                    del self._cache[old]
            if cache_key in self._cache:
                _, prior, result = self._cache[cache_key]
                if prior != digest:
                    raise ValueError("Request key was used for different images or context.")
                return result.model_copy(deep=True)
        prepared, warnings = [], []
        for data in images:
            clean, notes = prepare_image(data)
            if clean not in prepared:
                prepared.append(clean)
            warnings.extend(notes)
        observation, usage = (
            self.gateway.recognize(self.provider, prepared, options, user_id, key, digest)
            if self.gateway is not None
            else self.provider.recognize(prepared, options)
        )
        foods = []
        for food in observation.foods:
            candidates = self.references.search(food.search_name, food.preparation)
            # Every automatic reference is a proposed generic recipe, requiring review.
            reference = candidates[0] if candidates else None
            # Conservative guardrails, explicitly NOT empirical confidence intervals.
            spread = {"high": 0.25, "medium": 0.35, "low": 0.50}[food.confidence]
            if food.dish_type == "composite":
                spread = max(spread, 0.40)
            low = max(1, min(food.weight_min_g, round(food.estimated_weight_g * (1 - spread))))
            high = min(2000, max(food.weight_max_g, round(food.estimated_weight_g * (1 + spread))))
            row = food.model_dump()
            row.update(weight_min_g=low, weight_max_g=high)
            foods.append(
                AnalyzedFood(
                    **row,
                    reference=reference,
                    reference_alternatives=candidates[1:],
                    match_confidence="medium" if reference else "low",
                    requires_confirmation=True,
                    nutrients=scale_nutrients(
                        reference.nutrition.model_dump() if reference else {},
                        food.estimated_weight_g,
                    ),
                )
            )
        if foods:
            warnings.extend(["estimated_portions", "hidden_ingredients"])
        complete = bool(foods) and all(
            all(v is not None for v in f.nutrients.values()) for f in foods
        )
        if foods and not complete:
            warnings.append("missing_nutrition")
        result = AnalysisResult(
            analysis_id=uuid4().hex,
            meal_name=observation.meal_name,
            status=observation.status,
            foods=foods,
            total=aggregate([f.nutrients for f in foods]),
            complete_nutrition=complete,
            overall_confidence="low"
            if not complete or any(f.confidence == "low" for f in foods)
            else "medium",
            warnings=list(dict.fromkeys(warnings + observation.warnings)),
            provider=self.provider.name,
            model=self.provider.model,
            usage=usage,
            elapsed_ms=round((self.now() - started) * 1000),
        )
        with self._lock:
            self._cache[cache_key] = (self.now(), digest, result.model_copy(deep=True))
            while len(self._cache) > 32:
                self._cache.popitem(last=False)
        return result
