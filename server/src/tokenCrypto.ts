import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Verschlüsselt die Garmin-Session-Tokens (NICHT das Passwort selbst - das wird
// nur für den einmaligen Login gebraucht und nie gespeichert) vor der Ablage im
// SnapshotStore/GarminSessionStore. AES-256-GCM mit zufälligem IV pro Aufruf;
// der Schlüssel kommt aus GARMIN_TOKEN_ENCRYPTION_KEY (beliebige, ausreichend
// lange Zeichenkette - wird per scrypt auf 32 Byte normiert, kein Base64/Hex
// nötig beim Setzen der Env-Variable).

const ALGORITHM = 'aes-256-gcm';
const SALT = 'paceforge-garmin-token-v1'; // fest, da der Schlüssel selbst schon geheim ist

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function isEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GARMIN_TOKEN_ENCRYPTION_KEY?.trim());
}

export function encryptText(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.GARMIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error('GARMIN_TOKEN_ENCRYPTION_KEY nicht gesetzt.');
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, alles base64 - eine Zeichenkette, leicht in Redis ablegbar.
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptText(payload: string, env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.GARMIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error('GARMIN_TOKEN_ENCRYPTION_KEY nicht gesetzt.');
  const [ivB64, authTagB64, dataB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error('Ungültiges verschlüsseltes Token-Format.');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
