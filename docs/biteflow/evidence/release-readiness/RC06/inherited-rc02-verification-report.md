# RC02 verification-only review at e70f17a

2026-10-18. Reviewed exact commit **e70f17ac2e888294aeb2f5402a7474c073d008b3** on `codex/biteflow-rc02-followup`, against `4952a63`. **RC02 remains BLOCKED.** The two implementation review fixes and local regression tests are verified. The checkpoint's claim that the complete dependency tree is valid is not supported and must not be accepted.

No tracked source, test, configuration or documentation file was changed. No commit, push, merge, deployment, production access/change, live AI call or schema migration. Only ignored local verification outputs were created. The existing `.venv` symlink is preserved. A disposable PostgreSQL17 container/volume bound to loopback was created for tests and removed, including temporary credentials. Routine HTTPX requests are blocked by the existing autouse test fixture; AI/provider environment configuration was removed by the verification runner.

## Review finding: complete dependency-tree claim is incorrect

**P2 / blocks RC02's dependency-compatibility acceptance.** [Checkpoint line60](../../docs/biteflow/release-readiness/RC02-followup.md#L60) says that a complete `npm ls` tree passed and that there is no invalid dependency tree. Its actual archived command was `npm ls decode-uri-component js-yaml sprintf-js uuid --all`, which is filtered to those packages. That filtered command passes again, but **fresh `npm ls --all --json` exits1 / ELSPROBLEMS**.

The root issue is installed **React19.2.3** versus `test-renderer1.3.0 → react-reconciler0.34.0`, whose peer range is **React^19.3.0**. These lock entries are identical at4952a63 ande70f17a; it is inherited, not introduced by this follow-up. The checkpoint mentioned a peer warning elsewhere but overclaimed the whole-tree result. Passing473 Jest cases does not make the dependency graph valid. Do not blindly upgrade React away from the Expo SDK's supported version; choose and verify a compatible testing dependency graph in a separately authorized implementation step. [Reproduction](npm-tree.json), [output](npm-tree.log), [baseline comparison](peer-finding.json).

No implementation regression was confirmed in the scoped review. The seven native SVG errors remain unresolved, as the checkpoint correctly states. This review does not claim a complete security or physical-device audit.

## Previously requested review fixes

1. **Optional autofocus: PASS locally.** In-memory execution of the oldfc51c6f plugin reproduces the missing optional autofocus declaration; the current plugin sets it and retains CAMERA permission. The current regression suite passes, and fresh inspection of all four preserved APKs shows camera/autofocus optional, with no implied camera requirement. [Proof](review-fix-result.json), [artifact inspection](evidence-and-artifacts.json).
2. **Expo config TypeScript error: PASS locally.** `app.config.ts` no longer depends on the unavailable global `__dirname`; resolution remains inside the CJS helper. Full Node24 `tsc --noEmit`, dependency check, Jest and fresh iOS/Android exports pass. The helper still rejects unexpected source/version and unapplied adaptation. [Typecheck](typecheck.json), [guard](dependency-guard.json), [Jest](jest.json).

The original independent review covered4952a63..fc51c6f. This verification checked the final fixes at e70f17a directly; no new delegated review or implementation was performed.

## Freshly executed checks

Exact arguments, current working directories, source commit, timestamps, exit codes and public flag values are in [commands.json](commands.json). Every command ran against e70f17a, with Node24.19.0 for mobile, Python3.11.14 for backend, and mocked AI. Counts do not add repeated cases or conflate deselection with a skip/failure.

| Check | Actual command / scope | Actual result |
| --- | --- | --- |
| Backend | `.venv/bin/pytest -q --junitxml=runtime/rc02-verify-e70f17a-20261018/backend.xml` | **664 passed,9 skipped,0 failures/errors**; includes29 disposable PostgreSQL tests |
| Browser | Same pytest, `-q -m browser`, browser opt-in enabled | **6 passed,667 deselected,0 skipped/failed**; these six were skipped in general run |
| Unique Python total | Union of the above runs | **670 passed,3 NOT RUN**:2 LiteRT and1 real-ML test |
| Mobile | `node node_modules/jest/bin/jest.js --runInBand --watch=false --json` | **473 passed in95 suites;0 failed/skipped/todo** |
| Regression comparison | Prior JUnit/Jest pass-case multiset versus fresh results | All473 mobile and670 Python pass cases retained; none missing or failed |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | **PASS**, exit0 |
| Mobile lint | `npm run lint` | **PASS**, exit0 |
| Python lint / formatting | `ruff check src tests scripts`; `ruff format --check src tests scripts` | **PASS**;111 files already formatted. Repository-wide archive/helper hygiene is outside this scoped result |
| Swift policies/files | Fresh `swiftc` compilation and execution of three test binaries | **29 checks PASS** |
| JVM Health/widgets | `:biteflow-widgets:testDebugUnitTest --rerun :biteflow-health:testDebugUnitTest --rerun` | **22 passed,0 failed/errors/skipped**; current generated disabled configuration, explicitly forced execution |
| Complete Android lint | `./gradlew lint --rerun-tasks ... --offline` | **Crash workaround PASS:**1075 of1075 tasks executed, no KaModule crash, exit0. **Clean lint FAIL:**7 SVG Errors,195 Warning occurrences,3 Hints across24 Debug XML reports; strict XML gate exits1 |
| Decoder/YAML guard and selected graph | `npm run check:dependencies`; filtered `npm ls ... --all` above | **PASS**, exit0; real-consumer/guard tests are included in473 |
| Whole installed npm tree | `npm ls --all --json` | **FAIL**, exit1; inherited React peer mismatch above |
| JS/Hermes exports | `expo export --platform ios --platform android --clear` in all-enabled and disabled modes | **4 bundles PASS**; compilation only, not physical/Hermes interaction |
| Python packaging | Fresh git archive ofe70f17a → wheel/sdist → offline installation into a fresh venv | **PASS**; all69 application files verified; report uses a new output directory and correctly reports BLOCKED/no real metrics |
| npm vulnerability audit | `npm audit --json --registry=https://registry.npmjs.org --userconfig=/dev/null` | **FAIL / BLOCKED**,49 High reported nodes;0 Moderate/Critical. Historical50-node result retained, see below |
| Shipping image Trivy | Trivy0.76.0, same pinned image, offline with cached DB, network disabled | **FAIL / BLOCKED**,164 OS package/advisory occurrences;44 High,58 Medium,61 Low,1 Unknown;71 distinct IDs,0 Python-package occurrences |
| Rollback | Reverse patches in disposable archives only | **PASS mechanically** for documented3 code commits/11 paths and all4 commits/313 paths; not an operational rollback approval |

[Parsed counts](test-and-scan-counts.json), [regression comparison](regression-comparison.json), [fresh lint XML details](lint-results.json), [packaging manifest](package-manifest-final.json).

The full lint command is not trusted solely by exit code: upstream `react-native-svg15.15.4` already sets `abortOnError false`. Five WrongConstant and two WrongThread errors are still present. All24 reports were inspected after the forced scan. App/own-module reports have no errors. The K1 fallback remains in generated configuration; no exclusions, suppressions or new dependency changes were added. The historical Kotlin negative control was validated through the preserved evidence; it was not injected again because this is a no-code-change review.

## Artifact and evidence verification, without rebuilding the native matrix

All **297 RC02 follow-up archive records plus305 original records** have matching stored/raw hashes. The current implementation matches its source manifest; e70f17a is documentation/evidence only aftera0fdb32. All **74 inherited gate rows** remain byte-identical.

The four preserved Android APKs were rehashed and inspected with actual `aapt2`/`apksigner`: optional camera/autofocus, capability/audio flags, missing temporary Kotlin probe and Android Debug signatures match both modes. Four preserved iOS simulator apps were checked against all **370 file hashes**, actual base Info.plist and widget-extension flags. Release apps contain the JS bundle; Debug apps expect Metro. These are **fresh integrity/metadata checks of previous native build outputs**, not new APK/Xcode builds, installation or store signing.

The corrected disabled iOS artifacts have neither speech nor microphone purpose key in base Info.plist. The previous rejected incremental artifacts are not accepted. Native regeneration must be clean when removing optional plugins. Existing en/he localized purpose strings still contain microphone/speech/Health descriptions even with capabilities off; this does not establish permission behavior or privacy compliance. Physical privacy gates remain open. The pinned speech57.1.1 native-source guards still match both installed files. [Artifact results](evidence-and-artifacts.json), [speech guard](speech-guard.json).

**NOT REPEATED in this review:** complete native Debug/Release build matrix in both modes; clean npm install; enabled-mode JVM/lint; full history secret scan; Python dependency-advisory scans. Their archived evidence was checked for integrity, not relabeled as fresh execution. **NOT RUN / still blocked:** Python3.12 full server suite, actual ML/LiteRT/provider inference, physical devices and permissions, signing/distribution, hosted CI/EAS/staging, operational/mixed-version data rollback, real photo benchmarks and post-release metrics.

## Security counts and remaining uncertainty

Fresh npm reports49 High nodes, versus50 in the checkpoint. `@testing-library/react-native` is absent from the fresh reported set; there are no added names, and the lockfile/source is unchanged. This is a **reporting delta, not a demonstrated remediation**; no inherited security gate was closed. braces/node-forge root exposure remains. The old50-node report and current49-node report are both retained. Do not infer that the removed reported node is now verified safe. [Exact comparison](audit-comparison.json).

The fresh offline image scan reproduces164 OS occurrences using the DB snapshot from2026-10-18T13:11:41Z; it is not a newly downloaded intelligence snapshot. No FixedVersion was reported in that scan. No production image was rebuilt/replaced and no model/server was invoked. The native SVG findings and dependency compatibility failure are distinct from vulnerability counts.

## Rollback safety

The documented inverse order **a0fdb32 → fc51c6f →92c9f55** restored all11 code/config/test paths to4952a63 in an isolated archive. A second full-history drill additionally reversed e70f17a first using binary/full-index patches and restored313 changed paths, including evidence. Neither touched the live checkout or user data. [Drill results](rollback-result.json).

This proves reversibility of files only. Those reversions restore known vulnerable dependency paths and the Android lint crash, so they are **not approved release/downgrade candidates**. Prefer a narrow forward correction. Keep package.json, lockfile and guarded decoder adapter compatible; removing the adapter alone while retaining decoder0.5 breaks its CommonJS consumer. Reinstall matching dependencies and cleanly regenerate native projects for any separately authorized isolated comparison.

No database migration/schema change occurred. Backend, mobile data/cleanup logic, native modules, Dockerfile and Python configuration are unchanged by RC02. Preserve RC03 provenance original snapshots/readers/capability negotiation; schema3 drafts at the existing draft:v2 key; exact pending PATCH operations/receipts; RC05 cold-start and signed-out cleanup retry; P13 CSV/privacy/security fixes; label drafts, measurement operations, notification leases, Health receipts and widget cleanup. The historical P13 APK is not a validated RC03–05 downgrade. Physical/mixed-version/data recovery remains unverified.

## Required to close RC02

| Requirement | Can be done locally | External access / approval boundary |
| --- | --- | --- |
| Correct the checkpoint's dependency-tree claim and retain this peer mismatch as OPEN | Evidence/document correction in a separately authorized change | This verification does not edit the checkpoint |
| Resolve React/testing peer incompatibility with an Expo-compatible graph | Candidate selection, clean install, full unfiltered tree check, consumer/regression/native tests | Upstream compatible versions may be needed; no blind React/Expo major upgrade |
| Resolve braces/node-forge and remaining relevant High exposures | Patched compatible candidate or tested replacement; complete audit and per-finding analysis | Upstream availability; reviewed security disposition/owner decisions. “Dev only” is not sufficient |
| Resolve relevant OS image findings | Patched image candidate or supported per-finding applicability/mitigation evidence, preserving liblzma/installer fixes; repeat image and runtime checks | Upstream fixes and security ownership; any production replacement needs separate approval |
| Resolve/disposition all7 SVG lint errors | Tested correction or supported per-finding determination; rerun full lint and inspect XML, with no blanket suppression | Physical rendering/performance/privacy behavior remains a separate device gate |
| Revalidate the final compatible candidate | Full tests, typecheck, lint, packaging and two-mode native matrix; guard checks; honest failed/skipped counts | Hosted CI/staging and physical/signing tests require their own access/approval |

K1 currently executes the full analysis; switching back to K2 is not necessary merely to claim this bounded workaround works. Revalidate K2 when the compatible toolchain changes; do not silently mark the upstream K2 defect fixed. Original warnings stay with RC06; they are not erased. All74 inherited gates stay open at their recorded scope, including exact10% macro behavior, AI quotas/policies, photo protocol/held-out data, basis-correction mixed-version behavior, retention/legal approval and real measurements. Those are not made safe by local passing tests.

Local code changes may resume only after the user's next instruction. This review itself provides no production, AI, push, deployment or later-phase approval.
