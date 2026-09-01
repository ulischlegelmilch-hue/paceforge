#!/usr/bin/env python3
"""Erzeugt den vollständigen Ansagen-Katalog für den PaceForge-Wettkampf-
Audioguide (Erwachsene) per ElevenLabs-API. Liest die Textvorlagen aus der
Single Source of Truth packages/core/src/raceguide/announcementCatalog.json
(auch von TS genutzt) - keine doppelt gepflegten Texte wie bei PaceForge Kids
(dort Kotlin + Python getrennt).

Stimme: "Sophia - German Corporate & Brand" (Uli-Entscheidung 2026-08-28,
warme/freundliche Frauenstimme), aus der öffentlichen ElevenLabs Voice
Library (kein "add-from-library" nötig - direkter TTS-Call mit der
öffentlichen voice_id funktioniert auch ohne die
add_voice_from_voice_library-Berechtigung, die dieser Account-Key nicht hat).

Idempotent wie generate_voice_lines.py (Kids): vorhandene Dateien in output/
werden übersprungen.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

VOICE_ID = "QT6va3HQK8j63EC2r9cw"  # Sophia - German Corporate & Brand
MODEL_ID = "eleven_multilingual_v2"
VOICE_SETTINGS = {
    "stability": 0.68,
    "similarity_boost": 0.85,
    "style": 0.15,
    "use_speaker_boost": True,
}

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(HERE, "..", "..", "packages", "core", "src", "raceguide", "announcementCatalog.json")
OUTPUT_DIR = os.path.join(HERE, "output", "raceguide")
ENV_FILE = os.path.join(HERE, ".env")

# Kategorien mit {km}-Platzhalter, für die pro km-Wert 1..kmRange.max ein Clip
# je Textvariante erzeugt wird. Alle anderen Kategorien sind fixe Sätze ohne
# km-Bezug (ein Clip je Variante).
KM_CATEGORIES = {"kmCovered", "kmRemaining"}


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


def build_phrases(catalog: dict) -> dict[str, str]:
    """id -> gesprochener Text. id wird 1:1 als Dateiname (id + .mp3) verwendet."""
    phrases: dict[str, str] = {}
    km_min = catalog["kmRange"]["min"]
    km_max = catalog["kmRange"]["max"]

    for category, templates in catalog.items():
        if category == "kmRange":
            continue
        if category in KM_CATEGORIES:
            for variant_idx, template in enumerate(templates):
                for km in range(km_min, km_max + 1):
                    file_id = f"{category}_{km}_{variant_idx}"
                    phrases[file_id] = template.format(km=km)
        else:
            for variant_idx, template in enumerate(templates):
                file_id = f"{category}_{variant_idx}"
                phrases[file_id] = template

    return phrases


def generate_one(api_key: str, text: str, out_path: str) -> None:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
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

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    phrases = build_phrases(catalog)
    total = len(phrases)
    total_chars = sum(len(t) for t in phrases.values())
    done = skipped = failed = 0

    print(f"{total} Clips, {total_chars} Zeichen gesamt (ElevenLabs-Kontingent).")

    for i, (file_id, text) in enumerate(sorted(phrases.items()), start=1):
        out_path = os.path.join(OUTPUT_DIR, f"{file_id}.mp3")
        if os.path.exists(out_path):
            skipped += 1
            continue
        try:
            generate_one(api_key, text, out_path)
            done += 1
            if done % 20 == 0 or done <= 5:
                print(f"[{i}/{total}] OK   {file_id}: \"{text}\"")
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"[{i}/{total}] FEHLER {file_id}: HTTP {e.code} {e.read().decode(errors='replace')}",
                  file=sys.stderr)
            if e.code == 401:
                print("Ungueltiger API-Key, breche ab.", file=sys.stderr)
                break
            if e.code == 429:
                print("Kontingent/Rate-Limit erreicht - hier abbrechen und ggf. erneut starten "
                      "(bereits fertige Dateien werden dann uebersprungen).", file=sys.stderr)
                break
        time.sleep(0.25)

    print(f"\nFertig: {done} neu erzeugt, {skipped} schon vorhanden, {failed} fehlgeschlagen "
          f"(von {total} gesamt). Dateien liegen in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
