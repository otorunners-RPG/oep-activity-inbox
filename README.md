# OEP Activity Inbox — Checkpoint 11.2A

Goal: Android Strava Share -> local browser OCR -> raw OCR text.

Update existing GitHub Pages repo by replacing the files in the repo root with this package.

After deploy:
1. Open/reload the installed OEP Activity Inbox on Android.
2. Share a normal GPS Strava activity to Send to OEP.
3. Tap EXTRACT ACTIVITY TEXT.
4. Expected raw OCR should contain Distance, Time, Pace, and activity title if recognized.

Notes:
- Tesseract.js is loaded from jsDelivr CDN.
- Recognition runs locally in the browser via Web Worker/WASM.
- First run downloads OCR runtime/language assets and may be slower.
- No paid OCR API is used.
