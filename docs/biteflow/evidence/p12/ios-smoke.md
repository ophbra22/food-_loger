# Observed iOS smoke — synthetic local data only

Task-owned iPhone 17 Pro simulator `3CAF021C-4271-46CA-920F-021F3C55BC3C`, iOS 26.5. Initial native installation failed because the extension lacked CFBundleName; the generator fix and repeated build/install passed. The unsigned app then failed synthetic sign-in with Keychain -34018 (missing application identifier); a local ad-hoc simulator build with `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-` emitted simulated application-identifier/App Group entitlements and sign-in passed. No Apple portal, production identity or provisioning download was used.

Actual observed sequence:

1. Native home-screen app icon context menu offered small and medium widget choices. Added small widget; it displayed a generic signed-out placeholder. Tap opened Sign in (`ios-small-placeholder.png`). This was context-menu placement, not a full gallery search test.
2. After the ad-hoc simulator build, synthetic loopback account sign-in succeeded. Today displayed the local API-confirmed banana meal, 133.5 kcal and 1.6 g protein. Settings → Show widget data enabled publication.
3. Small widget displayed 134 kcal, Protein 2 g, No calorie goal, Updated 10:48 (`ios-small-data.png`). Values are display rounding, not a change to canonical nutrition.
4. Switched to medium using the widget context menu. It displayed the same totals and Water 0 ml (`ios-medium-data.png`). Widget tap opened Today.
5. Settings → Sign out → confirmation returned to Sign in. Checked the task simulator's dedicated App Group container: `biteflow-widget-v1.json` absent (`ios-file-after-logout.log`). Home-screen medium widget displayed the generic placeholder without old totals (`ios-after-logout.png`).

Screenshots were inspected. These observations prove neither physical file protection nor a maximum reload delay. App-mediated meal entry, a second account, HE/RTL/large text/VoiceOver, other OS versions, lock/reboot, reinstall and killed/background scheduling remain open. Temporary simulator/account/database state is removed after evidence capture. No production or live AI calls occurred.
