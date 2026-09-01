#!/usr/bin/env python3
"""Listet die ElevenLabs-Stimmen, die im Account verfügbar sind (GET /v1/voices),
damit eine passende Stimme für den PaceForge-Wettkampf-Audioguide (Erwachsene)
ausgewählt werden kann. Nutzt denselben API-Key/dieselbe .env-Konvention wie
PaceForge Kids' generate_voice_lines.py.
"""
import json
import os
import sys
import urllib.request

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


def main() -> None:
    api_key = load_api_key()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": api_key},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    voices = data.get("voices", [])
    print(f"{len(voices)} Stimmen im Account verfügbar:\n")
    for v in voices:
        labels = v.get("labels", {}) or {}
        print(f"- {v['name']}  (id={v['voice_id']})")
        print(f"    category={v.get('category')}  labels={labels}")
        desc = v.get("description")
        if desc:
            print(f"    description: {desc}")


if __name__ == "__main__":
    main()
