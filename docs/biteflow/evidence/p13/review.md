# Independent P13 review

Reviewer: fresh-context `p13_final_review`, GPT-6-astra/high; one read-only review of `8ce7ad3889813276d63d4d4e016299605eafa507..4c0bcb65f6b6e91b276c14c8badb6ef93def6b04`. No reviewer writes, production operations or sub-delegation. Evidence metadata/Android UI/cleanup were still being completed by the implementer. No second review dispatched.

## Returned findings

Critical: none. Minor: none. Important/P2: `src/foodlogger/privacy.py` fetched up to50,001 rows and encoded the table before enforcing10MiB, allowing excessive memory use. The reviewer used an in-memory SQLite probe with600 payloads shaped from valid CustomMealCreate data:20,405,400 payload bytes materialized before checking10,485,760-byte limit. This is a resource-bound defect, not just a claim about eventual413. The first probe's interpreter resolved the primary checkout; retry with explicit PYTHONPATH=src tested the reviewed source. No full suite rerun by reviewer.

Strengths reported: explicit owner-column privacy boundary and inventory; logout/session fences and finally cleanup; missing/partial/converted chart values; matching source-tree manifest and honest acceptance boundaries; checksum/write/deletion/other-owner restore evidence.

## Fix verification

The implementer added `test_oversized_archive_stops_reading_before_materializing_large_account`:100 valid large-metadata meal rows, low byte budget, instrumented actual SQLite fetch. RED observed100 rows fetched before rejection (1fail/8pass). Implementation now reads SQL pages of32, checks each encoded row before accumulation, retains the same snapshot/order, cumulative row limit and complete-envelope byte check. SQL LIMIT bounds PostgreSQL driver buffering too; fetchmany alone was not used. GREEN:9/9 privacy tests. Additional small-page complete archive/row-limit test and PostgreSQL restricted-role multipage coverage protect against dropped rows and changed semantics. Full post-fix suites/results appear in checkpoint and command ledger.

This bounds row buffering; the10MiB figure is a response cap, not a strict process-RSS cap. Individual stored payload sizes and DB sorting/query cost still depend on existing validated write contracts and backend limits. Production-scale performance remains a staging gate.

## Considered behavior declined to judge — preserved

1. Actual OS share-sheet retention, physical file protection, screen-reader behavior, native device lifecycle: external acceptance remains blocked. New local Android share-sheet cancellation smoke is narrow evidence, not broad erasure proof.
2. Hosted recovery/concurrent writers, production roles/signing, provider policy and live recognition quality: remain release gates; local synthetic fixtures do not stand in for them.
3. Android smoke and final evidence/resource cleanup after reviewed head: executor records observed results and artifact reconciliation separately.

Reviewer assessment: local checkpoint requires the Important fix; subject to fix/evidence reconciliation, local P13 handoff is supported. Full acceptance/production remains BLOCKED; no merge, release or P14 authorized.
