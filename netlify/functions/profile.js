// profile.js
import { getStore } from '@netlify/blobs';
import { parseCookies } from './_cookies.js';
import { getActiveSession } from './_sessions.js';

const PLAYERS = getStore('players');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method Not Allowed' });

  const cookies = parseCookies(event.headers);
  const uid = cookies.uid;
  const sid = cookies.sid;

  if (!uid || !sid) return resp(401, { error: 'Not authenticated' });

  // 1) single-session gate
  const active = await getActiveSession(uid);
  const isActive = active && active === sid;

  // 2) load player
  const raw = await PLAYERS.get(`${uid}.json`, { type: 'text' });
  if (!raw) return resp(404, { error: 'Player not found' });

  let player = JSON.parse(raw);

  // 3) always apply offline XP (so we SAVE progress even if we’ll log them out)
  const now = Date.now();
  const elapsedSec = Math.max(0, Math.floor((now - (player.lastXpAt || now)) / 1000));
  if (elapsedSec > 0) {
    player.xp = (player.xp || 0) + elapsedSec * (player.perSec || 1);
    player.lastXpAt = now;
    const perLevel = player.perLevel || 100;
    while (player.xp >= perLevel) {
      player.level = (player.level || 1) + 1;
      player.xp -= perLevel;
    }
    await PLAYERS.set(`${uid}.json`, JSON.stringify(player));
  }

  // 4) if NOT active, force client to logout AFTER we saved
  if (!isActive) {
    return resp(409, {
      ok: false,
      forceLogout: true,
      reason: 'session_revoked',
      player // optional: send latest so UI can animate one last time
    });
  }

  // 5) normal success (active session)
  return resp(200, {
    ok: true,
    player
  });
};

function resp(statusCode, json) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) };
}
