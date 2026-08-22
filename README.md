# OEP Activity Inbox — Checkpoint 11.2B.1

Adaptive Smart Activity Extractor.

Why this update exists:
- Strava share cards use multiple layouts.
- Some dark cards put large vertical stats near the top.
- Others put tiny horizontal stats near the bottom.
- A fixed BLACK_VERTICAL crop worked for some cards but missed others.

This version:
- Runs multiple ROI candidates on dark cards.
- Tries both PSM 6 (block text) and PSM 11 (sparse text).
- Upscales bottom bands more aggressively.
- Collects multiple Distance / Duration / Pace candidates.
- Chooses the triplet with the best mathematical consistency.
- Does NOT silently correct conflicting OCR data.
- A mismatch remains NEEDS REVIEW / MISMATCH.
- Debug view exposes every adaptive OCR pass.

## Update

Upload/replace the whole package in the root of the existing
`oep-activity-inbox` repository.

Service worker cache: v5.

Open:
`https://otorunners-rpg.github.io/oep-activity-inbox/?v=5`

Expected title:
`Checkpoint 11.2B.1 — Adaptive Smart Extractor`

Retest the same four Strava share-card variants.

For each test record:
- Detected Layout
- Distance
- Duration
- Pace
- Validation

If a result is wrong, expand SHOW OCR DEBUG and capture the relevant
BLACK_TOP_STACK / BLACK_BOTTOM_BAND / BLACK_WIDE_LOWER passes.
