# Executed verification commands

All commands ran locally with fixture data/mocked AI. Early RED and diagnostic failures are retained. A zero exit is a command result, not automatic task/release acceptance. Counts and skip explanations are in the checkpoint. No summing repeated runs. Runtime is executor wall time; test runners may report a smaller duration.

Final command records capture source commit, UTC start and public flags. Earlier records without these fields are intermediate evidence from this wave; do not infer an exact commit/time they did not capture. The checkpoint identifies the final implementation. Output larger than150KB is losslessly gzipped; archive manifest records raw and stored hashes.

| Record | Exit | Seconds | Command (cwd in linked JSON) |
|---|---:|---:|---|
| [android-build-disabled-final](../evidence/release-readiness/RC01/android-build-disabled-final.json) | 0 | 236.55 | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a '-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=2 --no-build-cache --console=plain` |
| [android-build-disabled-retry](../evidence/release-readiness/RC01/android-build-disabled-retry.json) | 1 | 96.88 | `./gradlew clean :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a '-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=2 --no-build-cache --console=plain` |
| [android-build-disabled](../evidence/release-readiness/RC01/android-build-disabled.json) | 1 | 126.89 | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` |
| [android-build-enabled](../evidence/release-readiness/RC01/android-build-enabled.json) | 0 | 172.38 | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` |
| [android-final-all-enabled](../evidence/release-readiness/RC01/android-final-all-enabled.json) | 0 | 170.32 | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a '-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=2 --no-build-cache --console=plain` |
| [android-final-disabled](../evidence/release-readiness/RC01/android-final-disabled.json) | 0 | 15.75 | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a '-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=2 --no-build-cache --console=plain` |
| [android-lint-3132-enabled](../evidence/release-readiness/RC01/android-lint-3132-enabled.json) | 1 | 5.55 | `./gradlew :app:lintDebug :biteflow-widgets:lintDebug :biteflow-health:lintDebug -Pandroid.experimental.lint.version=31.13.2 --console=plain` |
| [android-lint-8132-enabled](../evidence/release-readiness/RC01/android-lint-8132-enabled.json) | 1 | 45.01 | `./gradlew :app:lintDebug :biteflow-widgets:lintDebug :biteflow-health:lintDebug -Pandroid.experimental.lint.version=8.13.2 --console=plain` |
| [android-lint-full](../evidence/release-readiness/RC01/android-lint-full.json) | 1 | 103.6 | `./gradlew :app:lintDebug :biteflow-widgets:lintDebug :biteflow-health:lintDebug --console=plain` |
| [android-lint-override-enabled](../evidence/release-readiness/RC01/android-lint-override-enabled.json) | 1 | 32.37 | `./gradlew :app:lintDebug :biteflow-widgets:lintDebug :biteflow-health:lintDebug -Dlint.version=31.13.2 --console=plain` |
| [android-regenerate-disabled](../evidence/release-readiness/RC01/android-regenerate-disabled.json) | 0 | 2.94 | `npx --no-install expo prebuild --clean --no-install --platform android` |
| [audit-initial](../evidence/release-readiness/RC02/audit-initial.json) | 1 | 7.37 | `npm audit --json` |
| [backend-baseline](../evidence/release-readiness/RC00/backend-baseline.json) | 0 | 32.57 | `.venv/bin/python -m pytest -q -rs` |
| [backend-final](../evidence/release-readiness/final/backend-final.json) | 0 | 34.71 | `.venv/bin/python -m pytest -q -rs --junitxml=runtime/rc00-05-20261018/backend-final.xml` |
| [backend-pre-review](../evidence/release-readiness/final/backend-pre-review.json) | 0 | 62.13 | `.venv/bin/pytest -q -rs --junitxml=runtime/rc00-05-20261018/backend-pre-review.xml` |
| [backend-rc03-final](../evidence/release-readiness/RC03/backend-rc03-final.json) | 0 | 3.3 | `.venv/bin/python -m pytest -q tests/test_basis_correction.py tests/test_canonical_domain.py tests/test_meal_service.py tests/test_partial_compatibility.py` |
| [backend-rc03](../evidence/release-readiness/RC03/backend-rc03.json) | 0 | 65.41 | `.venv/bin/python -m pytest -q -rs` |
| [backend-rc04-detail](../evidence/release-readiness/RC04/backend-rc04-detail.json) | 1 | 1.33 | `.venv/bin/pytest -q tests/test_goals.py -k rc04` |
| [backend-rc04-final](../evidence/release-readiness/RC04/backend-rc04-final.json) | 0 | 18.74 | `.venv/bin/python -m pytest -q tests/test_goals.py tests/test_meal_service.py tests/test_health.py tests/test_health_connect.py` |
| [backend-rc04-regression](../evidence/release-readiness/RC04/backend-rc04-regression.json) | 1 | 7.78 | `.venv/bin/pytest -q tests/test_goals.py tests/test_meal_service.py tests/test_health.py tests/test_health_connect.py` |
| [backend-rc04-regression2](../evidence/release-readiness/RC04/backend-rc04-regression2.json) | 1 | 8.5 | `.venv/bin/pytest -q tests/test_goals.py tests/test_meal_service.py tests/test_health.py tests/test_health_connect.py` |
| [backend-rc04-regression3](../evidence/release-readiness/RC04/backend-rc04-regression3.json) | 0 | 7.1 | `.venv/bin/pytest -q tests/test_goals.py tests/test_meal_service.py tests/test_health.py tests/test_health_connect.py` |
| [browser-final](../evidence/release-readiness/final/browser-final.json) | 0 | 17.31 | `.venv/bin/python -m pytest -m browser -q -rs --junitxml=runtime/rc00-05-20261018/browser-final.xml` |
| [browser-pre-review](../evidence/release-readiness/final/browser-pre-review.json) | 0 | 25.14 | `.venv/bin/pytest -m browser -q -rs --junitxml=runtime/rc00-05-20261018/browser-pre-review.xml` |
| [cleanup-disposable-db-final](../evidence/release-readiness/final/cleanup-disposable-db-final.json) | 0 | 0.42 | `python3 runtime/rc00-05-20261018/postgres.py stop` |
| [evidence-integrity-check-final](../evidence/release-readiness/final/evidence-integrity-check-final.json) | 0 | 0.37 | `python3 runtime/rc00-05-20261018/verify_final_evidence.py` |
| [evidence-secret-scan-final](../evidence/release-readiness/final/evidence-secret-scan-final.json) | 0 | 1.07 | `python3 runtime/rc00-05-20261018/evidence_secret_check.py` |
| [ios-clear-jsi-cache](../evidence/release-readiness/RC01/ios-clear-jsi-cache.json) | 0 | 0.05 | `bash node_modules/expo-modules-jsi/apple/scripts/clear-caches.sh` |
| [ios-final-debug-all-enabled](../evidence/release-readiness/RC01/ios-final-debug-all-enabled.json) | 0 | 412.93 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-final-all-debug -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 5 build` |
| [ios-final-debug-disabled](../evidence/release-readiness/RC01/ios-final-debug-disabled.json) | 0 | 48.33 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-off-debug -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 3 build` |
| [ios-final-release-all-enabled](../evidence/release-readiness/RC01/ios-final-release-all-enabled.json) | 0 | 346.72 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-final-all-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 5 build` |
| [ios-final-release-disabled-serial](../evidence/release-readiness/RC01/ios-final-release-disabled-serial.json) | 0 | 26.07 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-off-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 4 build` |
| [ios-final-release-disabled](../evidence/release-readiness/RC01/ios-final-release-disabled.json) | 65 | 7.23 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-off-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 3 build` |
| [ios-pods-all-enabled-final](../evidence/release-readiness/RC01/ios-pods-all-enabled-final.json) | 0 | 23.54 | `pod install --no-repo-update` |
| [ios-pods-disabled](../evidence/release-readiness/RC01/ios-pods-disabled.json) | 0 | 53.12 | `pod install` |
| [ios-pods-enabled](../evidence/release-readiness/RC01/ios-pods-enabled.json) | 0 | 56.59 | `pod install --no-repo-update` |
| [ios-pods-source-enabled](../evidence/release-readiness/RC01/ios-pods-source-enabled.json) | 0 | 21.81 | `pod install --no-repo-update` |
| [ios-prebuild-source-enabled](../evidence/release-readiness/RC01/ios-prebuild-source-enabled.json) | 0 | 1.95 | `npx --no-install expo prebuild --platform ios --no-install` |
| [ios-release-enabled](../evidence/release-readiness/RC01/ios-release-enabled.json) | 65 | 394.11 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 4 build` |
| [ios-source-debug-disabled](../evidence/release-readiness/RC01/ios-source-debug-disabled.json) | 0 | 771.57 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-off-debug -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 3 build` |
| [ios-source-debug-enabled](../evidence/release-readiness/RC01/ios-source-debug-enabled.json) | 0 | 430.35 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-debug -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 4 build` |
| [ios-source-release-disabled](../evidence/release-readiness/RC01/ios-source-release-disabled.json) | 0 | 769.64 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-off-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 3 build` |
| [ios-source-release-enabled](../evidence/release-readiness/RC01/ios-source-release-enabled.json) | 0 | 409.73 | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../runtime/rc00-05-20261018/ios-source-release -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO -jobs 4 build` |
| [lint-final](../evidence/release-readiness/final/lint-final.json) | 0 | 2.09 | `npm run lint` |
| [lint-pre-review](../evidence/release-readiness/final/lint-pre-review.json) | 0 | 3.46 | `npm run lint` |
| [mobile-baseline](../evidence/release-readiness/RC00/mobile-baseline.json) | 0 | 6.95 | `npm test -- --runInBand` |
| [mobile-final](../evidence/release-readiness/final/mobile-final.json) | 0 | 7.75 | `npm test -- --runInBand` |
| [mobile-pre-review](../evidence/release-readiness/final/mobile-pre-review.json) | 0 | 17.55 | `npm test -- --runInBand` |
| [native-acceptance-final](../evidence/release-readiness/RC01/native-acceptance-final.json) | 0 | 3.44 | `python3 runtime/rc00-05-20261018/native_acceptance.py` |
| [native-apk-signing-final](../evidence/release-readiness/RC01/native-apk-signing-final.json) | 0 | 1.83 | `python3 runtime/rc00-05-20261018/apk_signing_check.py` |
| [native-export-all-enabled-final](../evidence/release-readiness/RC01/native-export-all-enabled-final.json) | 0 | 16.35 | `npx --no-install expo export --platform ios --platform android --clear --output-dir ../runtime/rc00-05-20261018/export-all-enabled-final` |
| [native-export-disabled-final](../evidence/release-readiness/RC01/native-export-disabled-final.json) | 0 | 17.15 | `npx --no-install expo export --platform ios --platform android --clear --output-dir ../runtime/rc00-05-20261018/export-disabled-final` |
| [native-manifest-disabled-final](../evidence/release-readiness/RC01/native-manifest-disabled-final.json) | 0 | 1.37 | `python3 runtime/rc00-05-20261018/native_manifest.py disabled` |
| [native-prebuild-all-enabled-final](../evidence/release-readiness/RC01/native-prebuild-all-enabled-final.json) | 0 | 2.97 | `npx --no-install expo prebuild --clean --no-install` |
| [native-prebuild-disabled](../evidence/release-readiness/RC01/native-prebuild-disabled.json) | 0 | 3.44 | `npx --no-install expo prebuild --clean --no-install` |
| [native-prebuild-enabled](../evidence/release-readiness/RC01/native-prebuild-enabled.json) | 0 | 3.15 | `npx --no-install expo prebuild --clean --no-install` |
| [package-final](../evidence/release-readiness/final/package-final.json) | 0 | 4.54 | `.venv/bin/python runtime/rc00-05-20261018/package_check.py` |
| [python-format-final](../evidence/release-readiness/final/python-format-final.json) | 0 | 0.2 | `.venv/bin/python -m ruff format --check src tests scripts` |
| [python-format-pre-review](../evidence/release-readiness/final/python-format-pre-review.json) | 0 | 0.14 | `.venv/bin/ruff format --check src tests scripts` |
| [python-lint-final](../evidence/release-readiness/final/python-lint-final.json) | 0 | 0.19 | `.venv/bin/python -m ruff check src tests scripts` |
| [python-lint-pre-review](../evidence/release-readiness/final/python-lint-pre-review.json) | 0 | 0.16 | `.venv/bin/ruff check src tests scripts` |
| [rc01-swift-final](../evidence/release-readiness/RC01/rc01-swift-final.json) | 0 | 2.71 | `python3 runtime/rc00-05-20261018/swift_check.py` |
| [rc01-swift-policies](../evidence/release-readiness/RC01/rc01-swift-policies.json) | 0 | 3.56 | `.venv/bin/python runtime/rc00-05-20261018/swift_check.py` |
| [rc02-audit-tools](../evidence/release-readiness/RC02/rc02-audit-tools.json) | 0 | 7.78 | `uv tool run --from pip-audit pip-audit --help` |
| [rc02-image-os-audit](../evidence/release-readiness/RC02/rc02-image-os-audit.json) | 1 | 26.02 | `docker run --rm -v /Users/braude/.codex/worktrees/biteflow-p01/food-_loger/runtime/rc00-05-20261018:/scan aquasec/trivy:0.76.0 image --input /scan/shipping-image.tar --cache-dir /scan/trivy-cache --scanners vuln --format json --output /scan/trivy-image.json --exit-code 1 --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL` |
| [rc02-image-os-final](../evidence/release-readiness/RC02/rc02-image-os-final.json) | 1 | 1.77 | `docker run --rm -v /Users/braude/.codex/worktrees/biteflow-p01/food-_loger/runtime/rc00-05-20261018/shipping-image-final.tar:/input/image.tar:ro -v /Users/braude/.codex/worktrees/biteflow-p01/food-_loger/runtime/rc00-05-20261018/image-audit:/output -v /Users/braude/.codex/worktrees/biteflow-p01/food-_loger/runtime/rc00-05-20261018/trivy-cache:/cache aquasec/trivy:0.76.0 image --input /input/image.tar --cache-dir /cache --scanners vuln --format json --output /output/trivy-final.json --exit-code 1 --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL` |
| [rc02-image-patched](../evidence/release-readiness/RC02/rc02-image-patched.json) | 0 | 43.38 | `docker build -f Dockerfile.free -t biteflow-rc00-05-audit:local .` |
| [rc02-image-runtime-patched](../evidence/release-readiness/RC02/rc02-image-runtime-patched.json) | 0 | 63.13 | `docker build -f Dockerfile.free -t biteflow-rc00-05-audit:local .` |
| [rc02-npm-patched](../evidence/release-readiness/RC02/rc02-npm-patched.json) | 1 | 8.2 | `npm audit --json` |
| [rc02-python-final](../evidence/release-readiness/RC02/rc02-python-final.json) | 0 | 5.06 | `uv tool run --from pip-audit pip-audit -r runtime/rc00-05-20261018/shipping-requirements-final.txt --no-deps --disable-pip --format json --progress-spinner off` |
| [rc02-python-local-audit](../evidence/release-readiness/RC02/rc02-python-local-audit.json) | 0 | 7.27 | `uv tool run --from pip-audit pip-audit --path .venv/lib/python3.11/site-packages --format json --progress-spinner off` |
| [rc02-python-shipping-audit](../evidence/release-readiness/RC02/rc02-python-shipping-audit.json) | 1 | 4.67 | `uv tool run --from pip-audit pip-audit -r runtime/rc00-05-20261018/shipping-requirements.txt --no-deps --disable-pip --format json --progress-spinner off` |
| [rc02-python-shipping-patched](../evidence/release-readiness/RC02/rc02-python-shipping-patched.json) | 0 | 1.73 | `uv tool run --from pip-audit pip-audit -r runtime/rc00-05-20261018/shipping-requirements-patched.txt --no-deps --disable-pip --format json --progress-spinner off` |
| [rc02-runtime-installer-green](../evidence/release-readiness/RC02/rc02-runtime-installer-green.json) | 0 | 0.92 | `docker run --rm --network none --entrypoint python biteflow-rc00-05-audit:local -c 'import importlib.util; assert importlib.util.find_spec("pip") is None; import foodlogger.app; print("No runtime installer; application imports")'` |
| [rc02-runtime-installer-red](../evidence/release-readiness/RC02/rc02-runtime-installer-red.json) | 1 | 0.49 | `docker run --rm --network none --entrypoint python biteflow-rc00-05-audit:local -c 'import importlib.util; assert importlib.util.find_spec("pip") is None; import foodlogger.app'` |
| [rc02-secret-scan](../evidence/release-readiness/RC02/rc02-secret-scan.json) | 0 | 95.95 | `.venv/bin/python runtime/rc00-05-20261018/secret_scan.py` |
| [rc02-secret-tool](../evidence/release-readiness/RC02/rc02-secret-tool.json) | 0 | 2.44 | `uv tool run --from detect-secrets detect-secrets scan --help` |
| [rc02-secrets-final](../evidence/release-readiness/RC02/rc02-secrets-final.json) | 0 | 65.12 | `python3 runtime/rc00-05-20261018/secret_scan.py` |
| [rc02-shipping-image](../evidence/release-readiness/RC02/rc02-shipping-image.json) | 0 | 53.75 | `docker build --pull=false -f Dockerfile.free -t biteflow-rc00-05-audit:local .` |
| [rc02-uuid-install](../evidence/release-readiness/RC02/rc02-uuid-install.json) | 0 | 1.64 | `npm install --ignore-scripts --no-audit --no-fund` |
| [rc02-uuid-regression](../evidence/release-readiness/RC02/rc02-uuid-regression.json) | 1 | 3.42 | `npm test -- --runInBand widgets.test speech-guard plugin.test` |
| [rc02-uuid-regression2](../evidence/release-readiness/RC02/rc02-uuid-regression2.json) | 0 | 3.89 | `npm test -- --runInBand widgets.test plugin.test android.test` |
| [rc03-backend-red](../evidence/release-readiness/RC03/rc03-backend-red.json) | 1 | 4.19 | `.venv/bin/python -m pytest tests/test_basis_correction.py -q` |
| [rc03-domain-green](../evidence/release-readiness/RC03/rc03-domain-green.json) | 0 | 1.1 | `npm test -- --runInBand src/domain/__tests__/basis-correction.test.ts` |
| [rc03-final](../evidence/release-readiness/RC03/rc03-final.json) | 0 | 1.63 | `npm test -- --runInBand src/domain/__tests__/basis-correction.test.ts src/api/__tests__/basis-capability.test.ts src/components/__tests__/MealFoodEditor.test.tsx` |
| [rc03-lint](../evidence/release-readiness/RC03/rc03-lint.json) | 0 | 2.87 | `npm run lint` |
| [rc03-mobile-red](../evidence/release-readiness/RC03/rc03-mobile-red.json) | 1 | 2.01 | `npm test -- --runInBand src/domain/__tests__/basis-correction.test.ts` |
| [rc03-mobile-suite](../evidence/release-readiness/RC03/rc03-mobile-suite.json) | 0 | 10.98 | `npm test -- --runInBand` |
| [rc03-reader-green](../evidence/release-readiness/RC03/rc03-reader-green.json) | 1 | 2.81 | `.venv/bin/python -m pytest tests/test_basis_correction.py tests/test_canonical_domain.py tests/test_partial_compatibility.py tests/test_meal_service.py -q` |
| [rc03-reader-green2](../evidence/release-readiness/RC03/rc03-reader-green2.json) | 0 | 2.65 | `.venv/bin/python -m pytest tests/test_basis_correction.py tests/test_canonical_domain.py tests/test_partial_compatibility.py tests/test_meal_service.py -q` |
| [rc03-types](../evidence/release-readiness/RC03/rc03-types.json) | 2 | 1.96 | `npm run typecheck` |
| [rc03-types2](../evidence/release-readiness/RC03/rc03-types2.json) | 0 | 2.83 | `npm run typecheck` |
| [rc03-ui-green](../evidence/release-readiness/RC03/rc03-ui-green.json) | 1 | 1.54 | `npm test -- --runInBand src/api/__tests__/basis-capability.test.ts src/components/__tests__/MealFoodEditor.test.tsx` |
| [rc03-ui-red](../evidence/release-readiness/RC03/rc03-ui-red.json) | 1 | 3.8 | `npm test -- --runInBand src/api/__tests__/basis-capability.test.ts src/components/__tests__/MealFoodEditor.test.tsx` |
| [rc04-api-green](../evidence/release-readiness/RC04/rc04-api-green.json) | 0 | 1.06 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts` |
| [rc04-final](../evidence/release-readiness/RC04/rc04-final.json) | 0 | 4.51 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts src/components/__tests__/MealEdit.test.tsx src/components/__tests__/MealEditRoute.test.tsx src/components/__tests__/MealEditPropagation.test.tsx src/data/__tests__/journal.test.ts` |
| [rc04-journal-red](../evidence/release-readiness/RC04/rc04-journal-red.json) | 1 | 1.06 | `npm test -- --runInBand src/data/__tests__/journal.test.ts` |
| [rc04-lint](../evidence/release-readiness/RC04/rc04-lint.json) | 0 | 2.68 | `npm run lint` |
| [rc04-mobile-suite](../evidence/release-readiness/RC04/rc04-mobile-suite.json) | 0 | 9.94 | `npm test -- --runInBand` |
| [rc04-propagation](../evidence/release-readiness/RC04/rc04-propagation.json) | 0 | 1.72 | `npm test -- --runInBand MealEditPropagation` |
| [rc04-red-behavior](../evidence/release-readiness/RC04/rc04-red-behavior.json) | 1 | 0.73 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts` |
| [rc04-red](../evidence/release-readiness/RC04/rc04-red.json) | 1 | 1.13 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts` |
| [rc04-review-green](../evidence/release-readiness/RC04/rc04-review-green.json) | 1 | 2.6 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts src/components/__tests__/MealEdit.test.tsx src/components/__tests__/MealEditRoute.test.tsx` |
| [rc04-review-green2](../evidence/release-readiness/RC04/rc04-review-green2.json) | 0 | 1.19 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts src/components/__tests__/MealEdit.test.tsx src/components/__tests__/MealEditRoute.test.tsx` |
| [rc04-review-red](../evidence/release-readiness/RC04/rc04-review-red.json) | 1 | 4.45 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts src/components/__tests__/MealEdit.test.tsx src/components/__tests__/MealEditRoute.test.tsx` |
| [rc04-review-red2](../evidence/release-readiness/RC04/rc04-review-red2.json) | 1 | 5.06 | `npm test -- --runInBand src/api/__tests__/canonical-edit.test.ts src/components/__tests__/MealEdit.test.tsx src/components/__tests__/MealEditRoute.test.tsx` |
| [rc04-types](../evidence/release-readiness/RC04/rc04-types.json) | 2 | 1.48 | `npm run typecheck` |
| [rc04-types2](../evidence/release-readiness/RC04/rc04-types2.json) | 2 | 1.44 | `npm run typecheck` |
| [rc04-types3](../evidence/release-readiness/RC04/rc04-types3.json) | 0 | 1.98 | `npm run typecheck` |
| [rc04-ui-green](../evidence/release-readiness/RC04/rc04-ui-green.json) | 1 | 1.3 | `npm test -- --runInBand src/components/__tests__/MealEdit.test.tsx src/data/__tests__/journal.test.ts` |
| [rc04-ui-green2](../evidence/release-readiness/RC04/rc04-ui-green2.json) | 1 | 1.98 | `npm test -- --runInBand src/components/__tests__/MealEdit.test.tsx` |
| [rc04-ui-red](../evidence/release-readiness/RC04/rc04-ui-red.json) | 1 | 1.12 | `npm test -- --runInBand src/components/__tests__/MealEdit.test.tsx` |
| [rc05-final](../evidence/release-readiness/RC05/rc05-final.json) | 0 | 7.15 | `npm test -- --runInBand src/storage/__tests__/private-cleanup-recovery.test.ts src/storage/__tests__/private-cleanup-process.test.js src/storage/__tests__/export.test.ts src/auth/__tests__/private-cleanup-navigation.test.tsx src/auth/__tests__/export-cleanup.test.tsx src/auth/__tests__/rollback-export-cleanup.test.tsx src/components/__tests__/AccountExport.test.tsx` |
| [rc05-green](../evidence/release-readiness/RC05/rc05-green.json) | 0 | 2.05 | `npm test -- --runInBand src/storage/__tests__/private-cleanup-recovery.test.ts src/storage/__tests__/export.test.ts src/auth/__tests__/private-cleanup-navigation.test.tsx` |
| [rc05-lint-final](../evidence/release-readiness/RC05/rc05-lint-final.json) | 1 | 2.58 | `npm run lint` |
| [rc05-lint-final2](../evidence/release-readiness/RC05/rc05-lint-final2.json) | 1 | 1.68 | `npm run lint` |
| [rc05-lint-final3](../evidence/release-readiness/RC05/rc05-lint-final3.json) | 0 | 1.76 | `npm run lint` |
| [rc05-lint](../evidence/release-readiness/RC05/rc05-lint.json) | 0 | 2.97 | `npm run lint` |
| [rc05-mobile-final](../evidence/release-readiness/RC05/rc05-mobile-final.json) | 0 | 12.17 | `npm test -- --runInBand` |
| [rc05-mobile-suite](../evidence/release-readiness/RC05/rc05-mobile-suite.json) | 1 | 7.61 | `npm test -- --runInBand` |
| [rc05-mobile-suite2](../evidence/release-readiness/RC05/rc05-mobile-suite2.json) | 0 | 10.62 | `npm test -- --runInBand` |
| [rc05-process-final](../evidence/release-readiness/RC05/rc05-process-final.json) | 0 | 2.04 | `npm test -- --runInBand private-cleanup-process` |
| [rc05-process](../evidence/release-readiness/RC05/rc05-process.json) | 0 | 2.08 | `npm test -- --runInBand private-cleanup-process private-cleanup-recovery` |
| [rc05-races](../evidence/release-readiness/RC05/rc05-races.json) | 1 | 3.28 | `npm test -- --runInBand export.test private-cleanup-process private-cleanup-navigation` |
| [rc05-races2](../evidence/release-readiness/RC05/rc05-races2.json) | 0 | 2.66 | `npm test -- --runInBand export.test private-cleanup-process private-cleanup-navigation` |
| [rc05-red](../evidence/release-readiness/RC05/rc05-red.json) | 1 | 1.3 | `npm test -- --runInBand src/storage/__tests__/private-cleanup-recovery.test.ts` |
| [rc05-types-final](../evidence/release-readiness/RC05/rc05-types-final.json) | 2 | 3.77 | `npm run typecheck` |
| [rc05-types-final2](../evidence/release-readiness/RC05/rc05-types-final2.json) | 0 | 2.11 | `npm run typecheck` |
| [rc05-types](../evidence/release-readiness/RC05/rc05-types.json) | 0 | 3.25 | `npm run typecheck` |
| [review-final-moved-reload](../evidence/release-readiness/final/review-final-moved-reload.json) | 0 | 0.3 | `node -e 'const fs=require('"'"'node:fs'"'"'),path=require('"'"'node:path'"'"'),assert=require('"'"'node:assert/strict'"'"');
const {transformSync}=require('"'"'@babel/core'"'"'),cache=new Map();
function load(file){
 file=path.resolve(file);
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const code=transformSync(fs.readFileSync(file,'"'"'utf8'"'"'),{filename:file,babelrc:false,configFile:false,presets:[require.resolve('"'"'@babel/preset-typescript'"'"')],plugins:[require.resolve('"'"'@babel/plugin-transform-modules-commonjs'"'"')]}).code;
 const req=(id)=>{if(id.startsWith('"'"'@/'"'"'))return load(path.resolve('"'"'src'"'"',id.slice(2)+'"'"'.ts'"'"'));if(id.startsWith('"'"'.'"'"'))return load(path.resolve(path.dirname(file),id+'"'"'.ts'"'"'));return require(id);};
 new Function('"'"'require'"'"','"'"'module'"'"','"'"'exports'"'"',code)(req,mod,mod.exports);return mod.exports;
}
(async()=>{
 const {loadMealForEdit}=load('"'"'src/domain/meal-edit.ts'"'"');
 const groupId='"'"'a'"'"'.repeat(32),calls=[];
 const api={mealLogs:async(day)=>{calls.push('"'"'list:'"'"'+day);return [];},mealLog:async(id)=>{calls.push('"'"'get:'"'"'+id);return {id,local_date:'"'"'2026-10-19'"'"',version:2};}};
 try{await loadMealForEdit(api,groupId,'"'"'2026-10-18'"'"');throw Error('"'"'Unexpected success'"'"');}catch(e){assert.equal(e.kind,'"'"'notFound'"'"');}
 assert.deepEqual(calls,['"'"'list:2026-10-18'"'"']);
 console.log('"'"'REPRO CONFIRMED: reload with known group ID fails after a day move; current GET is never attempted.'"'"');
})();'` |
| [shipping-source-check-final](../evidence/release-readiness/final/shipping-source-check-final.json) | 0 | 0.74 | `python3 runtime/rc00-05-20261018/image_source_check.py` |
| [types-final](../evidence/release-readiness/final/types-final.json) | 0 | 1.79 | `npm run typecheck` |
| [types-pre-review](../evidence/release-readiness/final/types-pre-review.json) | 0 | 5.58 | `npm run typecheck` |
