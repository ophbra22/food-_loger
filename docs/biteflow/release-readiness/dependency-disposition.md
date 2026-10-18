# Dependency and native-warning disposition

Original severity is retained. No development/build dependency is treated as harmless solely by category. These are dependency nodes, not 67 distinct root vulnerabilities. Final audit is recorded separately.

| Dependency | Severity | Root exposure | Installed nodes | Historical P13 | Disposition |
|---|---|---|---|---|---|
| @expo/cli | high | braces, node-forge, uuid | node_modules/expo/node_modules/@expo/cli | present | OPEN — no compatible patched upstream release for braces, node-forge |
| @expo/code-signing-certificates | high | node-forge | node_modules/@expo/code-signing-certificates | present | OPEN — no compatible patched upstream release for node-forge |
| @expo/config | moderate | uuid | node_modules/@expo/config | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| @expo/config-plugins | moderate | uuid | node_modules/@expo/config-plugins | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| @expo/inline-modules | moderate | uuid | node_modules/@expo/inline-modules | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| @expo/local-build-cache-provider | moderate | uuid | node_modules/@expo/local-build-cache-provider | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| @expo/metro | high | braces | node_modules/@expo/metro | present | OPEN — no compatible patched upstream release for braces |
| @expo/metro-config | high | braces, uuid | node_modules/@expo/metro-config | present | OPEN — no compatible patched upstream release for braces |
| @expo/prebuild-config | moderate | uuid | node_modules/@expo/prebuild-config | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| @istanbuljs/load-nyc-config | moderate | sprintf-js | node_modules/@istanbuljs/load-nyc-config | present | OPEN — no compatible patched upstream release for sprintf-js |
| @jest/console | high | braces | node_modules/@jest/console | present | OPEN — no compatible patched upstream release for braces |
| @jest/core | high | braces, sprintf-js | node_modules/@jest/core | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @jest/environment | high | braces | node_modules/@jest/environment | present | OPEN — no compatible patched upstream release for braces |
| @jest/expect | high | braces, sprintf-js | node_modules/@jest/expect | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @jest/fake-timers | high | braces | node_modules/@jest/fake-timers | present | OPEN — no compatible patched upstream release for braces |
| @jest/globals | high | braces, sprintf-js | node_modules/@jest/globals | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @jest/reporters | high | braces, sprintf-js | node_modules/@jest/reporters | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @jest/test-result | high | braces | node_modules/@jest/test-result | present | OPEN — no compatible patched upstream release for braces |
| @jest/test-sequencer | high | braces | node_modules/@jest/test-sequencer | present | OPEN — no compatible patched upstream release for braces |
| @jest/transform | high | braces, sprintf-js | node_modules/@jest/transform | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @react-native/community-cli-plugin | high | braces | node_modules/@react-native/community-cli-plugin | present | OPEN — no compatible patched upstream release for braces |
| @react-native/jest-preset | high | braces, sprintf-js | node_modules/@react-native/jest-preset | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @react-native/metro-config | high | braces | node_modules/@react-native/metro-config | present | OPEN — no compatible patched upstream release for braces |
| @react-native/virtualized-lists | high | braces, sprintf-js | node_modules/@react-native/virtualized-lists | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @testing-library/react-native | high | braces, sprintf-js | node_modules/@testing-library/react-native | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| @types/jest | high | braces | node_modules/@types/jest | present | OPEN — no compatible patched upstream release for braces |
| argparse | moderate | sprintf-js | node_modules/@istanbuljs/load-nyc-config/node_modules/argparse | present | OPEN — no compatible patched upstream release for sprintf-js |
| babel-jest | high | braces, sprintf-js | node_modules/babel-jest | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| babel-plugin-istanbul | moderate | sprintf-js | node_modules/babel-plugin-istanbul | present | OPEN — no compatible patched upstream release for sprintf-js |
| braces | high | braces | node_modules/braces | present | OPEN — no compatible patched upstream release for braces |
| create-jest | high | braces, sprintf-js | node_modules/create-jest | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| decode-uri-component | moderate | decode-uri-component | node_modules/decode-uri-component | present | OPEN — patched0.5 ESM export incompatible with query-string7 CommonJS callable; no forced Expo58 upgrade |
| expect | high | braces | node_modules/expect | present | OPEN — no compatible patched upstream release for braces |
| expo | high | braces, node-forge, uuid | node_modules/expo | present | OPEN — no compatible patched upstream release for braces, node-forge |
| expo-router | moderate | decode-uri-component | node_modules/expo-router | present | OPEN — patched0.5 ESM export incompatible with query-string7 CommonJS callable; no forced Expo58 upgrade |
| expo-sharing | moderate | uuid | node_modules/expo-sharing | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| expo-splash-screen | moderate | uuid | node_modules/expo-splash-screen | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| jest | high | braces, sprintf-js | node_modules/jest | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-circus | high | braces, sprintf-js | node_modules/jest-circus | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-cli | high | braces, sprintf-js | node_modules/jest-cli | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-config | high | braces, sprintf-js | node_modules/jest-config | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-environment-jsdom | high | braces | node_modules/jest-environment-jsdom | present | OPEN — no compatible patched upstream release for braces |
| jest-environment-node | high | braces | node_modules/jest-environment-node | present | OPEN — no compatible patched upstream release for braces |
| jest-expo | high | braces, sprintf-js | node_modules/jest-expo | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-haste-map | high | braces | node_modules/jest-haste-map | present | OPEN — no compatible patched upstream release for braces |
| jest-message-util | high | braces | node_modules/jest-message-util | present | OPEN — no compatible patched upstream release for braces |
| jest-resolve | high | braces | node_modules/jest-resolve | present | OPEN — no compatible patched upstream release for braces |
| jest-resolve-dependencies | high | braces, sprintf-js | node_modules/jest-resolve-dependencies | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-runner | high | braces, sprintf-js | node_modules/jest-runner | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-runtime | high | braces, sprintf-js | node_modules/jest-runtime | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-snapshot | high | braces, sprintf-js | node_modules/jest-snapshot | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-watch-typeahead | high | braces, sprintf-js | node_modules/jest-watch-typeahead | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| jest-watcher | high | braces | node_modules/jest-watcher | present | OPEN — no compatible patched upstream release for braces |
| js-yaml | moderate | sprintf-js | node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml | present | OPEN — no compatible patched upstream release for sprintf-js |
| metro | high | braces | node_modules/metro<br>node_modules/metro-config/node_modules/metro | present | OPEN — no compatible patched upstream release for braces |
| metro-config | high | braces | node_modules/@expo/metro/node_modules/metro-config<br>node_modules/metro-config<br>node_modules/metro/node_modules/metro-config | present | OPEN — no compatible patched upstream release for braces |
| metro-file-map | high | braces | node_modules/metro-config/node_modules/metro-file-map<br>node_modules/metro-file-map | present | OPEN — no compatible patched upstream release for braces |
| metro-transform-worker | high | braces | node_modules/metro-config/node_modules/metro-transform-worker<br>node_modules/metro-transform-worker | present | OPEN — no compatible patched upstream release for braces |
| micromatch | high | braces | node_modules/micromatch | present | OPEN — no compatible patched upstream release for braces |
| node-forge | high | node-forge | node_modules/node-forge | present | OPEN — no compatible patched upstream release for node-forge |
| query-string | moderate | decode-uri-component | node_modules/query-string | present | OPEN — patched0.5 ESM export incompatible with query-string7 CommonJS callable; no forced Expo58 upgrade |
| react-native | high | braces, sprintf-js | node_modules/react-native | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| react-native-reanimated | high | braces, sprintf-js | node_modules/react-native-reanimated | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| react-native-worklets | high | braces, sprintf-js | node_modules/react-native-worklets | present | OPEN — no compatible patched upstream release for braces, sprintf-js |
| sprintf-js | moderate | sprintf-js | node_modules/sprintf-js | present | OPEN — no compatible patched upstream release for sprintf-js |
| uuid | moderate | uuid | node_modules/uuid | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |
| xcode | moderate | uuid | node_modules/xcode | present | REMOVED by xcode→uuid11.1.1; final npm audit confirms absent; real Node plugin/prebuild passes |

## Eight inherited native warnings

| Rule | Location | Original finding | Closure task |
|---|---|---|---|
| UnusedAttribute | mobile/modules/biteflow-widgets/android/src/main/res/xml/biteflow_widget_info.xml:1 | Attribute `previewLayout` is only used in API level 31 and higher (current min is 24) | RC06, remains open; no lint exclusion counts as closure |
| UnusedAttribute | mobile/modules/biteflow-widgets/android/src/main/res/xml/biteflow_widget_info.xml:1 | Attribute `targetCellHeight` is only used in API level 31 and higher (current min is 24) | RC06, remains open; no lint exclusion counts as closure |
| UnusedAttribute | mobile/modules/biteflow-widgets/android/src/main/res/xml/biteflow_widget_info.xml:1 | Attribute `targetCellWidth` is only used in API level 31 and higher (current min is 24) | RC06, remains open; no lint exclusion counts as closure |
| NewerVersionAvailable | mobile/modules/biteflow-widgets/android/build.gradle:23 | A newer version of org.json:json than 20240303 is available: 20260814 | RC06, remains open; no lint exclusion counts as closure |
| UseKtx | mobile/modules/biteflow-widgets/android/src/main/java/expo/modules/biteflowwidgets/BiteflowWidget.kt:30 | Use the KTX extension function `String.toUri` instead? | RC06, remains open; no lint exclusion counts as closure |
| UseKtx | mobile/modules/biteflow-widgets/android/src/main/java/expo/modules/biteflowwidgets/BiteflowWidget.kt:30 | Use the KTX extension function `String.toUri` instead? | RC06, remains open; no lint exclusion counts as closure |
| HardcodedText | mobile/modules/biteflow-widgets/android/src/main/res/layout/biteflow_widget.xml:2 | Hardcoded string "BiteFlow", should use `@string` resource | RC06, remains open; no lint exclusion counts as closure |
| HardcodedText | mobile/modules/biteflow-widgets/android/src/main/res/layout/biteflow_widget.xml:3 | Hardcoded string "Open BiteFlow", should use `@string` resource | RC06, remains open; no lint exclusion counts as closure |

Final npm audit: **58 affected nodes:50 high,8 moderate,0 critical**. The9 nodes removed are @expo/config, @expo/config-plugins, @expo/inline-modules, @expo/local-build-cache-provider, @expo/prebuild-config, expo-sharing, expo-splash-screen, uuid, xcode.

## Shipping image findings

Trivy0.76.0 scanned the built Python3.12/Debian13.7 image including embedded Python libraries. Initial172 package-advisory occurrences → final164 (44 high,58 medium,61 low,1 unknown;71 unique advisory IDs). All8 occurrences with an available fixed version were addressed: liblzma5 upgraded; runtime pip/embedded installer packages removed. Remaining164 are OS entries with no fixed version reported by this database. **All remain OPEN, not proven unreachable/false positives or accepted risk.** Python-package results are0. This blocks release and RC02 full acceptance.

| Package | Advisory | Severity | Distribution status | Fixed version | Disposition |
|---|---|---|---|---|---|
| apt | CVE-2011-3374 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bash | TEMP-0841856-B18BAF | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| bsdutils | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| coreutils | CVE-2017-18018 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| coreutils | CVE-2025-5278 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| coreutils | CVE-2026-56391 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| coreutils | CVE-2026-56392 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| dash | CVE-2026-102473 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| dash | CVE-2026-102474 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| diffutils | CVE-2026-53910 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| gcc-14-base | CVE-2026-102010 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| gcc-14-base | CVE-2026-95619 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libacl1 | CVE-2026-54369 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libacl1 | CVE-2026-54370 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libapt-pkg7.0 | CVE-2011-3374 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libattr1 | CVE-2026-54371 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libblkid1 | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libbz2-1.0 | CVE-2026-42250 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-18374 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-19499 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-19542 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-5435 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-6238 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-6368 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-6791 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-77117 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-80489 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-8674 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-86805 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-89092 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-95818 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2010-4756 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2018-20796 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2019-1010022 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2019-1010023 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2019-1010024 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2019-1010025 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2019-9192 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc-bin | CVE-2026-97399 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-18374 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-19499 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-19542 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-5435 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-6238 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-6368 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-6791 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-77117 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-80489 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-8674 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-86805 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-89092 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-95818 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2010-4756 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2018-20796 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2019-1010022 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2019-1010023 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2019-1010024 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2019-1010025 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2019-9192 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libc6 | CVE-2026-97399 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libgcc-s1 | CVE-2026-102010 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libgcc-s1 | CVE-2026-95619 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| liblastlog2-2 | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libmount1 | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libncursesw6 | CVE-2025-69720 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libncursesw6 | CVE-2025-6141 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libpam-modules | CVE-2026-54411 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libpam-modules-bin | CVE-2026-54411 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libpam-runtime | CVE-2026-54411 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libpam0g | CVE-2026-54411 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsmartcols1 | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsqlite3-0 | CVE-2026-50812 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsqlite3-0 | CVE-2026-50813 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsqlite3-0 | CVE-2021-45346 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsqlite3-0 | CVE-2025-70873 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libstdc++6 | CVE-2026-102010 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libstdc++6 | CVE-2026-95619 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2026-16742 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2026-15059 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2013-4392 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2023-31437 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2023-31438 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2023-31439 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libsystemd0 | CVE-2026-40228 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libtinfo6 | CVE-2025-69720 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libtinfo6 | CVE-2025-6141 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2026-16742 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2026-15059 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2013-4392 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2023-31437 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2023-31438 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2023-31439 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libudev1 | CVE-2026-40228 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| libuuid1 | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login.defs | CVE-2007-5686 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login.defs | CVE-2024-56433 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| login.defs | TEMP-0628843-DBAD28 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| mount | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| ncurses-base | CVE-2025-69720 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| ncurses-base | CVE-2025-6141 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| ncurses-bin | CVE-2025-69720 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| ncurses-bin | CVE-2025-6141 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| passwd | CVE-2007-5686 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| passwd | CVE-2024-56433 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| passwd | TEMP-0628843-DBAD28 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| perl-base | CVE-2026-9538 | HIGH | fix_deferred | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| perl-base | CVE-2026-15534 | MEDIUM | fix_deferred | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| perl-base | CVE-2011-4116 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| perl-base | CVE-2026-82560 | UNKNOWN | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| sysvinit-utils | TEMP-0517018-A83CE6 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| tar | CVE-2026-18477 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| tar | CVE-2026-18508 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| tar | CVE-2026-5704 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| tar | CVE-2005-2541 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| tar | TEMP-0290435-0B57B5 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2026-76642 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2026-78408 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2026-78409 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2026-78410 | HIGH | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2026-3184 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| util-linux | CVE-2022-0563 | LOW | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| zlib1g | CVE-2026-27171 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
| zlib1g | CVE-2026-85091 | MEDIUM | affected | none reported | OPEN — upstream fix or validated alternative image/reachability required |
