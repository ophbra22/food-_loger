# Photo nutrition lookup diagnostic — 2026-10-20

Scope: investigation of the user's screenshot showing an estimated 120g omelet with missing core nutrition, while a bread roll has nutrition. Source inspected: `bf47fac` on `codex/biteflow-testflight-rc12-15`, with application implementation unchanged from TestFlight6. No product-code changes, deploy, push, production operation or live AI request during this diagnostic. The user's image was not submitted to a provider.

## Confirmed findings

1. **Missing name normalization.** `ReferenceCatalog.search()` requires all identity tokens to occur in the reference name (`src/foodlogger/nutrition_reference.py`). `omelette` and `egg omelette` return no records; Hebrew `חביתה` and `ביצים` also return none. The bundled data does contain `fdc:172185`, **Egg, whole, cooked, omelet**, with all four core nutrients. This is a lookup failure, not an absence of egg nutrition in the dataset.
2. **Unsafe candidate ranking/identity filtering.** `omelet` can select **Tomatoes as ingredient in omelet**. `egg omelet` with preparation `fried` selects **Egg substitute, omelet, scrambled, or fried, with vegetables**. A synonym-only patch would expose these wrong matches rather than solve the complete issue. A recipe ingredient, egg substitute, egg white and whole-egg dish must not be silently treated as equivalent.
3. **Weight and nutrition are separate.** `AnalysisService.analyze()` (`src/foodlogger/meal_analysis.py:86`) selects the first reference candidate; absent candidates lead to null nutrients while preserving the visual mass estimate. It adds `missing_nutrition`. `mobile/src/domain/meal-analysis.ts` computes display nutrition from the reference or manual inputs; nulls remain null. Changing the amount or g/ml basis does not retrieve nutrition.

## Deterministic reproduction

Used an in-memory synthetic 256×256 orange JPEG and a mocked vision provider returning a 120g omelet plus a 70g bread roll. No actual food photo or external model call. Both items otherwise had identical validated structures across runs. Omelet preparation was `fried`; roll was `baked`.

| Mocked omelet search identity | Selected omelet reference | Result |
| --- | --- | --- |
| `omelette` | None | 120g preserved; calories/protein/carbs/fat all null; roll has reference and values |
| `egg omelette` | None | Same missing-nutrition symptom |
| `omelet` | Tomatoes as ingredient in omelet | Non-null values for the wrong food |
| `egg omelet` | Egg substitute, omelet, scrambled, or fried, with vegetables | Non-null values for an unjustified substitute recipe |

The roll matched `Bread, roll, Mexican, bollilo`. This explains why one item can have values while another does not, but does **not** validate the identity or nutrition of the user's actual roll. These are retrieval/contract tests, not photo-recognition accuracy tests.

**Evidence limit:** the original live provider's `search_name` and untouched mobile draft were not captured. The exact missing spelling in the user's request is unknown. The screenshot, source trace and mocked reproduction establish a concrete failure path and additional matching defects; they do not establish the user's exact recipe or measured weight.

## Actual checks

| Command | Result |
| --- | --- |
| `.venv/bin/python -m pytest tests/test_meal_analysis_domain.py tests/test_meal_analysis_pipeline.py tests/test_food_providers.py -o addopts='' -q` | 33 passed in1.04s; 0failed/0skipped |
| In `mobile/`, Node24 `npm test -- --runInBand --watch=false src/domain/__tests__/meal-analysis.test.ts src/domain/__tests__/unified-review.test.ts` | 10 passed,2suites; 0failed/0skipped; existing Watchman recrawl warning |
| In `mobile/`, Node24 `npm run typecheck` | Exit0 |
| In `mobile/`, Node24 `npm run lint` | Exit0 |
| Four-case mocked pipeline reproduction above | All four observed results recorded; missing/wrong-match behavior remains unresolved |

Existing tests do not cover these omelet variants or the false-positive candidates. Their success does not close this defect.

## Required correction and acceptance

- Normalize supported English spelling variants and Hebrew food names without dropping recipe qualifiers or distinguishing ingredients.
- Exclude ingredient-only records and unrequested substitutes/egg-white recipes from whole-dish matches; retain preparation distinctions and uncertainty about added fats/cheese.
- Rank only appropriate whole-food candidates. A generic reference remains a proposal requiring review, not verified composition of the photographed meal.
- Add regressions for both absent and wrong matches, composite/unknown dishes, bread controls, amount scaling, missing values and source provenance.
- Existing drafts retain their original values until an explicit reference replacement; a server fix must not silently rewrite saved meals.

This is a blocker for accepting reliable automatic photo-to-nutrition matching. Physical RC12–RC15 and all inherited release gates remain open. No fix has been implemented by this verification-only diagnostic.
