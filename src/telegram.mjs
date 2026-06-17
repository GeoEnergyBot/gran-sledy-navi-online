import crypto from 'node:crypto';

function safeCompare(a, b){
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function verifyTelegramInitData(initData, botToken, maxAgeSeconds=86400){
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now()/1000 - authDate) > maxAgeSeconds) return null;
  const dataCheckString = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeCompare(calculated, hash)) return null;
  try { return JSON.parse(params.get('user') || 'null'); } catch { return null; }
}

export function resolveIdentity(req, env){
  const initData = req.headers['x-telegram-init-data'];
  const verified = verifyTelegramInitData(initData, env.BOT_TOKEN);
  if (verified) {
    return { id:`tg:${verified.id}`, name:verified.first_name || verified.username || 'Проводник', username:verified.username || '', verified:true };
  }
  if (!env.DEMO_MODE) return null;
  const rawId = String(req.headers['x-player-id'] || '').replace(/[^a-zA-Z0-9:_-]/g,'').slice(0,80);
  if (!rawId) return null;
  const rawName = String(req.headers['x-player-name'] || 'Проводник').replace(/[<>]/g,'').slice(0,40);
  return { id:`demo:${rawId}`, name:rawName, username:'', verified:false };
}
