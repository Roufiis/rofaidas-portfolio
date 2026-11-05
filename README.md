# Rofaida's Portfolio

The portfolio website of **Rofaida Abdelwahap**, product and visual designer.
A hand-painted world you move through: Home, Selected works and About me are faces of one turning scene,
with case studies (Maaliy, Sadeem, Dhi, MNT-Halan), app and web UI (NEXA, VYBE, Lumiere) and graphics
(Graphic Design Portfolio 2024, Breadfast and Kilo Kabab, Traubi, Dalya).

## Deploy

Everything the site needs is in `site/`. It is plain HTML, CSS and JavaScript: no framework, no build step.
Upload the **contents of `site/`** to any static host and point your domain at it.

| Host | How |
| --- | --- |
| Netlify (current) | Connected to this repo: every push to `main` redeploys. Publish directory `site` is set in `netlify.toml`. |
| Vercel | Import the repo; `vercel.json` serves `site/`. |
| Cloudflare Pages | Connect the repo, build command empty, output directory `site`. |
| Any server (Nginx, Apache, cPanel) | Copy the contents of `site/` into the web root. |

Then add your custom domain in the host's settings.

GitHub Pages is not used: this repo is private, and free GitHub accounts only get Pages on public repos.

## Run it locally

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

Use a local server rather than opening `index.html` directly, so images, sounds and data load.

## Structure

```
site/
  index.html        page markup
  css/style.css     all styles
  js/main.js        all behaviour (the turning world, works, case studies, About, journal, keychain)
  js/videos.js      drops video players whose video file isn't included, so their poster shows
  f/                project images (one folder per case study: maaliy/, sadeem/, halan/, works/ ...)
  a/                backgrounds, sky and the meow sound
  l/                the painted hero layers (day and night)
  keychain/         the skills keychain
  m/                the "meadow sound" music
  i/                icons
  data/edits.json   text edits saved from the page editor (applied on load)
```

## Editing content

- Project and case-study text, images and Behance links live in the `CASES` list near the top of the case-study section of `js/main.js` (search for `id: "maaliy"`).
- The All works list is in `index.html` (search for `aw-row`).
- Add images to `site/f/<project id>/` and reference them by file name.
- Graphics projects open their Behance gallery; every other project opens its case page.

© Rofaida Abdelwahap. All artwork, illustrations and case-study content are hers; please don't reuse them without permission.
