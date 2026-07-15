/* ============================================================
   MEDIA HOSTING — Cloudflare R2
   ============================================================

   STEP 1 — Enable public access on your bucket:
     Cloudflare dashboard → R2 → your bucket → Settings
     → Public Development URL → Enable
     Copy the URL (looks like https://pub-abc123xyz.r2.dev)

   STEP 2 — Verify a file loads in your browser.
     Your JSON paths look like:  assets/tour/version 2 video.MOV
     So your bucket should contain an "assets" folder at the top level.
     Test this URL in Chrome (replace with your real pub URL + filename):
       https://pub-abc123xyz.r2.dev/assets/tour/version%202%20video.MOV
     If that plays/downloads, you're good. If you get "not found", see note
     below about folder structure.

   STEP 3 — Paste your pub URL below (no trailing slash):

   ============================================================ */

window.MEDIA_BASE_URL = 'https://pub-a296b21e7cf6462a8d3760710a67b7ae.r2.dev';

/* FOLDER STRUCTURE NOTE
   The site builds URLs as:  MEDIA_BASE_URL + "/" + path-from-json
   Example: https://pub-xxx.r2.dev/assets/tour/version 2 video.MOV

   When you uploaded to R2, the bucket should look like:
     assets/
       tour/
         version 2 video.MOV
       music/
       cursor.png
       ...

   If you uploaded the *contents* of assets/ directly (no "assets" folder
   in the bucket), either re-upload the whole assets folder, or change
   every "src" in data/*.json from "assets/tour/..." to "tour/...".
   ============================================================ */
