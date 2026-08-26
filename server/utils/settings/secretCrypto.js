import crypto from 'crypto';

/*
  'secret' settings (API keys, webhook signing secrets, etc.) are encrypted at rest with
  AES-256-GCM. SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — generate
  one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

  Losing or rotating this key makes every stored secret unrecoverable, so it belongs in the same
  place as DATABASE_URL: set once per environment, backed up, never committed.
*/

export const SECRET_MASK = '••••••••';

const getKey = () => {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if(!raw){
    throw new Error('SETTINGS_ENCRYPTION_KEY environment variable is required to store secret settings');
  }
  const key = Buffer.from(raw, 'hex');
  if(key.length !== 32){
    throw new Error('SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
};

export const encryptSecret = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
};

export const decryptSecret = encoded => {
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
