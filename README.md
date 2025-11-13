# Sessions + Player Progress (offline XP)

Adds per-user player data that the game can use:
- **level** (starts at 1)
- **xp** (starts at 0)
- **+1 XP/second** continuously from account creation
- **Level up every 100 XP**
- Offline time is applied on login (retroactive)

## How it works
- On **register**, `auth.js` also creates `players/<uid>.json` with `{ level:1, xp:0, perLevel:100, perSec:1, lastXpAt:now }`.
- The frontend calls `/.netlify/functions/profile` with `{ action: "sync" }`:
  - Server calculates seconds since `lastXpAt` and adds XP.
  - Applies level-ups (while `xp >= 100`).
  - Updates `lastXpAt = now` and saves.
  - Returns `{ level, xp, perLevel, perSec }`.
- The UI animates +1 XP/second locally and re-syncs every 10s.

## Files
- `index.html` — UI showing Level + XP bar; login/register; logout; background sync.
- `netlify/functions/auth.js` — auth + session cookies; creates a player doc on registration.
- `netlify/functions/profile.js` — applies offline XP and returns updated player state.
- `netlify.toml` — functions directory.
- `package.json` — `@netlify/blobs` + `netlify-cli`.

## Local dev
```bash
npm i
npm run dev   # runs `netlify dev`
```

## Deploy
Push to GitHub and connect in Netlify (no build step).
