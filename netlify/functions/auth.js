// netlify/functions/auth.js
// Register, login, session check, logout using Netlify Blobs + cookie sessions.
// Also creates an initial player document on registration.
// Demo only; not production-grade.
import { getStore } from "@netlify/blobs";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

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

  const store = getStore("auth-demo");
  const usersKey = "users.json";
  const sessionsKey = "sessions.json";

  const now = Date.now();
  const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 7; // 7 days

  // Load stores
  const usersRaw = await store.get(usersKey);
  /** @type {{[id: string]: { name: string, salt: string, hash: string, createdAt: number }}} */
  let users = usersRaw ? safeJson(usersRaw, {}) : {};

  const sessRaw = await store.get(sessionsKey);
  /** @type {{[sid: string]: { sid: string, uid: string, name: string, createdAt: number, expiresAt: number }}} */
  let sessions = sessRaw ? safeJson(sessRaw, {}) : {};

  if (action === "register") {
    let name = sanitizeName(body.username || "");
    const password = String(body.password || "");
    if (!validName(name)) return json({ error: "Username must be 3–30 chars (letters, numbers, space, _.-)" }, cors, 400);
    if (!validPassword(password)) return json({ error: "Password must be 6–100 chars" }, cors, 400);
    const id = toId(name);
    if (users[id]) return json({ error: "Username already exists" }, cors, 409);
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
    users[id] = { name, salt, hash, createdAt: now };
    await store.set(usersKey, JSON.stringify(users));

    // Create initial player doc
    const playerKey = `players/${id}.json`;
    const player = {
      uid: id,
      name,
      level: 1,
      xp: 0,
      perLevel: 100,
      perSec: 1,
      createdAt: now,
      lastXpAt: now,
      updatedAt: now
    };
    await store.set(playerKey, JSON.stringify(player));
    return json({ ok: true }, cors);
  }

  if (action === "login") {
    let name = sanitizeName(body.username || "");
    const password = String(body.password || "");
    if (!validName(name) || !validPassword(password)) return json({ error: "Invalid credentials" }, cors, 400);
    const id = toId(name);
    const u = users[id];
    if (!u) return json({ error: "User not found" }, cors, 404);
    const candidate = scryptSync(password, Buffer.from(u.salt, "hex"), 64).toString("hex");
    const ok = timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(u.hash, "hex"));
    if (!ok) return json({ error: "Invalid password" }, cors, 401);

    // Create session
    const sid = randomBytes(32).toString("hex");
    const expiresAt = now + sessionMaxAgeMs;
    sessions[sid] = { sid, uid: id, name: u.name, createdAt: now, expiresAt };
    await store.set(sessionsKey, JSON.stringify(sessions));

    const cookie = makeSessionCookie(sid, expiresAt, req);
    return json({ ok: true, name: u.name }, { ...cors, "Set-Cookie": cookie });
  }

  if (action === "session") {
    const { sid } = getSessionCookie(req.headers.get("cookie") || "");
    if (!sid || !sessions[sid]) return json({ ok: false }, cors, 200);
    const session = sessions[sid];
    if (session.expiresAt <= now) {
      // expire
      delete sessions[sid];
      await store.set(sessionsKey, JSON.stringify(sessions));
      const del = deleteCookie(req);
      return json({ ok: false }, { ...cors, "Set-Cookie": del }, 200);
    }
    // extend expiry (sliding)
    session.expiresAt = now + sessionMaxAgeMs;
    await store.set(sessionsKey, JSON.stringify(sessions));
    const cookie = makeSessionCookie(session.sid, session.expiresAt, req);
    return json({ ok: true, name: session.name }, { ...cors, "Set-Cookie": cookie });
  }

  if (action === "logout") {
    const { sid } = getSessionCookie(req.headers.get("cookie") || "");
    if (sid && sessions[sid]) {
      delete sessions[sid];
      await store.set(sessionsKey, JSON.stringify(sessions));
    }
    const del = deleteCookie(req);
    return json({ ok: true }, { ...cors, "Set-Cookie": del });
  }

  return json({ error: "Unknown action" }, cors, 400);
};

function sanitizeName(str) {
  return String(str).trim().replace(/[^\w\-\. ]/g, "");
}
function toId(name) { return name.toLowerCase().trim(); }
function validName(name) { return name && name.length >= 3 && name.length <= 30; }
function validPassword(pw) { return pw && pw.length >= 6 && pw.length <= 100; }

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

function makeSessionCookie(sid, expiresAt, req) {
  const proto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();
  const secure = proto === "https" ? "; Secure" : "";
  const expires = new Date(expiresAt).toUTCString();
  return `demo_session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expires}`;
}

function deleteCookie(req) {
  const proto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();
  const secure = proto === "https" ? "; Secure" : "";
  return `demo_session=; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function json(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function safeJson(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
