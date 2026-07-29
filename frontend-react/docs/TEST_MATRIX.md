# Test matrix — LevelUp React migration

## Unit / component (Vitest + Testing Library + jsdom)

Run: `npm run test` from `frontend-react/` (or `npm run frontend-react:test` from repo root).

| ID | Area | Scenario | Priority |
|----|------|----------|----------|
| U-01 | Router | Each production route renders without throw (`/`, `/auth`, `/map`, …) | P0 |
| U-02 | State | `defaultState()` matches shape from `js/state.js` | P0 |
| U-03 | State | Load/save round-trip for `sporthero.save.v2` | P0 |
| U-04 | State | Account binding normalizes username (lowercase trim) | P1 |
| U-05 | Sync | Outbox enqueue dedupes `saveState` to latest only | P0 |
| U-06 | Sync | Outbox dedupes attendance by date + type | P1 |
| U-07 | Sync | `flushOutbox` stops when offline; resumes on `online` | P1 |
| U-08 | API client | Attaches Bearer token from `sporthero.token` | P0 |
| U-09 | API client | Maps 401 to logout / re-auth flow | P0 |
| U-10 | Game data | Static tables from `js/data.js` imported unchanged | P1 |
| U-11 | Icons | Icon registry keys match `js/icons.js` | P2 |
| U-12 | Battle | In-memory battle flow does not require full page reload | P0 |
| U-13 | Reminders | `sporthero.reminders` tri-state: unset / `"1"` / `"0"` | P2 |
| U-14 | Components | Bottom nav hidden on auth/static routes | P1 |
| U-15 | Components | Toast queue shows and auto-dismisses | P2 |

### Suggested file layout

- `src/test/setup.js` — jest-dom
- `src/domain/**/*.test.js` — pure logic
- `src/features/**/*.test.jsx` — UI flows with RTL
- `src/router/AppRouter.test.jsx` — route smoke (extend U-01)

## Integration (Vitest + MSW optional)

| ID | Scenario | Notes |
|----|----------|-------|
| I-01 | Register → token stored → GET `/api/state` | Mock server or test SQLite |
| I-02 | PUT state offline → outbox → flush online | |
| I-03 | Child attendance POST queued offline | |
| I-04 | Trainer SSE reconnect on tab focus | May use mocked EventSource |

## E2E (Playwright — optional, not installed by default)

Install later: `npm install -D @playwright/test` in `frontend-react/`.

| ID | Flow | Steps | Priority |
|----|------|-------|----------|
| E-01 | Cold start | Open `/`, see hub or redirect to auth | P0 |
| E-02 | Register child | Guild code, consent links, land on map | P0 |
| E-03 | Training | Complete one skill session, XP updates | P0 |
| E-04 | Battle | Queue → arena → result → stats persist | P0 |
| E-05 | Shop | Purchase with coins, inventory updates | P1 |
| E-06 | Profile | Change password, logout, login again | P1 |
| E-07 | Rating | Leaderboard loads with auth | P1 |
| E-08 | Clan | Roster + chest claim | P1 |
| E-09 | Trainer | Approve attendance via dashboard | P1 |
| E-10 | Offline | Disable network, train, reconnect, state syncs | P0 |
| E-11 | PWA preview | Build with `VITE_PREVIEW_PWA=1`, preview mode installs SW | P2 |

### E2E environment

- Backend: `npm start` at repo root (port 3021 or `.env`).
- Frontend: `npm run dev` in `frontend-react/` with API proxy **or** `vite preview` on built `dist/`.
- Do **not** point Playwright at production root HTML during migration.

## Regression vs production

Before cutover, run manual smoke on production URLs and the same flows on React preview; tick items in `docs/PARITY.md`.

## CI suggestion (future)

```yaml
# pseudo
- run: npm run frontend-react:test
- run: npm run frontend-react:build
```
