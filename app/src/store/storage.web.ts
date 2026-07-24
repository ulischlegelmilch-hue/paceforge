import type { StateStorage } from 'zustand/middleware';

// Web-Variante der Persistenz: flüchtiger In-Memory-Store (nur für Dev/Bundle-Check).
// Bindet bewusst KEIN expo-sqlite ein, damit das statische Web-Rendering nicht an
// der nativen SQLite-/WASM-Schicht scheitert. Metro wählt diese Datei auf Web
// automatisch vor storage.ts.
export function createPersistStorage(): StateStorage {
  const mem = new Map<string, string>();
  return {
    getItem: (key) => mem.get(key) ?? null,
    setItem: (key, value) => {
      mem.set(key, value);
    },
    removeItem: (key) => {
      mem.delete(key);
    },
  };
}
