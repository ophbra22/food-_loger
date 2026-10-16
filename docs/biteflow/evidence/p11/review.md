# Independent P11 review and one fix pass

Reviewer: fresh `/root/p11_final_review`, GPT-6-astra/high, invoked under executing-plans. Immutable reviewed range: `579a006f5e947a651283e32659684c8b0cf6f3f8..e0b7f0c15dac9e9c658a185472f394b62e41b117`. The original diff is reproducible from Git. Reviewer raised **3 Important, 0 Critical, 0 Minor** findings. Author confirmed all three; fix commit `7b78d84`. No re-review or real-device certification claimed.

| Finding | Reproduction and fix | Final verification |
|---|---|---|
| Denied pending weight page starves authorized steps | `review-queue-red.log`: 1 failed/10 passed. Persist independent pending pages per kind; preserve compatible earlier local queue shape. | Full mobile 362/362; new independent-permission and legacy-page restoration cases. |
| Lost import ack misses cache refresh on idempotent replay | `review-cache-red-corrected.log`: 3 assertion failures, 12 filtered skips, after fixing a Jest dynamic-import harness mistake. Force loaded weight/global summary invalidation after acknowledged weight batches even when changed dates are empty. | Targeted review-mobile-green 51/51; final mobile 362/362 includes moved dates/deletions and previous/latest/delta refresh. |
| One exact-ID deletion error aborts unrelated sync work | Native RED failed on missing result interface; JS regression reproduced dropped progress. Add per-item applied/failed results, acknowledge only successes, retain failed deletion and repair notice; imports/other exports continue. | 12/12 native JVM tests with fake deletion failure; final mobile 362/362; Android Debug/Release builds. |

An intermediate `review-recovery-green.log` exited 1; its name is not a pass claim. Three cache cases initially failed due to unsupported dynamic import in the test harness, so a corrected static import and intentionally restored old behavior produced the genuine three assertion failures retained separately. All final suite outcomes are in commands.jsonl.

Reviewer explicitly did not certify API24–27 class loading/startup under the SDK override, actual provider permissions/missing-ID deletes/display/retry semantics, physical-device acceptance or production signing. These remain gates, with explicit rulings/costs in the archived ledger and checkpoint. Native lint additionally found API annotations and an inherited abortOnError=false setting; author fixed both. Full transitive lint still crashes in third-party Worklets analysis; focused module analysis passes with two advisory warnings.
