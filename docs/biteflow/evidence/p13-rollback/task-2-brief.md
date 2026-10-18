### Task 2: rollback rehearsal, plan and checkpoint

**Files:** `p13-release-plan.md`, `p13-open-gates.md`, a follow-up checkpoint and evidence under `evidence/p13-rollback/`.
**Interfaces:** task 1 switch names/status/compatibility floor are consumed verbatim; source hashes and build configuration identify the compatible local rollback profile. Original P13 evidence stays historical.
- [ ] Exercise a disabled local Android release bundle/build and record actual results; retain compiled cleanup/security code, preserve all native-off defaults. No signed-device claim.
- [ ] Replace blanket-revert guidance with an explicit stop/drain/compatible-build/cleanup/verify/re-enable sequence. Document the unsafe P12 boundary, cleanup failure/recipient limits, security fixes that must survive, backup/write/deletion reconciliation and unchanged external gates.
- [ ] Commit evidence and run one immutable-range independent review. Fix confirmed Important/Critical findings with RED→GREEN and rerun affected/full suites; archive decisions/results, remove only owned temporary resources and retain the branch. Stop before P14.
