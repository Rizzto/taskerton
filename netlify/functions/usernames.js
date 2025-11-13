// netlify/functions/usernames.js
// A tiny JSON API backed by Netlify Blobs.
// GET  -> returns { usernames: [{ name, ts }] } (most recent first, max 20)
// POST -> body: { username } pushes to the list
import { getStore } from "@netlify/blobs";

/** @param {Request} req @param {import('@netlify/functions').Context} context */
export default async (req, context) => {
  const store = getStore("usernames");
  const key = "all.json";

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response("", { headers: cors });

  if (req.method === "GET") {
    const raw = await store.get(key);
    const list = raw ? safeJson(raw, []) : [];
    // last 20, newest first
    list.sort((a,b) => (b?.ts ?? 0) - (a?.ts ?? 0));
    const recent = list.slice(0, 20);
    return json({ usernames: recent }, cors);
  }

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    let name = (body.username || "").trim();
    if (!name || name.length < 2 || name.length > 30) {
      return json({ error: "Invalid username" }, cors, 400);
    }
    // allow letters/numbers/underscore/dash/dot/space; strip anything else
    name = name.replace(/[^\w\-\. ]/g, "");

    let list = [];
    const existing = await store.get(key);
    if (existing) list = safeJson(existing, []);
    const lower = name.toLowerCase();
    list = list.filter(e => (e && (e.name || "").toLowerCase()) !== lower);
    list.push({ name, ts: Date.now() });
    await store.set(key, JSON.stringify(list));
    return json({ ok: true }, cors);
  }

  return new Response("Method Not Allowed", { status: 405, headers: cors });
};

function json(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function safeJson(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
