#!/usr/bin/env python3
"""Download 50 real meme template images from imgflip and save as
assets/memes/meme_01..50.png — bundled into the APK so they work fully offline.

Re-run any time to refresh the pack. Requires Pillow (pip install Pillow).
"""
import io
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "memes")
MAX_SIDE = 640        # cap longest side to keep APK small
JPEG_QUALITY = 82

# Real, recognizable imgflip meme templates (id -> url), from the original deck.
URLS = {
    1: "https://i.imgflip.com/30b1gx.jpg",
    2: "https://i.imgflip.com/1g8my4.jpg",
    3: "https://i.imgflip.com/1ur9b0.jpg",
    4: "https://i.imgflip.com/3lmzyx.jpg",
    5: "https://i.imgflip.com/22bdq6.jpg",
    6: "https://i.imgflip.com/3oevdk.jpg",
    7: "https://i.imgflip.com/261o3j.jpg",
    8: "https://i.imgflip.com/46e43q.png",
    9: "https://i.imgflip.com/2fm6x.jpg",
    10: "https://i.imgflip.com/26jxvz.jpg",
    11: "https://i.imgflip.com/28j0te.jpg",
    12: "https://i.imgflip.com/23ls.jpg",
    13: "https://i.imgflip.com/5c7lwq.png",
    14: "https://i.imgflip.com/1ihzfe.jpg",
    15: "https://i.imgflip.com/1c1uej.jpg",
    16: "https://i.imgflip.com/24y43o.jpg",
    17: "https://i.imgflip.com/345v97.jpg",
    18: "https://i.imgflip.com/1otk96.jpg",
    19: "https://i.imgflip.com/9ehk.jpg",
    20: "https://i.imgflip.com/43a45p.png",
    21: "https://i.imgflip.com/1jwhww.jpg",
    22: "https://i.imgflip.com/54hjww.jpg",
    23: "https://i.imgflip.com/wxica.jpg",
    24: "https://i.imgflip.com/26am.jpg",
    25: "https://i.imgflip.com/2ybua0.png",
    26: "https://i.imgflip.com/21uy0f.jpg",
    27: "https://i.imgflip.com/8d317n.png",
    28: "https://i.imgflip.com/2za3u1.jpg",
    29: "https://i.imgflip.com/1bij.jpg",
    30: "https://i.imgflip.com/2gnnjh.jpg",
    31: "https://i.imgflip.com/1o00in.jpg",
    32: "https://i.imgflip.com/1b42wl.jpg",
    33: "https://i.imgflip.com/1wz1x.jpg",
    34: "https://i.imgflip.com/2xscjb.png",
    35: "https://i.imgflip.com/38el31.jpg",
    36: "https://i.imgflip.com/2odckz.jpg",
    37: "https://i.imgflip.com/64sz4u.png",
    38: "https://i.imgflip.com/1tl71a.jpg",
    39: "https://i.imgflip.com/gtj5t.jpg",
    40: "https://i.imgflip.com/1e7ql7.jpg",
    41: "https://i.imgflip.com/m78d.jpg",
    42: "https://i.imgflip.com/3qqcim.png",
    43: "https://i.imgflip.com/gk5el.jpg",
    44: "https://i.imgflip.com/1h7in3.jpg",
    45: "https://i.imgflip.com/2kbn1e.jpg",
    46: "https://i.imgflip.com/39t1o.jpg",
    47: "https://i.imgflip.com/1yxkcp.jpg",
    48: "https://i.imgflip.com/19vcz0.jpg",
    49: "https://i.imgflip.com/1bgw.jpg",
    50: "https://i.imgflip.com/1nck6k.jpg",
}

# Fallback templates in case a primary URL 404s.
FALLBACKS = {
    46: "https://i.imgflip.com/4t0m5.jpg",   # right-handed?
    48: "https://i.imgflip.com/1bhk.jpg",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (memkarti meme fetch)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main() -> int:
    from PIL import Image

    os.makedirs(OUT, exist_ok=True)
    ok, failed = 0, []
    for mid, url in URLS.items():
        data = None
        for candidate in (url, FALLBACKS.get(mid)):
            if not candidate:
                continue
            try:
                data = fetch(candidate)
                break
            except Exception as e:  # noqa: BLE001
                print(f"  ! {mid}: {candidate} -> {e}")
                data = None
        if not data:
            failed.append(mid)
            continue
        try:
            img = Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {mid}: decode failed {e}")
            failed.append(mid)
            continue
        # Resize keeping aspect ratio, longest side <= MAX_SIDE.
        w, h = img.size
        scale = min(1.0, MAX_SIDE / max(w, h))
        if scale < 1.0:
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        out_path = os.path.join(OUT, f"meme_{mid:02d}.png")
        img.save(out_path, "PNG", optimize=True)
        ok += 1
        print(f"  ok {mid:2d} <- {url.split('/')[-1]}  ({img.size[0]}x{img.size[1]})")

    print(f"\nDone: {ok} ok, {len(failed)} failed: {failed}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
