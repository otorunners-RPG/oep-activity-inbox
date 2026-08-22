# OEP Activity Inbox — Checkpoint 11.1B POC

Purpose:
- Prove that an installed Android PWA can appear as a share destination.
- Inspect exactly what Strava shares: image, text, URL, or a combination.
- No OCR, Google Sheet submission, scoring, or participant authentication yet.

## Files

- `index.html`
- `share.html`
- `manifest.webmanifest`
- `sw.js`
- `db.js`
- `app.js`
- `icons/icon-192.png`
- `icons/icon-512.png`

## Recommended hosting for the POC

Use a separate GitHub repository, for example:

`oep-activity-inbox`

Enable GitHub Pages from the repository root.

Do NOT merge this into Admin OEP v38.2 yet.

## Android test

1. Open the GitHub Pages URL in Chrome Android.
2. Wait until Service Worker = ACTIVE.
3. Install the PWA using the install button or Chrome → Add to Home screen / Install app.
4. Close Chrome.
5. Open a GPS activity in Strava Android.
6. Tap Share.
7. Select "Send to OEP" / "OEP Activity Inbox".
8. The Share Debug screen should show what was received.

Record:
- title
- text
- URL
- whether a file was received
- filename
- MIME type
- file size
- whether an image preview is shown

## PASS criteria

- PWA is installable.
- PWA appears in Android Share Sheet.
- Share request is received.
- Payload is visible on the debug page.
- No Strava API is used.
- No scraping is used.
