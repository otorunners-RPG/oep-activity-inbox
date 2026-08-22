# OEP Activity Inbox — Checkpoint 11.2B.2

Bottom-Strip Adaptive Extractor.

Why this update exists:
- 3 of 4 Strava share variants already work.
- The remaining failing variant places tiny stats in a very thin bottom strip.
- Wide ROIs still include too much empty black space and route/logo noise.

What changed:
- Added dedicated bottom-strip ROIs.
- Added split metric-cell ROIs:
  - BLACK_CELL_DISTANCE
  - BLACK_CELL_PACE
  - BLACK_CELL_TIME
- Increased upscale for tiny-bottom candidates.
- Added PSM 7 for single-line / compact metric passes.
- Kept mathematical consistency scoring as the final selector.

Update:
- Replace the repo root with this package.
- Open:
  https://otorunners-rpg.github.io/oep-activity-inbox/?v=6

Expected title:
Checkpoint 11.2B.2 — Bottom-Strip Adaptive Extractor
