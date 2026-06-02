#!/usr/bin/env python3
"""Генерує 50 локальних мем-карток (реакції) для МемКарти.
Кожна картка — кольоровий градієнт + великий емодзі + коротка фраза.
Картинки кладуться в assets/memes/meme_01.png ... meme_50.png (512x512).
Емодзі рендеряться як текст (Noto) — якщо гліфа немає, лишається підпис.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "memes")
os.makedirs(OUT, exist_ok=True)

FONT_PATH = "/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf"
EMOJI_FONT = None
for cand in [
    os.path.join(os.path.dirname(__file__), "fonts", "NotoColorEmoji.ttf"),
    "/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf",
    "/usr/share/fonts/google-noto/NotoColorEmoji.ttf",
]:
    if os.path.exists(cand):
        EMOJI_FONT = cand
        break

SIZE = 512

# (емодзі, підпис, колір1, колір2)
CARDS = [
    ("\U0001F602", "Я вже не можу", (244, 114, 182), (190, 24, 93)),
    ("\U0001F480", "Все, я помер", (71, 85, 105), (15, 23, 42)),
    ("\U0001F644", "Ну звичайно", (251, 191, 36), (180, 83, 9)),
    ("\U0001F97A", "Мені так шкода", (96, 165, 250), (30, 64, 175)),
    ("\U0001F921", "Це клоунада", (248, 113, 113), (153, 27, 27)),
    ("\U0001F634", "Я сплю на ходу", (129, 140, 248), (49, 46, 129)),
    ("\U0001F924", "Хочу їсти", (251, 146, 60), (154, 52, 18)),
    ("\U0001F60E", "Все під контролем", (52, 211, 153), (6, 78, 59)),
    ("\U0001F92F", "Мій мозок вибухнув", (244, 114, 182), (131, 24, 67)),
    ("\U0001F979", "Я тримаюсь", (147, 197, 253), (30, 58, 138)),
    ("\U0001F60D", "Я в захваті", (251, 113, 133), (159, 18, 57)),
    ("\U0001F614", "Сумно якось", (148, 163, 184), (51, 65, 85)),
    ("\U0001F92A", "Я в ділі", (250, 204, 21), (161, 98, 7)),
    ("\U0001F633", "Це соромно", (252, 165, 165), (153, 27, 27)),
    ("\U0001F971", "Дайте поспати", (165, 180, 252), (55, 48, 163)),
    ("\U0001F92C", "Я в гніві", (248, 113, 113), (127, 29, 29)),
    ("\U0001F913", "Я тут найрозумніший", (110, 231, 183), (4, 120, 87)),
    ("\U0001F62D", "Я плачу", (96, 165, 250), (30, 58, 138)),
    ("\U0001F60F", "Я ж казав", (251, 191, 36), (146, 64, 14)),
    ("\U0001F975", "Тут жарко", (251, 146, 60), (154, 52, 18)),
    ("\U0001F976", "Я замерз", (125, 211, 252), (3, 105, 161)),
    ("\U0001F92E", "Це занадто", (134, 239, 172), (21, 128, 61)),
    ("\U0001F47B", "Я зник", (226, 232, 240), (100, 116, 139)),
    ("\U0001F921", "Цирк приїхав", (240, 171, 252), (134, 25, 143)),
    ("\U0001F525", "Це вогонь", (251, 146, 60), (153, 27, 27)),
    ("\U0001F4A9", "Ну таке", (180, 130, 90), (87, 56, 34)),
    ("\U0001F914", "Дай подумати", (253, 224, 71), (161, 98, 7)),
    ("\U0001F631", "Я в шоці", (196, 181, 253), (91, 33, 182)),
    ("\U0001F60C", "Кайф", (110, 231, 183), (5, 95, 70)),
    ("\U0001F9E0", "Включаю мозок", (244, 114, 182), (131, 24, 67)),
    ("\U0001F44F", "Браво", (250, 204, 21), (161, 98, 7)),
    ("\U0001F44D", "Згоден", (74, 222, 128), (22, 101, 52)),
    ("\U0001F44E", "Так собі", (248, 113, 113), (153, 27, 27)),
    ("\U0001F389", "Свято!", (240, 171, 252), (134, 25, 143)),
    ("\U0001F4B8", "Гроші пішли", (134, 239, 172), (21, 128, 61)),
    ("\U0001F3C3", "Я тікаю", (147, 197, 253), (30, 64, 175)),
    ("\U0001F971", "На автопілоті", (165, 180, 252), (55, 48, 163)),
    ("\U0001F40C", "Повільно як равлик", (190, 242, 100), (77, 124, 15)),
    ("\U0001F648", "Я нічого не бачив", (251, 191, 36), (146, 64, 14)),
    ("\U0001F910", "Промовчу", (148, 163, 184), (51, 65, 85)),
    ("\U0001F973", "Вечірка!", (244, 114, 182), (157, 23, 77)),
    ("\U0001F635", "Я перевантажений", (196, 181, 253), (91, 33, 182)),
    ("\U0001F37F", "Дивлюсь шоу", (253, 224, 71), (161, 98, 7)),
    ("\U0001F4AA", "Я зможу", (251, 146, 60), (154, 52, 18)),
    ("\U0001F62C", "Незручно вийшло", (252, 211, 77), (146, 64, 14)),
    ("\U0001F60A", "Все добре", (110, 231, 183), (5, 95, 70)),
    ("\U0001F926", "Без коментарів", (148, 163, 184), (51, 65, 85)),
    ("\U0001F92B", "Тихо-тихо", (165, 180, 252), (55, 48, 163)),
    ("\U0001F920", "Йо, погнали", (251, 191, 36), (146, 64, 14)),
    ("\U0001F971", "Ще 5 хвилинок", (129, 140, 248), (49, 46, 129)),
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(c1, c2):
    img = Image.new("RGB", (SIZE, SIZE), c1)
    px = img.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        col = lerp(c1, c2, t)
        for x in range(SIZE):
            px[x, y] = col
    return img


def load_emoji_font():
    if EMOJI_FONT:
        try:
            # Noto Color Emoji — растровий шрифт, підтримує лише розмір 109.
            return ImageFont.truetype(EMOJI_FONT, 109)
        except Exception:
            pass
    return None


def text_font(sz):
    return ImageFont.truetype(FONT_PATH, sz)


def draw_center(draw, cx, y, text, font, fill, anchor="mm"):
    draw.text((cx, y), text, font=font, fill=fill, anchor=anchor)


def make_card(idx, emoji, caption, c1, c2):
    img = gradient(c1, c2).convert("RGBA")
    d = ImageDraw.Draw(img)

    # напівпрозора рамка
    margin = 18
    d.rounded_rectangle(
        [margin, margin, SIZE - margin, SIZE - margin],
        radius=36, outline=(255, 255, 255, 60), width=4,
    )

    # емодзі (велике) — Noto Color Emoji рендериться у 136px, потім масштабуємо
    ef = load_emoji_font()
    drawn = False
    if ef is not None:
        try:
            base = 136  # природний розмір растрового гліфа
            emoji_img = Image.new("RGBA", (base, base), (0, 0, 0, 0))
            ed = ImageDraw.Draw(emoji_img)
            ed.text((base // 2, base // 2), emoji, font=ef, anchor="mm", embedded_color=True)
            target = 190
            emoji_img = emoji_img.resize((target, target), Image.LANCZOS)
            img.alpha_composite(emoji_img, (SIZE // 2 - target // 2, 95))
            drawn = True
        except Exception as e:
            drawn = False
    if not drawn:
        bigf = text_font(140)
        draw_center(d, SIZE // 2, 200, emoji, bigf, (255, 255, 255, 255))

    # підпис (перенос рядків)
    cap_font = text_font(46)
    words = caption.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if d.textlength(test, font=cap_font) <= SIZE - 80:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)

    y = 360
    for ln in lines:
        # тінь
        draw_center(d, SIZE // 2 + 2, y + 2, ln, cap_font, (0, 0, 0, 140))
        draw_center(d, SIZE // 2, y, ln, cap_font, (255, 255, 255, 255))
        y += 54

    out = os.path.join(OUT, f"meme_{idx:02d}.png")
    img.convert("RGB").save(out, optimize=True)


def main():
    for i, (emoji, cap, c1, c2) in enumerate(CARDS, start=1):
        make_card(i, emoji, cap, c1, c2)
    print(f"generated {len(CARDS)} memes -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
