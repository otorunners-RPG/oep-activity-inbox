# OEP Activity Inbox — Checkpoint 11.2B

Smart Activity Extractor POC.

Changes from 11.2A:
- Detects a rough Strava share-card layout.
- Crops the expected statistics region.
- Upscales it locally.
- Converts it to high-contrast black/white.
- OCRs only the stats region.
- Parses Distance / Duration / Pace.
- Derives Sport Type from shared Strava text.
- Runs a mathematical consistency check.
- Keeps raw OCR and preprocessed image under a debug disclosure.

No Google Sheet write is performed yet.

## Update existing GitHub repo

Replace/upload the complete contents of this package into the root of the existing `oep-activity-inbox` repository.

The service-worker cache is now `v4`.

After deployment:
1. Open `https://otorunners-rpg.github.io/oep-activity-inbox/?v=4`
2. Confirm the page says `Checkpoint 11.2B — Smart Activity Extractor`.
3. On Android, reopen/reinstall the PWA if an older UI is retained.
4. Share the same three Strava overlay variants again.
5. Tap `SMART EXTRACT ACTIVITY`.
6. Record:
   - Detected Layout
   - Distance
   - Duration
   - Pace
   - Validation status
   - Raw Region OCR if any field is wrong.

Expected validation for the 8.09 km / 58m 6s / 7:10 per km sample:
- Calculated pace is approximately 7:11/km.
- Validation should normally be MATCHED.
