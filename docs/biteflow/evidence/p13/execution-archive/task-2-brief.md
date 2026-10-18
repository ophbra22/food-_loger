### Task 2: mobile archive and accessible chart values

**Files:** new account-export helper/component/tests; extend API, Settings, translations, private-file cleanup; `TrendsChart.tsx` and its tests.
**Interfaces:** server archive plus explicitly named account-local drafts/pending operations, independently timed (not a cross-device atomic snapshot). Capture account epoch before async work, validate before file creation/share; share only after explicit user action. Exclude SecureStore/native credentials. Temporary JSON is removed after share/cancel/failure; legacy CSV preserved. Chart has expandable accessible daily values respecting visible layers, missing data, language and units.
- [ ] Add failing tests for revoked account during export, wrong-owner response, cleanup success/failure, unavailable sharing and chart unknown/partial/unit/layer behavior.
- [ ] Implement with SDK57 APIs/current installed types; retain UI and data contracts. Run mobile test suite, typecheck and lint — expected PASS.
- [ ] Commit mobile privacy and accessibility changes.

