# P04 local evidence — 2026-10-14

This archive supports [the checkpoint](../../p04-checkpoint.md), not a release-readiness claim. Product range: `714bbf3..35c3669`, local branch `codex/biteflow-p04`. No push, merge, production action or P05 work occurred.

## Reading the record

- `commands.jsonl`: completed runner invocations with exact argv, working directory, duration and exit code. `logs/` preserves 78 command logs (trailing whitespace normalized for Git), including deliberately failing regressions and intermediate harness mistakes. A filename containing `green` is not proof of success; check exit status and subsequent successful run.
- `run.py`: the actual environment-isolating runner. It strips inherited database/provider/application variables, uses loopback Expo API/offline mode, and reads the disposable database URL from a private file. That URL/credential is deliberately **not archived**. This runner was executed from `.superpowers/sdd/roadmap/`; its relative-root calculation is specific to that original location. Recreate that scratch location and supply a newly created disposable database to reproduce it; do not point it at a hosted database.
- `restore-library.py`: the actual synthetic restore rehearsal, restricted to loopback `biteflow_p04_test`, with the repository's test-only role/password fixture. It creates and removes `biteflow_p04_restore_test`; no backup dump or operational credential is archived.
- `review.md` and `progress.md`: independent findings, reproductions/fixes, task history, every ruling and deferred issue. Earlier pending/running lines are historical events, not the final state.
- `changed-files.txt` and `commits.txt`: exact product range and logical commits. Documentation/evidence is committed separately after that range.

## Final verification

| Evidence log | Observed result |
|---|---|
| `postgres-p04-review-full.log` | 369 backend passed, 9 skipped; disposable PostgreSQL enabled, 20 PostgreSQL cases |
| `p04-large-text-mobile.log` | 181 passed, 35 suites, after the caption-wrap fix |
| `browser-p04.log` | 6 passed, 371 deselected; existing browser regression before review fixes |
| `p04-large-text-types.log`, `p04-large-text-lint.log` | Types/lint passed, no lint warnings |
| `p04-review-ruff.log`, `p04-review-format.log` | Ruff passed, 73 files formatted |
| `p04-review-python-build.log` | Final wheel/sdist built, new SQL packaged |
| `p04-large-text-export.log` | Final iOS and Android Hermes JavaScript exports passed; not native binary builds |
| `postgres-p04-restore-final.log` | Restored exact snapshots/history/favorite/receipts; retry deduplication and deletion protection passed |

The nine backend skips are six opt-in browser cases (passed separately), two unavailable Lite-runtime checks and one opt-in ML case. Provider/HTTP test fixtures reject real external requests. No recognition-quality, quota or paid-cost result is claimed.

## Limited native observation

`native/` contains the **actual synthetic preview source/configuration**, plus visually inspected screenshots from an isolated iPhone 17 Pro / iOS 26.5 simulator. The package file is a copied harness manifest, not a product dependency change. The Metro configuration contains the observed local source paths; adapt those if recreating this preview.

An existing SDK57 FoodLogger development binary was installed into the disposable simulator and launched with `--initialUrl http://127.0.0.1:8088`. The harness renders real RecipeEditor, LibraryPanel and CopySelection components with synthetic fixtures/mock APIs. It does not exercise full routing, authentication, server persistence or production data. The preview's retry controls and cached entries are synthetic states, not evidence of a successful network operation.

Images:

- `recipe-en.jpg`: English recipe total/per-serving preview.
- `recipe-he-reload-limitation.jpg`: Hebrew reload capture with temporarily blank text-field values; cold relaunch rendered values. This is retained as a limitation, not a language-switch pass.
- `recipe-he-large-before.jpg`, `recipe-he-large-fixed.jpg`: maximum accessibility text before/after the nutrient-caption wrapping fix.
- `recipe-he-large-bottom.jpg`: scrolled large-text controls; this is not keyboard/assistive-technology validation.
- `library-he.jpg`, `copy-selection-he.jpg`: Hebrew Quick Add and initial copy-selection layouts only.

The initial harness failed to resolve `@/` aliases, then its private Metro resolver was corrected. The original and corrected Metro logs are retained. Final preview and main Metro sessions were deliberately interrupted during cleanup (exit 130); the runner was interrupted before it could append those two manifest entries. Their logs are retained as `metro-p04-preview-final.log` and `metro-p04-e.log`. Server startup/termination is not a test pass.

Full E2E-05/06/07, physical devices, Android layouts, native binary builds, VoiceOver/TalkBack, complete RTL/large-type checks and hosted CI/staging remain **unverified**.

## Cleanup and recovery

The owned PostgreSQL container `biteflow-p04-pg`, both local Metro listeners and simulator `BiteFlow-P04-Preview` were stopped; the disposable container/simulator were removed. Xcode tool defaults were restored to their initial empty values. The user's pre-existing simulator, original checkout and dependency symlinks were retained. Only this phase's private scratch workspace is removed after archiving and committing the evidence. The development worktree and branch remain available for review.

See [operations](../../p04-operations.md) for additive migrations, independent default-off flags, preserved history/receipts, and rollback/restore limitations. `SHA256SUMS` fingerprints the archived files; it is not an assertion that unexecuted gates passed.
