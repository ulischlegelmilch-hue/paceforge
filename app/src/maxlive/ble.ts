// Feste UUIDs für "Live mithören per Bluetooth" (siehe PaceForge Kids' BleLiveIds.kt)
// - MÜSSEN exakt übereinstimmen, sonst findet diese App Max' GATT-Service nicht.

export const BLE_SERVICE_UUID = 'ebbbe92f-9163-4530-9eee-099bd994ae01';
export const BLE_CHILD_CODE_CHARACTERISTIC_UUID = 'ebbbe92f-9163-4530-9eee-099bd994ae02';
export const BLE_ANNOUNCEMENT_CHARACTERISTIC_UUID = 'ebbbe92f-9163-4530-9eee-099bd994ae03';

// 1 Byte Fortsetzungs-Header pro Notify-Häppchen (siehe BleLiveAnnouncementBroadcaster.kt
// im PaceForge-Kids-Repo): 0 = weitere Häppchen folgen, 1 = letztes Häppchen der Nachricht.
export const BLE_CHUNK_FINAL = 1;

/** Reiner JS-Base64-Decoder ohne Zusatzpaket - react-native-ble-plx liefert
 *  Characteristic-Werte immer als Base64-String, `atob`/`Buffer` sind in RN nicht
 *  garantiert verfügbar. */
export function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = chars.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}
