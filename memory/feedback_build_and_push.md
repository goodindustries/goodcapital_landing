---
name: Always build and push on every code change
description: After every code change, copy public/index.html → index.html (build) and git push to remote
type: feedback
---

After every code change: sync root index.html from public/index.html, commit, and push to origin main without asking.

**Why:** User expects Netlify to always reflect latest changes. Asking wastes time.

**How to apply:** At the end of every session where code was changed, run:
1. `cp public/index.html index.html` (keep in sync)
2. `git add -A && git commit -m "..."` (if not already committed)
3. `git push origin main`
