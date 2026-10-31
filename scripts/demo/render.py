# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11,<13", "numpy>=2,<3", "fonttools[woff]>=4,<5"]
# ///
"""Render the real-footage product film, original music, narration and captions."""

import concurrent.futures
import glob
import html
import json
import os
import re
import shutil
import subprocess
import textwrap
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / ".build/demo"
OUT = ROOT / "docs/demo"
PLAN = json.loads((ROOT / "scripts/demo/storyboard.json").read_text())
CAPTURE = json.loads((BUILD / "capture.json").read_text())
W, H, FPS = PLAN["width"], PLAN["height"], PLAN["fps"]
for directory in (OUT, BUILD / "fonts", BUILD / "clips", BUILD / "art"):
    directory.mkdir(parents=True, exist_ok=True)


def tool(name):
    configured = os.environ.get(name.upper() + "_PATH") or shutil.which(name)
    if configured:
        return configured
    options = [
        path
        for path in glob.glob(f"/nix/store/*-ffmpeg-*-bin/bin/{name}")
        if "headless" not in path
    ]
    if options:
        return sorted(options)[0]
    raise RuntimeError(f"Install {name} or set {name.upper()}_PATH")


FFMPEG, FFPROBE = tool("ffmpeg"), tool("ffprobe")
INK, BLUE, MUTED, ICE, TEAL = "#17324a", "#2459ca", "#526b88", "#eef3f8", "#197260"
for weight in (400, 600, 700, 800):
    target = BUILD / "fonts" / f"Manrope-{weight}.ttf"
    if not target.exists():
        source = (
            ROOT
            / "frontend/node_modules/@fontsource/manrope/files"
            / f"manrope-latin-{weight}-normal.woff2"
        )
        font = TTFont(source)
        font.flavor = None
        font.save(target)


@lru_cache(maxsize=100)
def font(size, weight=400):
    return ImageFont.truetype(str(BUILD / "fonts" / f"Manrope-{weight}.ttf"), size)


def run(command, **kwargs):
    result = subprocess.run(command, capture_output=True, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace")[-6000:])
    return result.stdout


def duration(path):
    return float(
        run(
            [
                FFPROBE,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ]
        )
    )


def ease_out(t):
    """Exact cubic-bezier(.23,1,.32,1), solved for x rather than approximated."""
    t = max(0.0, min(1.0, t))
    lo, hi = 0.0, 1.0
    for _ in range(24):
        u = (lo + hi) / 2
        x = 3 * (1 - u) ** 2 * u * 0.23 + 3 * (1 - u) * u * u * 0.32 + u**3
        if x < t:
            lo = u
        else:
            hi = u
    u = (lo + hi) / 2
    return 3 * (1 - u) ** 2 * u + 3 * (1 - u) * u * u + u**3


def logo(draw, x, y, size, light=False):
    fill = "white" if light else BLUE
    line = BLUE if light else "white"
    draw.rounded_rectangle((x, y, x + size, y + size), radius=round(size * 0.24), fill=fill)
    for index, knob in enumerate((0.65, 0.35, 0.6)):
        yy = y + size * (0.28 + index * 0.22)
        draw.line(
            (x + size * 0.23, yy, x + size * 0.77, yy), fill=line, width=max(2, round(size * 0.045))
        )
        xx = x + size * knob
        draw.rounded_rectangle(
            (xx - size * 0.035, yy - size * 0.075, xx + size * 0.035, yy + size * 0.075),
            radius=2,
            fill=line,
        )


def animated_layer(base, t, delay, painter, offset=18):
    progress = ease_out((t - delay) / 0.5)
    if progress <= 0:
        return
    layer = Image.new("RGBA", (W, H))
    painter(ImageDraw.Draw(layer), round((1 - progress) * offset))
    if progress < 1:
        alpha = layer.getchannel("A").point(lambda value: round(value * progress))
        layer.putalpha(alpha)
    base.alpha_composite(layer)


def graphic(scene, t):
    outro = scene["id"] == "outro"
    image = Image.new("RGBA", (W, H), BLUE if outro else ICE)
    draw = ImageDraw.Draw(image)
    if scene["id"] == "intro":
        animated_layer(image, t, 0, lambda d, dy: logo(d, 112, 130 + dy, 70))
        animated_layer(
            image,
            t,
            0.08,
            lambda d, dy: d.text((202, 136 + dy), "Switchboard", font=font(44, 800), fill=INK),
        )
        animated_layer(
            image,
            t,
            0.16,
            lambda d, dy: d.multiline_text(
                (108, 310 + dy),
                "The same website.\nYour way through.",
                font=font(92, 800),
                fill=INK,
                spacing=18,
            ),
        )
        animated_layer(
            image,
            t,
            0.24,
            lambda d, dy: d.text(
                (112, 596 + dy),
                "One-switch control for supported web forms.",
                font=font(29),
                fill=MUTED,
            ),
        )

        def switch_art(d, dy):
            x, y = 1240, 260 + dy
            d.rounded_rectangle(
                (x, y, x + 510, y + 440), radius=30, fill="white", outline="#d4dfed", width=2
            )
            d.rounded_rectangle((x + 88, y + 105, x + 422, y + 239), radius=20, fill="#d0dced")
            d.rounded_rectangle(
                (x + 88, y + 93, x + 422, y + 225),
                radius=20,
                fill="#f7faff",
                outline="#a7bddc",
                width=3,
            )
            d.text((x + 255, y + 125), "Space", font=font(45, 700), fill=BLUE, anchor="mt")
            d.text(
                (x + 255, y + 281), "One switch selects.", font=font(25, 700), fill=INK, anchor="mt"
            )
            d.text(
                (x + 255, y + 330),
                "Scanning does the moving.",
                font=font(20),
                fill=MUTED,
                anchor="mt",
            )

        animated_layer(image, t, 0.24, switch_art)
        draw = ImageDraw.Draw(image)
        draw.line((112, 790, 1750, 790), fill="#d4dfed", width=2)
        draw.text(
            (112, 826),
            "Real page edits     •     Error recovery     •     Explicit confirmation",
            font=font(24, 600),
            fill=MUTED,
        )
    elif scene["id"] == "evidence":
        animated_layer(image, t, 0, lambda d, dy: logo(d, 110, 118 + dy, 56))
        animated_layer(
            image,
            t,
            0.08,
            lambda d, dy: d.text((185, 128 + dy), "Switchboard", font=font(33, 800), fill=INK),
        )
        animated_layer(
            image,
            t,
            0.16,
            lambda d, dy: d.multiline_text(
                (108, 275 + dy),
                "Tested end to end.\nNot overstated.",
                font=font(75, 800),
                fill=INK,
                spacing=16,
            ),
        )
        animated_layer(
            image,
            t,
            0.24,
            lambda d, dy: d.multiline_text(
                (112, 510 + dy),
                "An engineering prototype.\nNot a universal accessibility repair.",
                font=font(27),
                fill=MUTED,
                spacing=15,
            ),
        )
        rows = [
            ("One-switch workflow", "Text entry, correction, and authorized submission."),
            ("Real extension + real page", "Native HTML and controlled React inputs."),
            ("Defined support", "Native forms only. No compatibility guarantee."),
        ]
        for index, (title, text) in enumerate(rows):

            def row(d, dy, index=index, title=title, text=text):
                x, y = 1040, 245 + index * 160 + dy
                d.rounded_rectangle(
                    (x, y, 1780, y + 130), radius=18, fill="white", outline="#d4dfed", width=2
                )
                d.ellipse((x + 24, y + 34, x + 72, y + 82), fill="#e4f2ec")
                d.line((x + 37, y + 57, x + 46, y + 66, x + 61, y + 49), fill=TEAL, width=4)
                d.text((x + 94, y + 29), title, font=font(28, 700), fill=INK)
                d.text((x + 94, y + 75), text, font=font(20), fill=MUTED)

            animated_layer(image, t, 0.16 + index * 0.08, row)
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((112, 770, 1780, 866), radius=14, fill="#e2eaf6")
        draw.text(
            (145, 800),
            "Next: co-design, physical-switch testing, and real-user evaluation.",
            font=font(27, 600),
            fill="#36577e",
        )
    else:
        animated_layer(image, t, 0, lambda d, dy: logo(d, 112, 128 + dy, 68, light=True))
        animated_layer(
            image,
            t,
            0.08,
            lambda d, dy: d.text((202, 136 + dy), "Switchboard", font=font(44, 800), fill="white"),
        )
        animated_layer(
            image,
            t,
            0.16,
            lambda d, dy: d.multiline_text(
                (108, 330 + dy),
                "A clearer path.\nStill your choice.",
                font=font(100, 800),
                fill="white",
                spacing=12,
            ),
        )
        animated_layer(
            image,
            t,
            0.24,
            lambda d, dy: d.text(
                (112, 628 + dy),
                "One switch. Real forms. Explicit control.",
                font=font(30, 600),
                fill="#e1ebff",
            ),
        )
        draw = ImageDraw.Draw(image)
        draw.line((112, 795, 1780, 795), fill="#6d90db", width=2)
        draw.text(
            (112, 830),
            "Working prototype · Supported native controls · No AI key required",
            font=font(23),
            fill="#e1ebff",
        )
    if outro and t > scene["duration"] - 0.6:
        overlay = Image.new(
            "RGBA", (W, H), (20, 50, 90, round(255 * (t - (scene["duration"] - 0.6)) / 0.6))
        )
        image.alpha_composite(overlay)
    return image.convert("RGB")


def background(scene):
    image = Image.new("RGB", (W, H), ICE)
    shadow = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle((60, 78, 1860, 982), radius=17, fill=(23, 50, 74, 28))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image = Image.alpha_composite(image.convert("RGBA"), shadow).convert("RGB")
    d = ImageDraw.Draw(image)
    logo(d, 64, 22, 32)
    d.text((110, 20), "Switchboard", font=font(27, 800), fill=INK)
    d.line((310, 26, 310, 53), fill="#bdcde0", width=2)
    d.text((330, 29), "Product demo", font=font(17, 600), fill=MUTED)
    d.text((1856, 16), scene["chapter"], font=font(24, 700), fill=INK, anchor="rt")
    secondary = scene.get("disclosure") or (
        "Local fictional practice site"
        if scene["id"] == "problem"
        else "Installed Chromium extension"
    )
    d.text((1856, 50), secondary, font=font(15, 600), fill=MUTED, anchor="rt")
    d.rectangle((63, 77, 1857, 975), fill="white", outline="#cedbea", width=2)
    return image


def find_sync():
    pixels = run(
        [
            FFMPEG,
            "-v",
            "error",
            "-i",
            CAPTURE["rawPath"],
            "-t",
            "8",
            "-vf",
            "crop=24:24:0:0,scale=1:1,format=rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
        ]
    )
    rgb = np.frombuffer(pixels, dtype=np.uint8).reshape(-1, 3)
    matches = np.where((rgb[:, 0] > 230) & (rgb[:, 1] < 35) & (rgb[:, 2] > 230))[0]
    if not len(matches):
        raise RuntimeError("Recording sync slate was not found; refusing an uncertain edit")
    return (int(matches[-1]) + 1) / 25


SYNC = find_sync()
print(f"Raw-footage sync offset: {SYNC:.3f}s", flush=True)
SCENE_CAPTURE = {scene["id"]: scene for scene in CAPTURE["scenes"]}
ACTION_HOLDS = {"navigate": 14.0, "type": 22.0, "review": 13.5, "recovery": 10.0}


def pieces(scene):
    source = SCENE_CAPTURE[scene["id"]]
    if scene["id"] in ACTION_HOLDS:
        action = min(source["actionsDuration"] + 0.1, source["duration"] - 0.2)
        target = ACTION_HOLDS[scene["id"]]
        return [
            (0, action, target),
            (action, source["duration"] - action, scene["duration"] - target),
        ]
    return [(0, source["duration"], scene["duration"])]


def mapped_time(scene, local):
    target_start = 0.0
    for start, span, target in pieces(scene):
        if local <= start + span:
            return target_start + max(0, local - start) * target / span
        target_start += target
    return float(scene["duration"])


def render_graphic(scene, output):
    process = subprocess.Popen(
        [
            FFMPEG,
            "-v",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            f"{W}x{H}",
            "-framerate",
            str(FPS),
            "-i",
            "pipe:0",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "16",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            "3",
            str(output),
        ],
        stdin=subprocess.PIPE,
    )
    for frame in range(round(scene["duration"] * FPS)):
        process.stdin.write(graphic(scene, frame / FPS).tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(f"Could not render {scene['id']}")
    print(f"Rendered {scene['id']}", flush=True)


def render_capture(scene, part, output):
    start, span, target = part
    bg = BUILD / "art" / f"{scene['id']}.png"
    if not bg.exists():
        background(scene).save(bg)
    ratio = target / span
    filter_graph = (
        f"[0:v]setpts=(PTS-STARTPTS)*{ratio:.10f},fps={FPS},scale=1792:896:flags=lanczos,"
        f"tpad=stop_mode=clone:stop_duration=1,trim=duration={target},setsar=1[screen];"
        f"[1:v][screen]overlay=64:78:shortest=1,format=yuv420p[out]"
    )
    run(
        [
            FFMPEG,
            "-v",
            "error",
            "-y",
            "-ss",
            str(SYNC + SCENE_CAPTURE[scene["id"]]["start"] + start),
            "-t",
            str(span),
            "-i",
            CAPTURE["rawPath"],
            "-loop",
            "1",
            "-framerate",
            str(FPS),
            "-i",
            str(bg),
            "-filter_complex_threads",
            "1",
            "-filter_complex",
            filter_graph,
            "-map",
            "[out]",
            "-t",
            str(target),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "16",
            "-threads",
            "2",
            str(output),
        ]
    )
    print(f"Rendered {output.stem}", flush=True)


def timestamp(seconds, ass=False):
    milliseconds = round(seconds * (100 if ass else 1000))
    denominator = 100 if ass else 1000
    hours, rest = divmod(milliseconds, denominator * 3600)
    minutes, rest = divmod(rest, denominator * 60)
    whole, fraction = divmod(rest, denominator)
    return (
        f"{hours}:{minutes:02}:{whole:02}.{fraction:02}"
        if ass
        else f"{hours:02}:{minutes:02}:{whole:02},{fraction:03}"
    )


def parse_srt(path):
    cues = []
    for block in re.split(r"\n\s*\n", path.read_text().strip()):
        lines = block.splitlines()
        if len(lines) < 3:
            continue

        def parse(value):
            hours, minutes, seconds, ms = map(int, re.split(r"[:,]", value.strip()))
            return hours * 3600 + minutes * 60 + seconds + ms / 1000

        start, end = lines[1].split(" --> ")
        cues.append((parse(start), parse(end), html.unescape(" ".join(lines[2:]))))
    return cues


def audio_and_captions():
    sr = 48000
    voice = np.zeros(round(PLAN["duration"] * sr), dtype=np.float32)
    subtitles = []
    cursor = 0.0
    report = []
    for scene in PLAN["segments"]:
        stem = BUILD / "audio" / scene["id"]
        decoded = np.frombuffer(
            run(
                [
                    FFMPEG,
                    "-v",
                    "error",
                    "-i",
                    str(stem.with_suffix(".mp3")),
                    "-f",
                    "f32le",
                    "-ac",
                    "1",
                    "-ar",
                    str(sr),
                    "pipe:1",
                ]
            ),
            dtype=np.float32,
        ).copy()
        lead = 0.65 if scene["id"] != "outro" else 0.55
        available = scene["duration"] - lead - 0.35
        rate = max(1.0, len(decoded) / sr / available)
        if rate > 1.12:
            raise RuntimeError(f"Rewrite {scene['id']}: narration would require {rate:.2f}x speed")
        if rate > 1.001:
            decoded = np.frombuffer(
                run(
                    [
                        FFMPEG,
                        "-v",
                        "error",
                        "-i",
                        str(stem.with_suffix(".mp3")),
                        "-af",
                        f"atempo={rate}",
                        "-f",
                        "f32le",
                        "-ac",
                        "1",
                        "-ar",
                        str(sr),
                        "pipe:1",
                    ]
                ),
                dtype=np.float32,
            ).copy()
        fade = min(600, len(decoded) // 10)
        decoded[:fade] *= np.linspace(0, 1, fade)
        decoded[-fade:] *= np.linspace(1, 0, fade)
        offset = round((cursor + lead) * sr)
        take = min(len(decoded), len(voice) - offset, round(available * sr))
        voice[offset : offset + take] += decoded[:take]
        for start, end, text in parse_srt(stem.with_suffix(".srt")):
            begin = cursor + lead + start / rate
            finish = min(cursor + scene["duration"] - 0.15, cursor + lead + end / rate)
            if finish > begin:
                subtitles.append(
                    (begin, finish, text, "Light" if scene["id"] == "outro" else "Caption")
                )
        report.append(
            {
                "id": scene["id"],
                "start": cursor,
                "duration": scene["duration"],
                "speechDuration": len(decoded) / sr,
                "speechRateFit": rate,
            }
        )
        cursor += scene["duration"]
    # Original, quiet ambient chord progression; no recording or melody sampled.
    count = len(voice)
    music = np.zeros((count, 2), dtype=np.float32)
    chords = [
        [130.8128, 164.8138, 195.9977, 246.9417],
        [110, 130.8128, 164.8138, 195.9977],
        [87.3071, 130.8128, 174.6141, 220],
        [97.9989, 146.8324, 195.9977, 220],
    ]
    for index in range(12):
        start = max(0, round((index * 15 - 2) * sr))
        end = min(count, round((index * 15 + 19) * sr))
        t = np.arange(end - start, dtype=np.float32) / sr
        env = np.minimum(t / 4, 1) * np.minimum((len(t) / sr - t) / 5, 1)
        for note, frequency in enumerate(chords[index % len(chords)]):
            for channel in range(2):
                phase = 0.7 * note + 0.15 * channel
                wave1 = np.sin(2 * np.pi * frequency * (1 + channel * 0.0006) * t + phase)
                wave2 = 0.15 * np.sin(2 * np.pi * frequency * 2 * t + phase)
                music[start:end, channel] += (wave1 + wave2) * env * 0.0042
    # Duck the bed around speech, using 100ms energy blocks and a smooth envelope.
    blocks = np.pad(voice, (0, (-len(voice)) % 4800)).reshape(-1, 4800)
    speech = np.sqrt(np.mean(blocks * blocks, axis=1))
    duck = np.interp(np.arange(count) / 4800, np.arange(len(speech)), np.clip(speech / 0.025, 0, 1))
    music *= 1 - 0.55 * duck[:, None]
    ramp = np.minimum(np.arange(count) / sr / 2.5, 1) * np.minimum(
        (count - np.arange(count)) / sr / 2.5, 1
    )
    music *= ramp[:, None]
    mix = np.clip(voice[:, None] + music, -0.98, 0.98)
    pcm = (mix * 32767).astype("<i2")
    with wave.open(str(BUILD / "mix.wav"), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sr)
        output.writeframes(pcm.tobytes())
    srt = []
    ass = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Caption,Manrope,31,&H004A3217,&H004A3217,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,1,0,0,2,100,100,20,1",
        "Style: Light,Manrope,31,&H00FFFFFF,&H00FFFFFF,&H002459CA,&H002459CA,0,0,0,0,100,100,0,0,1,0,0,2,100,100,20,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for index, (start, end, text, style) in enumerate(subtitles, 1):
        wrapped = textwrap.wrap(text, width=103, break_long_words=False)
        if len(wrapped) > 2:
            raise RuntimeError(f"Caption too long: {text}")
        srt += [str(index), f"{timestamp(start)} --> {timestamp(end)}", "\n".join(wrapped), ""]
        display = r"\N".join(wrapped).replace("{", r"\{").replace("}", r"\}")
        ass.append(
            f"Dialogue: 0,{timestamp(start, True)},{timestamp(end, True)},{style},,0,0,0,,{{\\fad(100,100)}}{display}"
        )
    srt_text = "\n".join(srt)
    (OUT / "switchboard-demo.srt").write_text(srt_text)
    vtt_text = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt_text)
    (OUT / "switchboard-demo.vtt").write_text("WEBVTT\n\n" + vtt_text)
    (BUILD / "captions.ass").write_text("\n".join(ass))
    lines = [
        "Switchboard — three-minute demo transcript",
        "",
        "Synthetic narration. Recorded installed-extension footage. Scan timing edited for clarity.",
        "",
    ]
    for scene, item in zip(PLAN["segments"], report):
        lines += [
            f"{int(item['start']) // 60:02}:{int(item['start']) % 60:02}  {scene['chapter']}",
            scene["narration"],
            "",
        ]
    (OUT / "transcript.txt").write_text("\n".join(lines))
    return report


def main():
    jobs = []
    timeline = []
    global_cursor = 0.0
    key_events = []
    for index, scene in enumerate(PLAN["segments"]):
        if scene["kind"] == "graphic":
            path = BUILD / "clips" / f"{index:02}-{scene['id']}.mp4"
            jobs.append(("graphic", scene, None, path))
            timeline.append(path)
        else:
            for part_index, part in enumerate(pieces(scene)):
                path = BUILD / "clips" / f"{index:02}-{scene['id']}-{part_index}.mp4"
                jobs.append(("capture", scene, part, path))
                timeline.append(path)
            capture = SCENE_CAPTURE[scene["id"]]
            for press in CAPTURE["presses"]:
                if capture["start"] <= press < capture["end"]:
                    key_events.append(global_cursor + mapped_time(scene, press - capture["start"]))
        global_cursor += scene["duration"]

    def render(job):
        kind, scene, part, path = job
        if (
            path.exists()
            and abs(duration(path) - (scene["duration"] if kind == "graphic" else part[2])) < 0.05
            and not os.environ.get("DEMO_FORCE_RENDER")
        ):
            print(f"Cached {path.stem}", flush=True)
            return
        if kind == "graphic":
            render_graphic(scene, path)
        else:
            render_capture(scene, part, path)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(render, jobs))
    listing = BUILD / "concat.txt"
    listing.write_text("\n".join(f"file '{path}'" for path in timeline))
    run(
        [
            FFMPEG,
            "-v",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(listing),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(BUILD / "picture.mp4"),
        ]
    )
    audio_report = audio_and_captions()
    badge = Image.new("RGBA", (144, 49))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((0, 0, 143, 48), radius=11, fill=BLUE)
    draw.ellipse((14, 18, 25, 29), fill="#bad0ff")
    draw.text((38, 9), "Space", font=font(23, 700), fill="white")
    badge.save(BUILD / "art/key.png")
    enable = "+".join(
        f"between(t,{stamp:.3f},{min(stamp + 0.32, 180):.3f})" for stamp in key_events
    )
    ass_path = str(BUILD / "captions.ass").replace(":", r"\:")
    fonts = str(BUILD / "fonts").replace(":", r"\:")
    filter_graph = f"[0:v][2:v]overlay=94:900:enable='{enable}':eof_action=repeat,ass='{ass_path}':fontsdir='{fonts}'[v]"
    print("Mastering 180-second H.264/AAC film and captions…", flush=True)
    run(
        [
            FFMPEG,
            "-v",
            "warning",
            "-y",
            "-i",
            str(BUILD / "picture.mp4"),
            "-i",
            str(BUILD / "mix.wav"),
            "-loop",
            "1",
            "-i",
            str(BUILD / "art/key.png"),
            "-filter_complex_threads",
            "1",
            "-filter_complex",
            filter_graph,
            "-map",
            "[v]",
            "-map",
            "1:a",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=9",
            "-t",
            "180",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            "6",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            "-metadata",
            "title=Switchboard — The same website. Your way through.",
            "-metadata",
            "comment=Recorded installed-extension demo; scan timing condensed; synthetic narration and original procedural music.",
            str(OUT / "switchboard-demo.mp4"),
        ]
    )
    graphic(PLAN["segments"][0], 3).save(OUT / "poster.png")
    for second, name in [
        (4, "opening"),
        (72, "text-entry"),
        (110, "server-error"),
        (141, "receipt"),
        (167, "limits"),
        (176, "closing"),
    ]:
        run(
            [
                FFMPEG,
                "-v",
                "error",
                "-y",
                "-ss",
                str(second),
                "-i",
                str(OUT / "switchboard-demo.mp4"),
                "-frames:v",
                "1",
                str(BUILD / f"review-{name}.png"),
            ]
        )
    report = {
        "duration": duration(OUT / "switchboard-demo.mp4"),
        "width": W,
        "height": H,
        "fps": FPS,
        "voice": PLAN["voice"],
        "sourceSyncOffset": SYNC,
        "actualSpacePresses": len(key_events),
        "sourceNetworkResponses": CAPTURE["responses"],
        "narration": audio_report,
    }
    (OUT / "render-report.json").write_text(json.dumps(report, indent=2))
    (OUT / "credits.txt").write_text(
        "Switchboard demo\nSynthetic narration: Andrew Multilingual voice via edge-tts. No real person voice cloned.\nMusic: original procedural composition generated by scripts/demo/render.py; no samples.\nTypeface: Manrope (SIL Open Font License; see frontend/node_modules/@fontsource/manrope/LICENSE).\nApp icons: Lucide (ISC).\nFootage: actual local Switchboard extension and fictional Common Ground practice site.\nScan waiting/timing edited for clarity. No user-performance or universal-accessibility claims.\n"
    )
    print(
        f"Delivered {OUT / 'switchboard-demo.mp4'}: {report['duration']:.3f}s, {(OUT / 'switchboard-demo.mp4').stat().st_size / 1024 / 1024:.1f} MiB",
        flush=True,
    )


if __name__ == "__main__":
    main()
