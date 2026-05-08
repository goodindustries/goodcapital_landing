# The Good Project — Landing Page

Landing page for The Beehive / The Good Project nonprofit disaster preparedness hub (Springfield, MO).

## Architecture

**No build framework.** Single-file static site.

| File | Purpose |
|------|---------|
| `public/index.html` | **Canonical source** — edit this |
| `index.html` | Root mirror of `public/index.html` — never edit directly |
| `public/assets/` | Images, fonts |

**Netlify is configured with no build command.** It publishes the `public/` directory as a plain static site and serves serverless functions from `netlify/functions/`.

The root `index.html` is kept in sync for repo-level previews, direct local opens, and any tooling that expects a root entrypoint. All building happens locally.

## Workflow

```bash
# 1. Edit the source
vim public/index.html

# 2. Build (sync root copy)
cp public/index.html index.html

# 3. Commit and push — Netlify auto-deploys
git add public/index.html index.html
git commit -m "..."
git push origin main
```

Every code change must include the `cp` step before pushing so `public/index.html` and the root mirror stay identical.

## Local Development

```bash
# Serve locally on port 8888
./serve.sh
# → http://localhost:8888
```

## Regression Screenshots

Requires Node + Puppeteer. Run the local server first, then:

```bash
./serve.sh &
node diagnostics/screenshot.js
# Screenshots written to diagnostics/screens/
```

Viewports covered: iPhone SE, iPhone 14, iPhone 14 Max, iPad, Laptop 1280, Desktop 1440 — portrait and landscape.

## Branch

`main` is the production branch. Netlify deploys from `main`.
