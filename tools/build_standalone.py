#!/usr/bin/env python3
"""Build the single-file share version of 星海笃行.

Inlines styles.css, game.js, the class badge and the three MP3 tracks into
index.html so the result can be opened directly from disk (file://).
"""

from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / "index.html"
OUTPUT = ROOT / "星海笃行64班.html"

BGM_TRACKS = ("menu", "normal", "boss")
BADGE = ROOT / "assets" / "brand" / "class64-badge.png"


def data_uri(path: Path, mime: str) -> str:
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def main() -> None:
    for required in (ENTRY, ROOT / "styles.css", ROOT / "game.js", BADGE):
        if not required.exists():
            raise SystemExit(f"missing build input: {required}")

    html = ENTRY.read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "game.js").read_text(encoding="utf-8")

    badge = data_uri(BADGE, "image/png")
    for quote in ('"', "'"):
        css = css.replace(
            f"url({quote}assets/brand/class64-badge.png{quote})",
            f"url({quote}{badge}{quote})",
        )

    for track in BGM_TRACKS:
        audio = ROOT / "assets" / "audio" / f"{track}.mp3"
        if not audio.exists():
            raise SystemExit(f"missing build input: {audio}")
        uri = data_uri(audio, "audio/mpeg")
        js = js.replace(f"'assets/audio/{track}.mp3'", f"'{uri}'")
        js = js.replace(f'"assets/audio/{track}.mp3"', f'"{uri}"')

    # An inline script/style must not accidentally terminate its element.
    js = js.replace("</script", "<\\/script")
    css = css.replace("</style", "<\\/style")

    stylesheet_tag = '<link rel="stylesheet" href="styles.css">'
    if stylesheet_tag not in html:
        raise SystemExit("could not find styles.css link in index.html")
    html = html.replace(stylesheet_tag, f"<style>\n{css}\n</style>")

    script_tag = '<script src="game.js" defer></script>'
    if script_tag not in html:
        raise SystemExit("could not find game.js script tag in index.html")
    html = html.replace(script_tag, f"<script>\n{js}\n</script>")

    if "assets/audio/" in html or "assets/brand/class64-badge.png" in html:
        raise SystemExit("external asset reference still present after inlining")
    if 'src="game.js"' in html or 'href="styles.css"' in html:
        raise SystemExit("external script/style reference still present after inlining")

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"built {OUTPUT.name} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
