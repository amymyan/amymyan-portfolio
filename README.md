# amy myan — portfolio site

A plain HTML/CSS/JS site, no build step, built to run on GitHub Pages.
Every file has comments in it (`/* ... */` blocks) explaining what each part
does — open any file in VS Code and read through them before editing.

## Structure

```
index.html              home — 2x2 photo grid linking to each section
music.html               draggable, resizable photo/video board
portrait.html            simple photo grid → reads data/portrait.json
tour.html                 simple photo grid → reads data/tour.json
projects.html            projects listing — board of cover photos that
                           link out to each project's own page
project-example.html    TEMPLATE — duplicate this for each real project
about.html                bio / contact / credits page
organizer.html           PRIVATE — your local tool for adding/arranging photos & videos

css/style.css             shared look: colors, fonts, background, nav, footer
css/board.css             the draggable/resizable board + lightbox (shared by
                           music.html, projects.html, and every project-*.html)
js/gallery.js              loads a simple grid page's photos (portrait/tour)
js/board.js                board logic: drag, resize, lightbox, mobile grid
js/organizer.js            the organizer tool's logic

data/*.json                one file per page — list of photos/videos
assets/<page>/              the actual image/video files, organized by page
assets/home/                the 4 fixed home page tile images
assets/cursor.png          your custom cursor image (see note below)
```

## The "board" pages: music, projects, and every project page

`music.html`, `projects.html`, and every `project-*.html` page all use the
same system (`css/board.css` + `js/board.js`). Here's how it behaves:

- **On a laptop or tablet (wide screen):** photos scatter freely at
  whatever position and size you set in the organizer. Visitors can drag
  them around. Clicking a photo (without dragging it) opens it full-size
  in a **lightbox** — a dark overlay showing the original image.
- **On a phone (narrow screen, 700px wide or less):** photos lay out in a
  simple wrapping grid instead of scattering everywhere, so it stays tidy
  on a small screen. Photos can still be dragged to reorder them relative
  to each other, just not scattered freely.
- **Resizing:** every photo's on-screen width is something *you* choose in
  the organizer (via a slider) — its height then follows automatically so
  it never looks stretched or squished. This means you can upload a
  full-resolution photo but have it display smaller on the page; visitors
  who want to see it at full size just click it to open the lightbox.

### The projects page specifically

`projects.html` is a board too, but with two differences: each cover photo
shows a visible caption (its project title), and clicking a cover photo (or
its caption) takes the visitor to that project's own page instead of
opening a lightbox. That's controlled by an `"href"` field on each entry in
`data/projects.json`.

Each individual project page (like `project-example.html`) is its own
regular board — full-size photos/videos, draggable, resizable, with a
lightbox on click — plus a "← back to projects" link at the top.

### Adding a new project

1. Duplicate `project-example.html`, rename it (e.g. `project-red-rocks.html`)
2. Duplicate `data/project-example.json`, rename it to match
   (e.g. `data/project-red-rocks.json`)
3. In your new HTML file, change `data-source="data/project-example.json"`
   to point at your new JSON file, and update the `<title>`
4. Create a new `assets/project-red-rocks/` folder for its photos/videos
5. Add a new entry to `data/projects.json` with `"href": "project-red-rocks.html"`
   and `"caption"` set to the project's title — this makes it show up as a
   cover photo on the projects listing page
6. In `organizer.html`, add a matching `<option>` to the "board" dropdown
   (there's a comment right above it in the code showing exactly how)

## Adding photos & videos (the organizer)

`organizer.html` is your private control panel. **Never link to it from your
live site's nav** — it isn't password-protected. It doesn't need to be,
because it uses a browser feature (the File System Access API) that lets a
page write files directly onto **your own computer** once you grant it
permission — it only works because you're the one sitting there granting
folder access. Only works in **Chrome or Edge** (not Firefox/Safari).

### To use it:

1. Open `organizer.html` (double-click it, or drag it into Chrome).
2. Click **"choose project folder"** and select this project's root folder.
3. **"boards" tab** — pick music / projects / a specific project from the
   dropdown. Add photos, drag them to position, drag the slider under each
   one to resize it, click a caption to edit it. On the projects board only,
   there's also a small text field above each photo for which page it
   should link to.
4. **"simple photo grids" tab** — for portrait/tour only. Add photos,
   reorder with ↑/↓, edit captions.
5. Everything saves automatically. Commit + push when you're happy.

### The 4 home page photos & about page photo

These aren't managed by the organizer since there's always exactly one
fixed photo per spot — just replace the file directly:
- `assets/home/music.jpg`, `assets/home/portrait.jpg`,
  `assets/home/projects.jpg`, `assets/home/tour.jpg`
- `assets/about/portrait.jpg`

## Fixing the custom cursor

The cursor points at `assets/cursor.png`, which needs to be added manually
(hotlinking directly to another website's image is unreliable — many sites
block it, which is likely why it wasn't showing up):

1. Open the sparkle image in your browser and save it (right-click → Save
   Image As) as `cursor.png`
2. Put it directly inside this project's top-level `assets/` folder
3. Commit and push

If it looks too big or off-center, resize it down to roughly 32x32 pixels
first (Preview on Mac: Tools → Adjust Size).

## Deploying to GitHub Pages

1. Push this whole folder to a GitHub repo.
2. **Settings → Pages** → Source: "Deploy from a branch" → `main` branch,
   `/ (root)` folder → Save.
3. Live at `https://<username>.github.io/<repo-name>/` within a minute or two.
4. For your own domain: add a `CNAME` file at the root containing just your
   domain name, point your registrar's DNS at GitHub's servers, then enter
   the domain in Settings → Pages.

## Customizing the look

Nearly everything visual is controlled from the top of `css/style.css`:

- **Colors** — the `:root { ... }` block. `--paper` is the background
  (pure white), `--ink` is text (pure black), `--flash` is the pink hover
  color, `--line` is light gray used only for empty placeholders/dividers.
- **Fonts** — same block, currently all set to Times New Roman.
- **Nav wording** — search each HTML file for `nav-links`.
- **Cursor** — the `cursor: url(...)` line on `html,body`.
- **Board behavior** (mobile breakpoint, click-vs-drag sensitivity, default
  photo size) — the constants explained in comments near the top of `js/board.js`.
