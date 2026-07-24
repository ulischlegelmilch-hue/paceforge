// Optionale Backend-URL (Phase 2). Per Env `EXPO_PUBLIC_API_BASE_URL` setzbar
// (Expo inlined EXPO_PUBLIC_*-Variablen zur Build-Zeit). Leer = App arbeitet rein
// lokal (offline-first); gesetzt = App nutzt das Backend (LLM-Zieleingabe, Sync)
// mit lokalem Fallback, falls es nicht erreichbar ist.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export const hasBackend = API_BASE_URL.length > 0;
