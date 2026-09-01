#!/usr/bin/env python3
"""Erzeugt kurze Hörproben von ElevenLabs-Kandidatenstimmen für den
PaceForge-Wettkampf-Audioguide (Erwachsene), damit Uli eine auswählen kann,
bevor der vollständige ~180-Clip-Katalog generiert wird. "Mats" (PaceForge
Kids' Stimme) ist bewusst ausgeschlossen - Uli wollte eine neue Stimme.

Kandidaten koennen aus dem eigenen Account ODER direkt aus der oeffentlichen
ElevenLabs Voice Library (per shared-voices-Suche gefundene voice_id) stammen -
TTS funktioniert fuer beide gleich ueber /v1/text-to-speech/{voice_id}, ganz
ohne den Umweg ueber "add-from-library" (dafuer fehlt diesem Account die
add_voice_from_voice_library-Berechtigung).
"""
import json
import os
import sys
import urllib.request

MODEL_ID = "eleven_multilingual_v2"
VOICE_SETTINGS = {
    "stability": 0.68,
    "similarity_boost": 0.85,
    "style": 0.15,
    "use_speaker_boost": True,
}

# Runde 2: sympathische, warme Frauenstimmen aus der ElevenLabs Voice Library
# (gefunden per shared-voices-Suche language=de, gender=female).
CANDIDATES = {
    "lena": "it8IUwkHD8mtjbyJyCuC",     # Lena - Gentle, Warm & Feminine (jung, ~23)
    "sophia": "QT6va3HQK8j63EC2r9cw",   # Sophia - German Corporate & Brand (cheerful, warm)
    "nadine": "yMouMDT5kvrfmH76gqc1",   # Nadine - Naturally Nuanced (warm, approachable)
}

SAMPLE_TEXT = "Kilometer fünf geschafft, super Rhythmus, weiter so! Noch sechs Kilometer bis ins Ziel."

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", "voice-samples")
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def load_api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key:
        return key
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("ELEVENLABS_API_KEY="):
                    return line.split("=", 1)[1].strip()
    print("FEHLER: Kein API-Key gefunden.", file=sys.stderr)
    sys.exit(1)


def generate_one(api_key: str, voice_id: str, text: str, out_path: str) -> None:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    body = {"text": text, "model_id": MODEL_ID, "voice_settings": VOICE_SETTINGS}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        audio = resp.read()
    with open(out_path, "wb") as f:
        f.write(audio)


def main() -> None:
    api_key = load_api_key()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for label, voice_id in CANDIDATES.items():
        out_path = os.path.join(OUTPUT_DIR, f"{label}.mp3")
        generate_one(api_key, voice_id, SAMPLE_TEXT, out_path)
        print(f"OK: {label} -> {out_path}")


if __name__ == "__main__":
    main()
