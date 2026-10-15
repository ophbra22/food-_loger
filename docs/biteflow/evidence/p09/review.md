# Independent P09 review

One fresh-context gpt-6-astra/high reviewer examined immutable `a16d75d2c38f2caddc82fcbb0dc1a97871e2be3f..bf2adbcc3c0f4f9c18e08dea4298455d8b7a889d`, read-only, no subagents/network/shared PostgreSQL operations. Verdict **With fixes**; no Critical or Minor findings. Reviewer ran 29 targeted backend tests and isolated pure/SQLite reproductions. Parent has separately verified the final fixes; no second review was requested.

Important findings (candidate file lines):

1. `src/foodlogger/habits.py:273` / `auth.py:235`: PostgreSQL logout did not serialize with final dispatch, permitting handoff after successful logout. Fix: owner lock in revoke_session plus concurrent-erasure idempotence. Actual PostgreSQL lock regression failed before fix and passed after.
2. `habits.py:164`: an offline logout could strand the Expo token under the old account after the readiness lease expired. Fix: device-only secure installation proof, monotonically persisted generation, sorted owner locks and guarded account transfer; raw token knowledge cannot take ownership, old-generation requests cannot reclaim the registration. SecureStore failure/corruption suppresses. New protocol and device identity tests failed then passed.
3. `habits.py:84`: nonexistent 02:56–02:59 spring-gap slots could fire at 03:00. Fix: wall-time UTC round-trip validation; four parameterized regressions failed then passed.
4. `habits.py:275`: five-second deadline excluded final query time. Fix: final elapsed/slot/date/quiet/earliest device-session lease check immediately before transport. Slow-query, slot-boundary and secondary-lease regressions verified; slow/lease cases failed before their fixes.

Every behavior the reviewer declined to judge, and the executor's decision/cost, is preserved in `ledger.md`: physical/native acceptance; credentials/consent/signing/deployment; OS delivery/recall; offline lease window; closed/stale-device suppression; unregistered clients; scheduler/monitoring/receipts/privacy/retention/hosted restore; large-history performance; historical-date/streak/slot/cooldown semantics; inherited gates; parent-owned mobile/Android verification. None was silently closed.
