### Task 4: reviewable candidate and checkpoint

**Files:** `p13-release-plan.md`, `p13-open-gates.md`, `p13-checkpoint.md`, immutable source/build manifest and review evidence; roadmap/matrix updates.
**Interfaces:** source/build hashes, default-off feature scope, release notes/user guidance, staging/canary prerequisites, named role owners, proposed measurable stop thresholds and exact compatible rollback. All inherited gates copied without silently closing them.
- [ ] Prepare local candidate; staging/canary remain unexecuted and blocked pending explicit scope/access/approval. No production-ready claim.
- [ ] Dispatch one independent review of immutable branch range. Fix confirmed Important/Critical issues with failing-first regressions, rerun affected/full suites. Document deferred minors and every decision.
- [ ] Archive evidence/ledger, remove only owned temporary resources, retain branch/worktree and .venv. Stop before P14.
