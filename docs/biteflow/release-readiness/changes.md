# Exact implementation commits and file inventory

Branch `codex/biteflow-rc00-05`, base `e7f7c9d`; final product source `5455c49`. Later documentation/evidence commits do not change the tested product.

## Logical local commits

- `a10a17b` — docs(rc00): freeze local release scope and inherited gate register
- `3a3c31c` — feat(rc03): retain optional basis correction snapshots in canonical readers
- `2a6cab0` — feat(rc03): preserve and display basis corrections across reviewed inputs
- `6297845` — feat(rc04): add durable versioned meal edits and journal invalidation
- `d2cb0b4` — feat(rc04): reuse shared review for saved meals with guarded retries
- `7b3b908` — feat(rc05): recover private export files across cold starts and failed cleanup
- `25e4ebf` — test(rc04): verify edited meals preserve goals and refresh native consumers
- `0b2844d` — fix(rc02): update shipping pip to patched installer release
- `1e9f0d6` — fix(rc01): build Expo modules from source for the local Swift toolchain
- `6d9366d` — fix(rc02): pin patched xcode uuid and test build plugins in Node
- `a00943e` — fix(rc02): patch image library and remove runtime installer; stage checkpoint evidence
- `5455c49` — fix(rc04): reload moved meals by stable group identity

## Changed files at implementation checkpoint

Status is Git A/M; paths are repository-relative. Raw logs and final evidence added later are catalogued by archive-manifest.json.

```text
M	Dockerfile.free
A	docs/biteflow/evidence/release-readiness/RC00/backend-baseline.json
A	docs/biteflow/evidence/release-readiness/RC00/backend-baseline.log
A	docs/biteflow/evidence/release-readiness/RC00/environment.json
A	docs/biteflow/evidence/release-readiness/RC00/mobile-baseline.json
A	docs/biteflow/evidence/release-readiness/RC00/mobile-baseline.log
A	docs/biteflow/release-readiness/RC00.md
A	docs/biteflow/release-readiness/RC01.md
A	docs/biteflow/release-readiness/RC02.md
A	docs/biteflow/release-readiness/RC03.md
A	docs/biteflow/release-readiness/RC04.md
A	docs/biteflow/release-readiness/RC05.md
A	docs/biteflow/release-readiness/dependency-disposition.md
A	docs/biteflow/release-readiness/gate-register.md
A	docs/superpowers/plans/2026-10-18-biteflow-release-readiness.md
M	mobile/app.config.ts
M	mobile/package-lock.json
M	mobile/package.json
M	mobile/plugins/__tests__/widgets.test.js
A	mobile/src/api/__tests__/basis-capability.test.ts
A	mobile/src/api/__tests__/canonical-edit.test.ts
M	mobile/src/api/endpoints.ts
M	mobile/src/api/types.ts
M	mobile/src/app/(app)/meal/[id].tsx
A	mobile/src/app/(app)/meal/edit/[id].tsx
M	mobile/src/auth/AuthProvider.tsx
M	mobile/src/auth/__tests__/private-cleanup-navigation.test.tsx
M	mobile/src/auth/__tests__/rollback-export-cleanup.test.tsx
M	mobile/src/components/MealAnalysisReview.tsx
M	mobile/src/components/MealFoodEditor.tsx
M	mobile/src/components/__tests__/AccountExport.test.tsx
A	mobile/src/components/__tests__/MealEdit.test.tsx
A	mobile/src/components/__tests__/MealEditPropagation.test.tsx
A	mobile/src/components/__tests__/MealEditRoute.test.tsx
M	mobile/src/components/__tests__/MealFoodEditor.test.tsx
M	mobile/src/data/DraftProvider.tsx
M	mobile/src/data/__tests__/journal.test.ts
M	mobile/src/data/journal-store.ts
M	mobile/src/data/save-draft.ts
A	mobile/src/domain/__tests__/basis-correction.test.ts
M	mobile/src/domain/canonical.ts
M	mobile/src/domain/drafts.ts
M	mobile/src/domain/library.ts
M	mobile/src/domain/meal-analysis.ts
A	mobile/src/domain/meal-edit.ts
M	mobile/src/domain/unified-review.ts
M	mobile/src/i18n/locales/en.ts
M	mobile/src/i18n/locales/he.ts
M	mobile/src/native/health/__tests__/android.test.ts
M	mobile/src/native/health/__tests__/plugin.test.ts
M	mobile/src/storage/__tests__/export.test.ts
A	mobile/src/storage/__tests__/private-cleanup-process.test.js
A	mobile/src/storage/__tests__/private-cleanup-recovery.test.ts
M	mobile/src/storage/account-data.ts
M	mobile/src/storage/export.ts
A	mobile/src/storage/private-cleanup-recovery.ts
M	mobile/src/storage/validation.ts
A	mobile/src/test-fixtures/cleanup-process.cjs
M	src/foodlogger/app.py
M	src/foodlogger/domain.py
A	tests/test_basis_correction.py
M	tests/test_goals.py
```

To inspect any commit locally: `git show --stat <sha>` or `git show <sha>`. No commit was pushed/merged/deployed. Preserve the compatibility floor described in checkpoint-RC00-05.md; this list is not a blanket revert instruction.
