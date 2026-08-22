# OEP Activity Inbox — Checkpoint 11.2E

Athlete Identity / Mapping only.

Scope:
- Remove the hardcoded OEP-A001 from submission.
- Pair one browser/PWA device to one participantCode.
- Store participantCode locally in the device.
- Use that participantCode for subsequent confirmed activity submissions.
- Existing Apps Script 11.2D resolves participantCode -> athleteId using ATHLETES.

Not included:
- No QR pairing.
- No token/hash redesign.
- No login/authentication.
- No duplicate logic.
- No Admin OEP integration.
- No activity edit.

Apps Script:
- Keep the already deployed Checkpoint 11.2D Apps Script unchanged.

Service worker cache:
- v9

Open:
https://otorunners-rpg.github.io/oep-activity-inbox/?v=9

Expected title:
Checkpoint 11.2E — Athlete Identity / Mapping

Test:
1. Home -> enter OEP-A001 -> SAVE THIS DEVICE.
2. Submit a MATCHED activity.
3. ACTIVITY_INBOX should map participantCode OEP-A001 -> athleteId ATH001.
4. Clear pairing.
5. Enter OEP-A002 -> SAVE THIS DEVICE.
6. Submit a MATCHED activity.
7. ACTIVITY_INBOX should map participantCode OEP-A002 -> athleteId ATH002.

Acceptance:
- No hardcoded participantCode remains in submission.js.
- Unpaired device cannot confirm/submit.
- Paired code persists after closing/reopening PWA.
- Submission row maps to the correct ATHLETES row.
