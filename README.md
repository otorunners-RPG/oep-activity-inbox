# OEP Activity Inbox — Checkpoint 11.2C

Confirmation Layer only.

Scope:
- Keep the 11.2B.2 extractor unchanged.
- Show extracted Sport / Distance / Duration / Pace.
- If validation = MATCHED, show `CONFIRM ACTIVITY`.
- No edit capability.
- If validation is not MATCHED, confirmation is blocked.
- Confirmation is local UI state only.
- No Google Sheet submission yet. That remains Checkpoint 11.2D.

## Update

Upload/replace the whole package into the root of the existing
`oep-activity-inbox` repository.

Service worker cache: v7

Open:
`https://otorunners-rpg.github.io/oep-activity-inbox/?v=7`

Expected title:
`Checkpoint 11.2C — Confirmation Layer`

## Acceptance Criteria

1. Share Strava activity to OEP.
2. Smart extraction completes.
3. MATCHED activity shows `CONFIRM ACTIVITY`.
4. Tapping confirm shows `ACTIVITY CONFIRMED`.
5. No editable metric field exists.
6. MISMATCH / NEEDS_REVIEW cannot be confirmed.
7. No Google Sheet write occurs in this phase.
