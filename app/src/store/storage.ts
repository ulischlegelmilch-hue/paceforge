import KV from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

// Native Persistenz (iOS/Android): SQLite-basierter Key-Value-Store aus
// expo-sqlite/kv-store – ein Drop-in-Ersatz für AsyncStorage. Echte Persistenz
// über App-Neustarts hinweg.
//
// Für Web gibt es eine eigene Variante (storage.web.ts, In-Memory), damit das
// Web-Bundle die native SQLite-/WASM-Schicht nicht einziehen muss.
export function createPersistStorage(): StateStorage {
  return KV as unknown as StateStorage;
}
