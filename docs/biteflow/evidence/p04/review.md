# Independent P04 critical review

Fresh-context reviewer: `/root/p04_final_review`, GPT-6-astra/high. Read-only review of exact range `714bbf3..0bb5262` using the skill review package, approved requirements/roadmap, P01–P03 checkpoints and execution rulings. No implementation delegation or second review. Reviewer inspected source, executed in-memory TypeScript probes and a read-only query in the disposable PostgreSQL container; it did not rerun the executor's suites or modify files.

**Reviewer assessment: five Important findings, no Critical, no additional Minor. Not ready to merge without fixes.** No push, merge or release is authorized. The fixes below were implemented by the primary agent with failing regressions first.

| Finding / original location | Reproduction and impact | Fix / evidence |
|---|---|---|
| Recurring fractional serving drafts invalid; `mobile/src/domain/library.ts:48,60` | 100 g / yield 3 becomes a decimal string with more than four fractional digits; keyboard parser rejects it, so review/save fail | Generated validated original quantities retain precision while unchanged; direct scaling avoids a rounded intermediate ratio. `library.test.ts` persists/restores, validates, previews and calls save. RED → GREEN |
| Invalid yield crashes editor; `components/RecipeEditor.tsx:46` | `.` / `1..` / `1.00001` parses as NaN and reaches exact arithmetic | Finite guard renders unknown per-serving values and disables save; valid input recovers. Component regression RED → GREEN |
| PostgreSQL minimum yield rejected; migration `20261014052225_p04_recipes.sql:10` | `0.01::real::double precision` is 0.009999999776482582, below the numeric CHECK boundary | New `20261014055032_p04_recipe_yield_decimal.sql` uses NUMERIC, decimal write strings and explicit JSON number serialization. Actual restricted-role create/update/round-trip for 0.01, 0.3333 and 3.125 RED → GREEN |
| Original portion provenance dropped; `domain/library.ts:47`, `domain/unified-review.ts:32` | 1 estimated bowl / 100 g / conversion ID became 100 g, estimated=false without user editing | Preserve validated canonical original portion, quantity/unit/conversion and estimation status through repeat/copy/recipe; scale original and normalized quantities together. Unchanged/scaled/edit/cache-corruption regressions RED → GREEN. Separate explicit basis-correction gate remains open |
| Reload leaves parent stale; `components/RecipeEditor.tsx:42`, `app/(app)/recipes/[id].tsx:32,34` | Editor reloads v2 but parent Delete/Duplicate still sends v1 | Explicit reload callback reconciles current parent entry/history. Route-level external edit→reload→duplicate/delete regression RED → GREEN |

Initial regression run also hit an unsupported Jest dynamic import; changed test imports to static and reran RED, confirming the intended failures before implementation. All ten targeted mobile tests passed after fixes. The new PostgreSQL boundary test failed before the migration and passed afterward.

Final whole-suite evidence after review fixes: 369 backend passed / 9 documented skips (20 PostgreSQL cases); 181 mobile passed / 35 suites; typecheck, lint, Ruff and format passed. Two temporary lint warnings were duplicate imports in a new test, corrected and rerun. Final Python package, both JS exports and private-schema restore passed. No second independent review was claimed.

The reviewer specifically praised shared atomic copy writes/receipts/tombstones, immutable recipe versions/logs, explicit DST resolution, frozen-nutrition zero-AI repeats, default-off flags and meaningful concurrency/owner tests.

## Decisions the reviewer left to the executor

Full native/physical E2E-05/06/07/accessibility; hosted CI/staging/provider gates; 20-group copy limit; retained deleted recipe history; carried P02/P03 defects; and existing normalized ingredient storage bounds. Each disposition and cost is recorded in `progress.md` and the checkpoint. None was silently marked verified.

## Additional native QA finding

Maximum accessibility text in the Hebrew synthetic iOS preview showed nutrient captions truncated by `NutritionGrid`'s one-line cap. Removed that presentation cap and captured a new image with wrapped labels; reran all 181 mobile tests, types, lint and both platform JS exports. This local visual fix does not establish complete device/accessibility acceptance. Test harness routing, physical devices, full native save flows and Android layouts remain outside this limited preview.
