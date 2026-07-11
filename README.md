# amy myan — portfolio site

A plain HTML/CSS/JS site, no build step, built to run on GitHub Pages.

## Structure

```
index.html           home
music.html            draggable photo/video board → reads data/music.json
portrait.html         gallery page → reads data/portrait.json
projects.html         gallery page → reads data/projects.json
tour.html              gallery page → reads data/tour.json
about.html             bio / contact / credits page
organizer.html        PRIVATE — your local tool for adding/arranging photos & videos

css/style.css          shared look (colors, fonts, nav, gallery grid, cursor)
css/board.css          just the music page's draggable board
js/gallery.js           loads a gallery page's photos from its JSON file
js/board.js             drag logic for the public music board
js/organizer.js         the organizer tool's logic

data/*.json             one file per page — list of photos/videos + captions
assets/<page>/           the actual image/video files live here, organized by page
```

## Adding photos & videos (the organizer)

`organizer.html` is your private control panel. **Never link to it from your
live site's nav** — it isn't password-protected. It doesn't need to be,
because of *how* it works:

- It uses a browser feature called the File System Access API, which lets a
  page write files directly onto **your own computer** once you grant it
  permission — it can't reach anyone else's files or run on someone else's
  visit. This only works in **Chrome or Edge** (not Firefox or Safari).
- Only you will ever click "choose project folder" and pick this repo. So
  even though the file technically loads for anyone with the link, it can't
  actually do anything without you sitting there granting folder access.

### To use it:

1. Open `organizer.html` by double-clicking it (or dragging it into Chrome).
2. Click **"choose project folder"** and select this project's root folder
   (the one with `index.html` in it).
3. Under **music board**: click "+ add photos/videos", drag them into
   place on the mini board, click directly on a caption to edit it.
4. Under **gallery pages**: pick a page from the dropdown (portrait /
   projects / tour), add photos/videos, reorder with the ↑/↓ buttons, edit
   captions.
5. Everything saves automatically — it copies your files into `assets/` and
   updates the right `data/*.json` file as you go. No "save" button needed.
6. Once you're happy, commit and push the changed files to GitHub like normal.

For the about page's photo, just drop a file named `portrait.jpg` into
`assets/about/` (no organizer support for that one yet — it's a single
static image, easiest to just replace the file directly).

## Adding another gallery page

`portrait.html`, `projects.html`, and `tour.html` are all the same template.
To add a new one (say, `bts.html`):

1. Copy `portrait.html` → `bts.html`.
2. In `bts.html`, change the `<title>` and
   `data-source="data/portrait.json"` → `data-source="data/bts.json"`.
3. Add `<a href="bts.html">bts</a>` to the nav in every page (including this
   new one, with `aria-current="page"`).
4. Create an empty `data/bts.json` containing `[]`.
5. Add a `bts` option to the `<select id="gallery-select">` list in
   `organizer.html` so the organizer knows about it.

## Deploying to GitHub Pages

1. Push this whole folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch",
   pick your main branch and the `/ (root)` folder, then save.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`
   within a minute or two.
5. To use your own domain, add a `CNAME` file at the root containing just
   your domain name, point your registrar's DNS at GitHub's servers, then
   enter the domain in Settings → Pages.

Because this is a fully static site (no server, no database), every photo
and video has to actually exist as a file in `assets/` and be committed to
the repo — the organizer handles copying them there for you, but *you* still
need to push those commits for the live site to update.

## A note on the music page's dragging

On the live site, anyone visiting `music.html` can drag the photos around
for fun — their arrangement is remembered only in *their own* browser. The
*starting* layout everyone sees on first visit is whatever you set in
`data/music.json` via the organizer.

## Customizing the look

Almost everything visual is controlled from the top of `css/style.css`:

- Colors: the `:root { ... }` block — `--flash` is the pink hover color,
  `--gold` is the sparkle color, `--paper`/`--ink` are background/text.
- Fonts: same block, `--display`/`--body`/`--mono` — swap in any font name
  from [Google Fonts](https://fonts.google.com) and update the `@import`
  line above it to match.
- Cursor: the `cursor: url(...)` line on `html,body` — swap in any image URL
  (ideally a small, locally-hosted PNG for reliability — a hotlinked image
  can disappear if the source site ever takes it down).
