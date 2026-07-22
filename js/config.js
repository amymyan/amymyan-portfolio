/* ============================================================
   MEDIA HOSTING — Cloudflare R2
   ============================================================

   STEP 1 — Enable public access on your bucket:
     Cloudflare dashboard → R2 → your bucket → Settings
     → Public Development URL → Enable
     Copy the URL (looks like https://pub-abc123xyz.r2.dev)

   STEP 2 — Verify a file loads in your browser.
     Your JSON paths look like:  assets/video/my-clip.mp4
     Test this URL in Chrome (replace with your real pub URL + filename):
       https://pub-abc123xyz.r2.dev/assets/video/my-clip.mp4

   STEP 3 — Paste your pub URL below (no trailing slash):

   ============================================================ */

window.MEDIA_BASE_URL = 'https://pub-a296b21e7cf6462a8d3760710a67b7ae.r2.dev';

/* Resize photos for faster page loads (Cloudflare Image Resizing on your Pages/custom domain).
   Lightbox still loads full-size originals from R2. */
window.DISPLAY_IMAGE_CDN_PARAMS = 'width=1400,quality=82,format=auto';

/* FOLDER STRUCTURE NOTE
   The site builds URLs as:  MEDIA_BASE_URL + "/" + path-from-json
   Example: https://pub-xxx.r2.dev/assets/video/my-clip.mp4

   Your bucket should look like:
     assets/
       video/
         my-clip.mp4
       music/
       cursor.png
       ...
   ============================================================ */
