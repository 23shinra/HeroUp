# React cutover checklist

**Do not cut over to production without explicit human approval.** Automated agents and CI must **never** run `scripts/cutover.sh` against `/var/www/train.esl.kz`.

## Pre-flight gates (all required)

- [ ] `frontend-react`: `npm test` — all unit tests green
- [ ] `frontend-react`: `npm run build` — production build succeeds
- [ ] Parity review complete (`docs/PARITY.md`, manual QA on preview host)
- [ ] Preview deployed via `scripts/prepare-preview-root.sh` (or `npm run preview`) and signed off
- [ ] Production still serves vanilla client: `#app` / `#screen`, `./js/app.js`, `sw.js` cache `sporthero-v225` (or current version)
- [ ] Database/API migrations (if any) deployed and verified separately
- [ ] Rollback path tested on **staging** using `_vanilla_backup_*` + `scripts/rollback.sh`
- [ ] On-call owner identified; maintenance window communicated if needed

## Preview-only workflow (safe default)

```bash
cd frontend-react
npm test && npm run build
./scripts/prepare-preview-root.sh
# nginx vhost → FRONTEND_PREVIEW_ROOT (default /var/www/train-preview.esl.kz)
```

Optional PWA on preview only:

```bash
VITE_PREVIEW_PWA=1 npm run build
./scripts/prepare-preview-root.sh
```

## Production cutover (human-only)

1. Build: `cd frontend-react && npm run build`
2. **Human** sets env and runs cutover manually:

   ```bash
   CONFIRM=YES ALLOW_PRODUCTION_ROOT=YES TARGET_DIR=/var/www/train.esl.kz \
     ./scripts/cutover.sh
   ```

3. Type `DEPLOY` at the prompt when prompted.
4. Verify live site: auth, battle, sync, push (if enabled), offline behavior.
5. Note backup path printed by cutover (`_vanilla_backup_YYYYMMDD-HHMMSS`).

**If any step is skipped or ambiguous, stop — do not cutover without human CONFIRM.**

## Rollback

```bash
CONFIRM=YES ALLOW_PRODUCTION_ROOT=YES TARGET_DIR=/var/www/train.esl.kz \
  ./scripts/rollback.sh
```

Uses newest `_vanilla_backup_*` under `TARGET_DIR` unless `BACKUP_DIR` or `VANILLA_BACKUP` is set. Type `ROLLBACK` at the prompt.

## Files that must not be changed during migration work

Unless executing an approved cutover:

- Production root `*.html`, `css/styles.css`, `sw.js`, `js/*.js`
- Do not rsync `dist/` into `/var/www/train.esl.kz` except via gated `cutover.sh`
