# Deploy and operate FoodLogger

The [Blueprint](../render.yaml) runs the original Python application on Render:
FastAPI, CPU TensorFlow inference, barcode decoding, and SQLite on a persistent
disk. The browser communicates only with this server. The server sends barcode
numbers to Open Food Facts for product lookup; it never sends food photos there.

## Create the service

1. Open [Deploy FoodLogger on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fophbra22%2Ffood-_loger) and sign in to Render.
   The link loads this public repository and its `render.yaml` Blueprint from
   branch `main`. Review the configuration before creating resources.
2. Review the resources before creating them: one `1c-2g` Python web service
   (1 CPU, 2 GB RAM) in Frankfurt and one 1 GB persistent disk. Both are paid
   resources. Check [current pricing](https://render.com/pricing); workspace,
   bandwidth or build usage charges can also apply.
3. The build installs the application and downloads a SHA-256-verified
   MobileNetV2 checkpoint. The checkpoint lives in the build filesystem;
   accounts, sessions and journals live under `/var/data/foodlogger/`.
4. Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The server uses the latter
   as the allowed HTTPS origin and enables Secure session cookies. For a custom
   domain, set `FOODLOGGER_PUBLIC_URL` to its exact HTTPS origin and use that
   domain consistently for sign-in and API requests.
5. After the deploy becomes healthy, open the HTTPS URL, register, and save the
   recovery code. The first recognition request loads TensorFlow into memory.

`/api/health` checks the application/database connection; it does not perform
model inference. The Blueprint deploys when connected GitHub checks pass.
Use one service instance and one Uvicorn worker: the database disk is local and
rate limits are in process memory. Render cannot scale a disk-backed service to
multiple instances. Moving to multiple instances requires shared database and
rate-limit infrastructure.

## Verify the live service

- Open the HTTPS site on desktop and phone. Create two accounts; a meal saved
  in one must not appear in the other, including CSV export and deletion.
- Save a catalog meal, a manual label and a photographed barcode product. For a
  product absent from Open Food Facts, confirm manual label entry still works.
- Photograph one supported food, review the real classifier suggestions, and
  confirm an invalid image produces a useful error.
- Check sign-out, sign-in, and recovery from the one-time recovery code.
- Redeploy and check that an existing account and meal still exist. The database
  path must remain inside the persistent disk mount.

The mobile camera is a native `capture="environment"` file control; camera UI
and supported capture formats depend on the device. JPG, PNG and WebP up to
8 MiB / 20 MP are accepted. Uploading a photo or entering barcode digits works
when native camera capture is unavailable.

## Proxy and abuse limits

The Blueprint trusts **one appended X-Forwarded-For hop**, selected from the
right, for authentication IP limits. Uvicorn does not independently rewrite the
client IP from untrusted headers. This setting assumes all public requests pass
through Render's proxy. Do not expose the application port directly with this
setting. Verify proxy behaviour after changing hosts or adding a proxy/CDN;
set `FOODLOGGER_TRUSTED_PROXY_HOPS=0` for a direct server. Account-specific
limits apply independently. Global product lookups are capped at 90/minute,
image decoding and TensorFlow share one processing slot, and HTTP concurrency is bounded.

Limits reset on restart. They are basic abuse controls for a small deployment,
not a distributed traffic protection service. Monitor Render memory and error
rates as usage grows. Requests can return 429 under load; users can retry.

## Back up and restore

Do not copy only the live `.sqlite3` file while WAL writes are active. Use
SQLite's online backup API from the Render service shell:

```python
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

source_path = Path(os.environ["FOODLOGGER_DB"])
backup_path = source_path.with_name(
    "backup-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + ".sqlite3"
)
with sqlite3.connect(source_path) as source, sqlite3.connect(backup_path) as target:
    source.backup(target)
```

Transfer the backup to private storage outside the service disk and keep a
retention schedule. It contains private journals, password hashes and session
records. Never commit or expose it publicly. To restore, stop writes, retain a
copy of the current database, restore a verified backup with its WAL state
cleared, and restart. Revoke existing sessions after a recovery incident.
Render disk snapshots are not a substitute for database-consistent backups.

## Account and data behaviour

Usernames are case-insensitive; passwords require 12–128 characters. Sessions
expire after seven days. Recovery rotates the recovery code and revokes all
existing sessions. There is no SMTP dependency or email reset path. A lost
password plus lost recovery code cannot be recovered through the UI.

Each journal query, export and deletion checks ownership. Older anonymous
entries remain under the reserved `__legacy__` owner when the schema migrates;
they are never exposed to a new account automatically. Photos are processed in
memory and not retained. Nutrition is a saved snapshot, so later catalog or
Open Food Facts changes do not silently modify a user's previous meals.

## References

[FastAPI on Render](https://render.com/docs/deploy-fastapi) ·
[Persistent disks](https://render.com/docs/disks) ·
[Blueprint reference](https://render.com/docs/blueprint-spec)
