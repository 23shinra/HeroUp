# Production parity checklist (LevelUp)

Track React migration against the live multi-page app at repo root (`*.html` + `js/app.js`).
Status key: `[ ]` not started · `[~]` in progress · `[x]` done

**React app:** feature-complete for preview; **production cutover still pending** (see `scripts/cutover.sh` — not auto-run).

## Routes / entry pages

Production uses one HTML file per screen; `window.__PAGE__` selects the initial view in `js/app.js`.

| Production file | `__PAGE__` | In-app routes (memory / hash) | React route target | Status |
|-----------------|------------|----------------------------------|--------------------|--------|
| `index.html` | `index` | hub / onboarding | `/` | `[x]` |
| `auth.html` | `auth` | registration / login | `/auth` | `[x]` |
| `map.html` | `map` | home map (`viewHome`) | `/map` | `[x]` |
| `skills.html` | `skills` | training skills | `/skills` | `[x]` |
| `battle.html` | `battle` | `battle`, `battle-arena`, `battle-result` (in-page) | `/battle` (+ nested state) | `[x]` |
| `shop.html` | `shop` | shop | `/shop` | `[x]` |
| `profile.html` | `profile` | profile / settings | `/profile` | `[x]` |
| `rating.html` | `rating` | leaderboard | `/rating` | `[x]` |
| `clan.html` | `clan` | guild roster / chest | `/clan` | `[x]` |
| `class-select.html` | `class-select` | hero class pick | `/class-select` | `[x]` |
| `parent.html` | `parent` | parent view | `/parent` | `[x]` |
| `trainer.html` | `trainer` | trainer dashboard | `/trainer` | `[x]` |
| `privacy.html` | (static) | — | `/privacy` | `[x]` |
| `terms.html` | (static) | — | `/terms` | `[x]` |

Navigation helpers in production: `PAGE_URLS` and `renderRoute()` in `js/app.js` (multi-page redirects vs in-page battle flow).

## Feature areas (by screen)

| Area | Production source | React module target | Status |
|------|-------------------|---------------------|--------|
| Auth / consent / guild preview QR | `renderAuth`, `js/api.js` | `src/features/auth` | `[x]` |
| Hero state (level, stats, inventory) | `js/state.js`, `js/data.js` | `src/domain/state`, `src/stores` | `[x]` |
| Map / daily hub | `viewHome`, `bindHome` | `src/features/map` | `[x]` |
| Skills / training minigames | `viewSkills`, `bindSkills` | `src/domain/game-engine`, `src/features/skills` | `[x]` |
| Battle matchmaking & arena | `viewBattle*`, battle state in memory | `src/features/battle` | `[x]` |
| Shop | `viewShop` | `src/features/shop` | `[x]` |
| Profile / account / push reminders | `viewProfile`, reminders localStorage | `src/features/profile` | `[x]` |
| Rating / leaderboard | `viewRating`, `SHApi.leaderboard` | `src/features/rating` | `[x]` |
| Clan / attendance / chest | `viewClan`, guild APIs | `src/features/clan` | `[x]` |
| Class select | `class-select` route | `src/features/class-select` | `[x]` |
| Parent portal | `viewParent` | `src/features/parent` | `[x]` |
| Trainer dashboard + SSE | `viewTrainer`, `EventSource` guild events | `src/features/trainer` | `[x]` |
| Icons / assets | `js/icons.js`, `/assets/*` | `src/domain/icons`, `public/assets` | `[x]` |
| Toast / bottom nav | `#nav`, `#toast` in HTML shells | `src/components` | `[x]` |
| PWA / offline | `sw.js`, `manifest.webmanifest` | Vite PWA (preview only until cutover) | `[~]` |

## REST API (`/api`, client: `window.SHApi` in `js/api.js`)

All requests use `Authorization: Bearer <token>` unless noted.

| Method | Path | SHApi / usage | Status |
|--------|------|---------------|--------|
| GET | `/api/health` | health probe | `[x]` |
| POST | `/api/register` | `register` | `[x]` |
| POST | `/api/login` | `login` | `[x]` |
| GET | `/api/state` | `getState` | `[x]` |
| PUT | `/api/state` | `saveState`, offline `saveStateQueued` | `[x]` |
| GET | `/api/leaderboard` | `leaderboard` | `[x]` |
| POST | `/api/attendance` | `requestAttendance` (child) | `[x]` |
| POST | `/api/attendance/leave` | `requestLeaveAttendance` | `[x]` |
| GET | `/api/attendance/mine` | `myAttendance` | `[x]` |
| GET | `/api/guild/roster` | `guildRoster` | `[x]` |
| POST | `/api/guild/chest/claim` | `claimGuildChest` | `[x]` |
| GET | `/api/progress/summary?period=` | `progressSummary` | `[x]` |
| GET | `/api/push/vapid-public-key` | `pushVapidKey` | `[x]` |
| POST | `/api/push/subscribe` | `pushSubscribe` | `[x]` |
| POST | `/api/push/unsubscribe` | `pushUnsubscribe` | `[x]` |
| GET | `/api/guild/preview?code=` | `guildPreview` (public) | `[x]` |
| GET | `/api/guild/qr` | QR generation (trainer) | `[x]` |
| GET | `/api/guild/info` | `guildInfo` (trainer) | `[x]` |
| PUT | `/api/guild/sport` | `setGuildSport` | `[x]` |
| GET | `/api/guild/members` | `guildMembers` | `[x]` |
| GET | `/api/guild/attendance` | `guildAttendance` | `[x]` |
| POST | `/api/attendance/:id/decision` | `decideAttendance` | `[x]` |
| POST | `/api/attendance/:id/leave-decision` | `decideLeaveAttendance` | `[x]` |
| PUT | `/api/guild/member/:childId/schedule` | `setMemberSchedule` | `[x]` |
| PUT | `/api/guild/schedule` | `setGuildSchedule` | `[x]` |
| DELETE | `/api/guild/member/:childId` | `removeGuildMember` | `[x]` |
| POST | `/api/guild/member/:childId/transfer` | `transferGuildMember` | `[x]` |
| POST | `/api/account/password` | `changePassword` | `[x]` |
| POST | `/api/account/logout-all` | `logoutAll` | `[x]` |
| DELETE | `/api/account` | `deleteAccount` | `[x]` |
| GET | `/api/child/events?token=` | SSE child updates (`EventSource`) | `[x]` |
| GET | `/api/guild/events?token=` | SSE trainer updates | `[x]` |

Dev proxy: Vite `server.proxy` → `http://127.0.0.1:3021` (same as Express backend).

## localStorage / client persistence

| Key | Purpose | React owner | Status |
|-----|---------|-------------|--------|
| `sporthero.token` | JWT session | `src/domain/sync` or API client | `[x]` |
| `sporthero.outbox.v1` | Offline mutation queue | `src/domain/sync` | `[x]` |
| `sporthero.save.v2` | Local hero state snapshot | `src/domain/state` | `[x]` |
| `sporthero.account` | Bound username (normalized) | `src/domain/state` | `[x]` |
| `sporthero.reminders` | Push reminder opt-in (`"1"` / `"0"`) | `src/features/profile` | `[x]` |
| `sporthero.save.v1` | Legacy (removed on load in `state.js`) | migrate-on-read once | `[x]` |

Events: `sporthero-sync` `CustomEvent` on outbox changes (replicate for UI badges).

## Service worker / cache (production reference)

- Cache name: `sporthero-v225` in root `sw.js` (do not modify during React dev).
- React preview PWA is separate (`vite-plugin-pwa`, opt-in via `VITE_PREVIEW_PWA=1`).

## Cutover notes

- Until cutover, production continues to serve root `*.html` and `sw.js`.
- React build output lives in `frontend-react/dist` only.
- **`scripts/cutover.sh` is NOT run automatically** — invoke manually after full parity sign-off (see `scripts/preview-notes.md`).
- Cutover backs up vanilla `*.html`, `js/`, `css/`, `sw.js`, and manifest to `_vanilla_backup_<timestamp>` before rsync.
