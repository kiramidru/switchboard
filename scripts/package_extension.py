"""Package only extension assets. No Node dependencies or network access needed."""

import json
import shutil
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
frontend = root / "frontend"
out = frontend / "extension-dist"
for source in (frontend / "extension").iterdir():
    if source.is_file():
        shutil.copy2(source, out / source.name)
manifest = json.loads((out / "manifest.json").read_text())
assert manifest["permissions"] == ["activeTab", "scripting"]
assert "host_permissions" not in manifest
for size in (32, 128):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 4, fill="#2459ca")
    for x, y in ((.23, .24), (.55, .24), (.23, .57), (.55, .57)):
        draw.rounded_rectangle((int(x * size), int(y * size), int((x + .21) * size), int((y + .2) * size)), radius=max(1, size // 24), fill="white" if x == .23 and y == .24 else "#88abed")
    image.save(out / f"icon{size}.png")
archive = frontend / "dist" / "switchboard-extension.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
    for source in sorted(out.iterdir()):
        if source.is_file():
            package.write(source, source.name)
shutil.copy2(archive, frontend / "public" / archive.name)
print(f"Packaged {archive.relative_to(root)} ({archive.stat().st_size:,} bytes)")
