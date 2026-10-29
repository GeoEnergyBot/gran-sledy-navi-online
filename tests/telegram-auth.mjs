import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from '../src/telegram.mjs';

const botToken='test-bot-token';
const fields=new URLSearchParams({
  auth_date:String(Math.floor(Date.now()/1000)),
  chat_instance:'-123456789',
  chat_type:'channel',
  signature:'third-party-signature',
  user:JSON.stringify({id:42,first_name:'Проводник'}),
});
const dataCheckString=[...fields.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\n');
const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
fields.set('hash',crypto.createHmac('sha256',secret).update(dataCheckString).digest('hex'));

assert.deepEqual(verifyTelegramInitData(fields.toString(),botToken),{id:42,first_name:'Проводник'});
fields.set('signature','tampered-signature');
assert.equal(verifyTelegramInitData(fields.toString(),botToken),null,'tampered signature field must be rejected by HMAC');
fields.set('user',JSON.stringify({id:43,first_name:'Изменённый'}));
assert.equal(verifyTelegramInitData(fields.toString(),botToken),null,'tampered initData must be rejected');

console.log('✓ Telegram initData verifies the bot-token HMAC across all fields, including signature');
console.log('✓ Telegram initData rejects a tampered signature field');
console.log('✓ Telegram initData rejects tampered user data');
