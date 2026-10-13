# Biteflow Apple sign-in — release status

Updated 2026-10-11. **Biteflow 1.0.0 (2) is uploaded, processed and available in the Personal internal TestFlight group.** Implementation, account configuration, backend deployment and signed iOS distribution are complete. Device sign-in is not yet verified.

## Implemented

- Official native Apple button beside password login, with English/Hebrew messages and the existing Orbit layout.
- Existing users link Apple from Settings while signed in, preserving their user ID, journal and local drafts. Apple login from the sign-in screen creates a separate account if that Apple identity is not already linked. No matching by email.
- Server verifies Apple signatures, issuer, bundle audience, expiry, nonce and one-use authorization code. Five-minute challenges bind linking/deletion to the current session.
- Refresh tokens are encrypted at rest. Account deletion revokes Apple authorization before erasing the account. Failed revocation preserves the account for retry.
- Native credential-state checks sign out Apple sessions after revocation. No server notification webhook or scheduled daily token refresh is configured.

## Account configuration

- Existing Apple app: Biteflow, `io.github.ophbra22.foodlogger`, team `283L7984CA`, App Store Connect ID `6821706586`.
- Enabled Sign in with Apple as a primary App ID.
- Created key `HA9Q2FXAD7`, named **Biteflow Apple Sign In**, scoped only to Sign in with Apple for this primary app.
- Stored `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, and `APPLE_TOKEN_ENCRYPTION_KEY` in the existing Render service, merging settings without replacing the database credentials.
- Local private-key/encryption-key backups are owner-readable only under `~/.config/biteflow/secrets/`, outside source control. Never commit, print, or ship them in the mobile application.
- Applied additive migration `20261011194917_apple_sign_in.sql` to the existing Supabase project, private `foodlogger` schema. Both Apple tables have RLS; anon/authenticated roles have no SELECT access; only the server role has application access. Existing users/meals were not migrated or modified.
- Refreshed existing provisioning profile `5YLBD8VGJ4` with existing distribution certificate `8T3RSF224V` to include Apple sign-in. EAS verified the profile active.

## Validation

- Backend: 216 local tests passed, 16 optional environment tests skipped; 15 focused Apple tests passed.
- CI branch run `38170476004` and main run `38170620687` passed Python 3.11/3.12, browser, real PostgreSQL and free-runtime checks. The initial CI run exposed a literal-percent SQL test query; parameterizing it fixed the test. Production implementation was unchanged by that fix.
- Mobile: typecheck and lint passed; 11 suites / 100 tests passed. Covers proof nonce/state checks, account linking preserving the session/journal, conflicts, deletion cleanup and revocation failure preserving data.
- Backend release commit: `b3906ce8` on main (feature implementation `ba1ae407`). Render deployment `dep-db5up8nlot8c7388p3p0` went live at 20:08:59 UTC. All CI checks passed, but no automatic deployment appeared in the event history, so the tested commit was deployed through the existing service. Live HTTPS registration/login, bearer authentication, meal save/retry, journal, export and account deletion all passed; the disposable verification account was removed.
- Live Apple endpoint checks passed: enabled configuration, one-use challenges, rejection of invalid proofs and unauthenticated link/delete. A complete valid Apple login still needs the native device.
- EAS production build: `9d3c3bab-e935-4e63-bc8d-61b12ad19fe6`, version `1.0.0 (2)`, started 20:05 UTC. Build FINISHED at 20:11:02 UTC. Downloaded and verified the actual IPA: bundle/version/build, `com.apple.developer.applesignin = [Default]` in signature and provisioning profile, production HTTPS URL, App Store distribution, iOS 16.4 minimum and non-exempt-encryption flag false. Strict deep codesign verification passed. EAS submission `f8897fd9-3d4a-4d7e-989c-f4b9e65a1f18` FINISHED at 20:12:53 UTC. Apple processing is VALID and the build is IN_BETA_TESTING, verified for the exact EAS build/submission IDs. Apple build ID: `818c09b0-77cc-4e39-86b4-63e49cf8de8a`. Personal group assignment is verified: 1 tester, 2 builds, build 2 marked Testing. No outstanding processing, signing or export-compliance requirement is shown for internal testing. No public App Store release or paid service was initiated.
- The mobile source remains in the user's working tree; EAS records base HEAD `68c0a1e` plus the uploaded local source snapshot. Four additional test-only cases were added after upload; application source was not changed.

## On-device check after release

For an existing journal, sign in with the existing username/password first, open Settings, and link Apple there. Then sign out and use Continue with Apple to confirm that the same journal returns. A new Apple identity used directly from the login screen creates a new journal.

Actual Apple authentication, physical-device installation and cancellation/revocation behavior must be checked on the user's iPhone. TestFlight build 1 remains the previous release and does not include this feature.

Proof: `screenshots/apple-sign-in/testflight-build-2.png`.

Build: https://expo.dev/accounts/ophir_braude/projects/foodlogger/builds/9d3c3bab-e935-4e63-bc8d-61b12ad19fe6

Submission: https://expo.dev/accounts/ophir_braude/projects/foodlogger/submissions/f8897fd9-3d4a-4d7e-989c-f4b9e65a1f18
