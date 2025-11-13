// _sessions.js
import { getStore } from '@netlify/blobs';

const SESSIONS = getStore('sessions'); // one key per user (uid)

export async function setActiveSession(uid, sessionId) {
  const payload = { active: sessionId, updatedAt: Date.now() };
  await SESSIONS.set(`${uid}.json`, JSON.stringify(payload));
  return payload;
}

export async function getActiveSession(uid) {
  const raw = await SESSIONS.get(`${uid}.json`, { type: 'text' });
  if (!raw) return null;
  try { return JSON.parse(raw).active || null; } catch { return null; }
}
