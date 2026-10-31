# /// script
# requires-python = ">=3.11"
# dependencies = ["edge-tts>=7,<8"]
# ///
"""Generate synthetic narration and original sentence timing; no app data is sent."""

import concurrent.futures
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = json.loads((ROOT / "scripts/demo/storyboard.json").read_text())
OUT = ROOT / ".build/demo/audio"
OUT.mkdir(parents=True, exist_ok=True)


def synthesize(scene):
    stem = OUT / scene["id"]
    signature = hashlib.sha256(
        json.dumps([PLAN["voice"], PLAN["rate"], scene["narration"]]).encode()
    ).hexdigest()
    if (
        stem.with_suffix(".sha256").exists()
        and stem.with_suffix(".sha256").read_text() == signature
        and stem.with_suffix(".mp3").exists()
        and stem.with_suffix(".mp3").stat().st_size > 1000
        and stem.with_suffix(".srt").exists()
    ):
        print(f"Cached {scene['id']}", flush=True)
        return
    command = [
        sys.executable,
        "-m",
        "edge_tts",
        "--voice",
        PLAN["voice"],
        f"--rate={PLAN['rate']}",
        "--text",
        scene["narration"],
        "--write-media",
        str(stem.with_suffix(".mp3")),
        "--write-subtitles",
        str(stem.with_suffix(".srt")),
    ]
    for attempt in range(5):
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode == 0 and stem.with_suffix(".mp3").stat().st_size > 1000:
            stem.with_suffix(".sha256").write_text(signature)
            print(
                f"Narrated {scene['id']}: {len(scene['narration'].split())} words / {scene['duration']}s scene",
                flush=True,
            )
            time.sleep(1)
            return
        print(
            f"Retrying {scene['id']} after transient voice-service failure ({attempt + 1}/5)",
            flush=True,
        )
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Narration failed for {scene['id']}: {result.stderr[-500:]}")


if __name__ == "__main__":
    assert sum(scene["duration"] for scene in PLAN["segments"]) == 180
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        list(executor.map(synthesize, PLAN["segments"]))
    print(f"Voice: {PLAN['voice']} (synthetic). Sentence timing retained in {OUT}")
