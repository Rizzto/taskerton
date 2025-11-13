// _cookies.js
export function parseCookies(headers) {
  const cookie = headers.cookie || headers.Cookie || '';
  return Object.fromEntries(
    cookie.split(';').map(v => v.trim()).filter(Boolean).map(v => {
      const idx = v.indexOf('=');
      return [decodeURIComponent(v.slice(0, idx)), decodeURIComponent(v.slice(idx + 1))];
    })
  );
}

export function makeCookie(name, value, { maxAgeSec = 60 * 60 * 24 * 30, path = '/', secure = true, httpOnly = true, sameSite = 'Lax', domain } = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSec}`,
    `SameSite=${sameSite}`,
    httpOnly ? 'HttpOnly' : '',
    secure ? 'Secure' : '',
    domain ? `Domain=${domain}` : ''
  ].filter(Boolean);
  return parts.join('; ');
}

export function clearCookie(name) {
  return `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}
