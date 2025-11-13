// netlify/functions/profile.js
// Applies offline XP and returns current player state for the logged-in session.
// XP rules: +1 XP/second continuously since lastXpAt; level up every 100 XP.
import { getStore } from "@netlify/blobs";

/** @param {Request} req @param {import('@netlify/functions').Context} context */
export default async (req, context) => {
  const cors = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
  if (req.method === "OPTIONS") return new Response("", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, cors, 405);

  let body = {};
  try { body = await req.json(); } catch {}
  const action = (body.action || "").toLowerCase();
  if (action !== "sync") return json({ error: "Unknown action" }, cors, 400);

  const { sid } = getSessionCookie(req.headers.get("cookie") || "");
  const store = getStore("auth-demo");
  const sessionsKey = "sessions.json";

  const sessRaw = await store.get(sessionsKey);
  const sessions = sessRaw ? safeJson(sessRaw, {}) : {};
  const session = sid ? sessions[sid] : null;
  if (!session) return json({ error: "Unauthorized" }, cors, 401);

  const playerKey = `players/${session.uid}.json`;
  const raw = await store.get(playerKey);
  if (!raw) return json({ error: "No player data" }, cors, 404);
  const p = safeJson(raw, null);
  if (!p) return json({ error: "Invalid player data" }, cors, 500);

  const now = Date.now();
  const perLevel = Number(p.perLevel) || 100;
  const perSec = Number(p.perSec) || 1;

  // apply offline progress
  const lastAt = Number(p.lastXpAt || p.createdAt || now);
  const deltaSec = Math.max(0, Math.floor((now - lastAt) / 1000));
  if (deltaSec > 0) {
    p.xp = Number(p.xp || 0) + deltaSec * perSec;
    p.lastXpAt = now;
    // level-ups
    let loops = 0;
    while (p.xp >= perLevel && loops < 100000) {
      p.level = Number(p.level || 1) + 1;
      p.xp -= perLevel;
      loops++;
    }
    p.updatedAt = now;
    await store.set(playerKey, JSON.stringify(p));
  }

  return json({
    ok: true,
    name: p.name,
    level: p.level || 1,
    xp: p.xp || 0,
    perLevel,
    perSec,
    serverTime: now
  }, cors);
};

function getSessionCookie(cookieHeader) {
  const map = Object.fromEntries((cookieHeader || "").split(/; */).filter(Boolean).map(kv => {
    const idx = kv.indexOf("=");
    if (idx === -1) return [kv, ""];
    const k = decodeURIComponent(kv.slice(0, idx).trim());
    const v = decodeURIComponent(kv.slice(idx + 1).trim());
    return [k, v];
  }));
  return { sid: map["demo_session"] || null };
}

function json(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function safeJson(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
