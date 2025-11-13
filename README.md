# Login/Register Demo — with Sessions + Logout

Adds cookie-based sessions on top of the earlier login/register demo.

## Endpoints
`/.netlify/functions/auth` (POST JSON)
- `{ action: "register", username, password }` → create user (scrypt-hashed)
- `{ action: "login", username, password }` → set `demo_session` HttpOnly cookie (7 days)
- `{ action: "session" }` → returns `{ ok: true, name }` if the cookie is valid; renews expiry (sliding)
- `{ action: "logout" }` → deletes the session + clears cookie

## Storage (Netlify Blobs)
- Store: `auth-demo`
  - `users.json` → `{ [lowerName]: { name, salt, hash, createdAt } }`
  - `sessions.json` → `{ [sid]: { sid, uid, name, createdAt, expiresAt } }`

## Local dev
```bash
npm i
npm run dev   # runs `netlify dev`
```
Open the local URL shown by the CLI. Cookies are set without `Secure` in dev; with `Secure` in production.

## Deploy
Push to GitHub and connect in Netlify. No build step required.

> Demo only: for production add CSRF protection, rate limiting, email verification, password reset, session rotation, and store sessions per-key (not a single JSON document) to reduce write contention.
