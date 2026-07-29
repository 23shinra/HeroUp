# Preview & staging notes (frontend-react)

## Goals

- Develop and preview the React app **without writing to production web root**.
- Production continues to serve `/var/www/train.esl.kz/*.html`, `css/styles.css`, `js/*.js`, `sw.js`, and `/assets/` at repo root.

## Local dev

```bash
# Terminal A — API (repo root)
npm start

# Terminal B — Vite (frontend-react/)
npm run dev
```

- Vite listens on its default port (5173) and proxies `/api` → `http://127.0.0.1:3021`.
- Static assets for the React app come from `frontend-react/public/assets/` (copied from production assets).

## Preview docroot (nginx / staging)

After a production build, sync `dist/` to a **separate** directory (never production):

```bash
cd frontend-react
npm run build
./scripts/prepare-preview-root.sh
```

- Default target: `/var/www/train-preview.esl.kz`
- Override: `FRONTEND_PREVIEW_ROOT=/var/www/my-preview ./scripts/prepare-preview-root.sh`
- Requires existing `frontend-react/dist/` (run `npm run build` first)
- Uses `rsync -a --delete` on the preview root only; `/var/www/train.esl.kz` is not modified

Point a staging vhost at `FRONTEND_PREVIEW_ROOT` for QA before any cutover.

## Production-like preview

```bash
cd frontend-react
npm run build
npm run preview
```

Optional PWA ( **preview/staging only** — not for silent production replacement):

```bash
VITE_PREVIEW_PWA=1 npm run build
npm run preview
```

The PWA plugin is **disabled** unless `VITE_PREVIEW_PWA=1`. This avoids registering a second service worker against the live site during normal dev builds.

## What must NOT happen during preview

- Do **not** copy `dist/` into `/var/www/train.esl.kz` manually without `scripts/cutover.sh` safeguards.
- Do **not** overwrite root `index.html`, other `*.html`, `sw.js`, `css/styles.css`, or production `js/*.js`.
- Do **not** symlink `frontend-react/dist` into the nginx docroot until an explicit cutover plan is approved.

## nginx / hosting (future)

Serve React preview on a separate vhost or path (e.g. `react.train.esl.kz` or `/app/`) until cutover. Document server changes outside this folder when ready.

## Cutover / rollback

See `scripts/cutover.sh` and `scripts/rollback.sh`. Both require explicit confirmation env vars and refuse the production root by default.

**Cutover is never run automatically** — deploy only by invoking `scripts/cutover.sh` manually with `CONFIRM=YES` and `TARGET_DIR`. Production root additionally requires `ALLOW_PRODUCTION_ROOT=YES`.
