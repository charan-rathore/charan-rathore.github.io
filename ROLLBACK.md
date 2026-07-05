# Rollback Guide — Portfolio Redesign (Jul 6, 2026)

The previous design is preserved in **three** places so you can revert anytime.

## Snapshot details

| Method | Reference |
|--------|-----------|
| **Git tag** | `v1.0-pre-redesign` |
| **Git branch** | `backup/pre-redesign-2026-07-06` |
| **File copy** | `index.original.html` (exact single-file backup) |
| **Original commit** | `17e77b7` — *fix: replace em dash with period in X disclaimer* |

## Quick rollback (recommended)

```bash
cd ~/Documents/charan-rathore.github.io

# Option A: restore the exact original index.html only
cp index.original.html index.html
git checkout HEAD -- 404.html   # if 404 was also changed
rm -rf assets/                  # remove new CSS/JS folders (optional)

# Option B: full revert to tagged snapshot
git checkout v1.0-pre-redesign -- index.html 404.html
git clean -fd assets/           # removes untracked assets/ if needed
```

## Full branch rollback

```bash
cd ~/Documents/charan-rathore.github.io
git checkout backup/pre-redesign-2026-07-06
# or merge/revert the redesign commit after pushing
```

## What changed in the redesign

- **Layout**: Astha Jain–inspired floating pill nav, oversized hero typography, stat blocks in hero
- **Palette**: Warm orange / purple / cyan gradient accents (replacing navy + teal)
- **Typography**: Syne (display) + DM Sans (body)
- **Originkit-inspired effects** (vanilla JS/CSS, no React dependency):
  - Rising Lines canvas background
  - Mesh gradient orbs + Mesh Text Hover on hero highlights
  - Scramble Text on section tags and hero subtitle
  - Shiny Pill on status chip and Contact nav CTA
  - Text Lift on project titles
  - Spotlight glow on contact section
  - Card mouse-tracking spotlight on projects
- **Structure**: CSS/JS split into `assets/css/style.css` and `assets/js/effects.js`
- **Preserved**: All content, links, journey timeline, music player, projects, contact info

## Deploy after rollback

```bash
git add -A
git commit -m "revert: restore pre-redesign portfolio"
git push origin main
```

GitHub Pages will redeploy automatically via the existing workflow.
