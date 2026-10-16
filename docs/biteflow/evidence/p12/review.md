# Independent P12 review

One fresh gpt-6-astra reviewer read immutable `a2fac88..26341ac`, the approved roadmap/spec, design/plan, complete diff and decision ledger. Read-only; no secondary review. Verdict: with fixes. 0 Critical, 4 Important, 0 Minor.

1. Pending preference restore/enable could bind a new session after logout's initial clear or disable. Three deferred-promise tests failed, then passed. Auth now explicitly closes widget authorization synchronously; all preflights capture a generation, and every stop invalidates it. New starts remain disabled until Auth opens a current account.
2. Native readers validated the old snapshot zone rather than the device's new Today. Kotlin/Swift Honolulu-to-Tokyo tests failed, then passed. Both readers now also validate the current device-local date of update and read.
3. Missing App Group capability caused unconditional startup clearing to permanently block ordinary logging. Host test failed, then passed. A fresh unavailable installation degrades safely; a non-sensitive durable local prior-data marker retains the privacy gate if previously written shared data cannot be cleared. Three capability/clear checks pass. Real signing/storage-loss/reinstall remains a gate.
4. Widget extension Info.plist omitted CFBundleName. Actual simulator installation and generated-metadata assertion failed. Generator now supplies a nonempty name; metadata assertion passes. Repeat native installation evidence is separately recorded in checkpoint.

Reviewer declined device signing/provisioning, actual gallery/size/large-text/Hebrew rendering, cached-pixel clearing/lock behavior, and background/killed refresh latency. All remain explicit acceptance gates unless supported by narrowly described simulator observations; no physical-device claim.

Author verification before review also fixed water source freshness, stale publisher cleanup capture, deletion cleanup ordering, native numeric coercion and extension module-name collision. Failing and passing logs are retained. Full-suite and native verification after the fix pass is in commands.jsonl. No re-review is claimed.
