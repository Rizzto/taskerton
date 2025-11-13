# Username Demo Site (with shared bar)

This version adds a "recent usernames" bar that persists across visitors using **Netlify Functions + Netlify Blobs**.

## How it works
- Frontend calls `/.netlify/functions/usernames` to **GET** the last 20 usernames and **POST** new ones.
- The function stores a JSON array in a Blobs store called `usernames` (key: `all.json`).  
  Blobs are a simple, zero-config data store built into Netlify.

## Local dev
```bash
npm i
npm run dev   # runs `netlify dev`
# open the local URL shown in the terminal
```

> If you just open `index.html` directly from disk, the username bar will be hidden because the function endpoint isn't available.

## Deploy
Commit & push to GitHub. In Netlify, connect your repo:
- **Build command:** none
- **Publish directory:** `/`

Functions live in `netlify/functions` and deploy automatically.

## Files
- `index.html` — UI + fetch calls.
- `netlify/functions/usernames.js` — serverless function using `@netlify/blobs`.
- `netlify.toml` — sets functions directory.
- `package.json` — includes `@netlify/blobs` and `netlify-cli` for local dev.

## Notes
- This demo is intentionally simple and uses a single JSON document. For high traffic, consider adding optimistic concurrency (ETags) or writing each entry to its own key.
