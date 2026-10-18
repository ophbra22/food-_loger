# Dependency and native-warning disposition

Original severity is retained. No development/build dependency is treated as harmless solely by category. These are dependency nodes, not 67 distinct root vulnerabilities. Final audit is recorded separately.

| Dependency | Severity | Root exposure | Installed nodes | Historical P13 | Disposition |
|---|---|---|---|---|---|
| @expo/cli | high | braces, node-forge, uuid | node_modules/expo/node_modules/@expo/cli | present | OPEN — no compatible patched upstream release for braces, node-forge |
| @expo/code-signing-certificates | high | node-forge | node_modules/@expo/code-signing-certificates | present | OPEN — no compatible patched upstream release for node-forge |
| @expo/config | moderate | uuid | node_modules/@expo/config | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| @expo/config-plugins | moderate | uuid | node_modules/@expo/config-plugins | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| @expo/inline-modules | moderate | uuid | node_modules/@expo/inline-modules | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| @expo/local-build-cache-provider | moderate | uuid | node_modules/@expo/local-build-cache-provider | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| @expo/metro | high | braces | node_modules/@expo/metro | present | OPEN — no compatible patched upstream release for braces |
| @expo/metro-config | high | braces, uuid | node_modules/@expo/metro-config | present | OPEN — no compatible patched upstream release for braces |
| @expo/prebuild-config | moderate | uuid | node_modules/@expo/prebuild-config | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
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
| expo-sharing | moderate | uuid | node_modules/expo-sharing | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| expo-splash-screen | moderate | uuid | node_modules/expo-splash-screen | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
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
| uuid | moderate | uuid | node_modules/uuid | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |
| xcode | moderate | uuid | node_modules/xcode | present | Candidate scoped xcode→uuid11.1.1; final audit/build evidence required |

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
