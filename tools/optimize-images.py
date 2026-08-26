#!/usr/bin/env python3
"""Оптимизация картинок: ресайз под фактическую ширину отрисовки, WebP, GIF → mp4.

Оригиналы заменяются: они всегда есть в старом репозитории (/Users/arutyunov/dbdt)
и при необходимости пересохраняются оттуда заново.

Что делает:
  1. Удаляет картинки, на которые не ссылается ни одна страница и ни один CSS.
  2. Ужимает растр до 2× ширины отрисовки (retina) и переводит в WebP —
     но только если так получается легче: палитровые PNG часто уже оптимальны.
  3. Переводит GIF в mp4 (они весят в 10–15 раз меньше при том же виде).
  4. Пишет tools/image-rename.json — карту «старый путь → новый»,
     чтобы поправить ссылки в разметке (см. --fix-links).

Запуск:
    npm run build                       # нужен свежий site/
    node tools/measure-images.mjs       # необязательно, но желательно
    python3 tools/optimize-images.py
    python3 tools/optimize-images.py --fix-links    # правит src/pages/*.html
    npm run build                       # пересобрать и проверить

Требуются: sips (входит в macOS), cwebp (brew install webp), ffmpeg.

Внимание: ссылки, собранные шаблоном (`src="/images/x/{% if lang == 'ru' %}1.jpg…`),
--fix-links не поймает — их правят руками. Лучше такие пути не писать вовсе:
проще продублировать целиком весь тег внутри {% if %}.
"""

import json, os, glob, re, subprocess, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

WIDTHS_FILE = "tools/image-widths.json"
RENAME_FILE = "tools/image-rename.json"
FALLBACK_WIDTH = 960      # ширина текстовой колонки, если замеров нет
LIGHTBOX_MIN = 1600       # картинки, открывающиеся во весь экран
QUALITY = {"jpg": 82, "jpeg": 82, "png": 90}   # фото жмём сильнее, графику мягче


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def natural_size(path):
    out = sh(f'sips -g pixelWidth -g pixelHeight "{path}"').stdout
    w = h = 0
    for line in out.split("\n"):
        if "pixelWidth:" in line: w = int(line.split(":")[1])
        if "pixelHeight:" in line: h = int(line.split(":")[1])
    return w, h


def used_paths():
    """все /images/… , на которые ссылаются собранные страницы и CSS"""
    used = set()
    for f in glob.glob("site/**/*.html", recursive=True):
        used |= set(re.findall(r'(?:src|href)="(/images/[^"?]+)"', open(f).read()))
    for f in glob.glob("static/css/**/*.css", recursive=True):
        used |= set(re.findall(r'url\("(/images/[^"]+)"\)', open(f).read()))
    return used


def fix_links():
    rename = json.load(open(RENAME_FILE))
    videos = {k: v for k, v in rename.items() if v.endswith(".mp4")}
    images = {k: v for k, v in rename.items() if not v.endswith(".mp4")}
    n_img = n_vid = 0
    for f in glob.glob("src/pages/*.html"):
        s = orig = open(f).read()
        for old, new in videos.items():
            s, k = re.subn(r"<img[^>]*?src=\"" + re.escape(old) + r"\"[^>]*?/?>",
                           f'<video src="{new}" autoplay loop muted playsinline></video>', s)
            n_vid += k
        for old, new in images.items():
            if f'"{old}"' in s:
                s = s.replace(f'"{old}"', f'"{new}"'); n_img += 1
        if s != orig: open(f, "w").write(s)
    print(f"ссылок на картинки поправлено: {n_img}, gif→video: {n_vid}")
    left = set()
    for f in glob.glob("src/pages/*.html"):
        for u in re.findall(r'"(/images/[^"]+\.(?:png|jpg|jpeg|gif))"', open(f).read()):
            if not os.path.exists("static" + u): left.add(u)
    if left:
        print("ВНИМАНИЕ, ссылки на исчезнувшие файлы (вероятно, собраны шаблоном):")
        for u in sorted(left): print("   ", u)


def main():
    if "--fix-links" in sys.argv:
        return fix_links()

    if os.path.exists(WIDTHS_FILE):
        m = json.load(open(WIDTHS_FILE)); widths, gallery = m["widths"], set(m["gallery"])
    else:
        print(f"нет {WIDTHS_FILE}, ширина отрисовки считается равной {FALLBACK_WIDTH}px")
        widths, gallery = {}, set()

    used = used_paths()
    rename, stat = {}, {k: [0, 0, 0] for k in ("removed", "webp", "resized", "gif", "kept")}

    # 1. мусор
    for p in sorted(glob.glob("static/images/**/*", recursive=True)):
        if os.path.isfile(p) and "/" + p.replace("static/", "") not in used:
            stat["removed"][0] += 1; stat["removed"][1] += os.path.getsize(p)
            os.remove(p)

    # 2. растр
    for p in sorted(glob.glob("static/images/**/*", recursive=True)):
        if not os.path.isfile(p): continue
        ext = os.path.splitext(p)[1].lower().lstrip(".")
        if ext not in QUALITY: continue
        web = "/" + p.replace("static/", "")
        orig = os.path.getsize(p)
        nw, _ = natural_size(p)
        if not nw:
            print("не читается:", p); continue

        target = min(nw, max(widths.get(web, FALLBACK_WIDTH) * 2, 400))
        if web in gallery: target = min(nw, max(target, LIGHTBOX_MIN))

        tmp, src = f"/tmp/_opt.{ext}", p
        if target < nw:
            if sh(f'sips -Z {target} "{p}" --out {tmp}').returncode: continue
            src = tmp
        out = os.path.splitext(p)[0] + ".webp"
        if sh(f'cwebp -q {QUALITY[ext]} -quiet "{src}" -o "{out}"').returncode: continue

        if os.path.getsize(out) < orig * 0.95:
            os.remove(p)
            rename[web] = os.path.splitext(web)[0] + ".webp"
            stat["webp"][0] += 1; stat["webp"][1] += orig; stat["webp"][2] += os.path.getsize(out)
        else:
            os.remove(out)   # WebP не выиграл — оставляем оригинал как есть
            stat["kept"][0] += 1; stat["kept"][1] += orig
        if os.path.exists(tmp): os.remove(tmp)

    # 3. GIF → mp4
    for p in sorted(glob.glob("static/images/**/*.gif", recursive=True)):
        web = "/" + p.replace("static/", "")
        nw, _ = natural_size(p)
        target = min(nw, max(widths.get(web, FALLBACK_WIDTH) * 2, 640))
        target -= target % 2
        orig = os.path.getsize(p)
        out = os.path.splitext(p)[0] + ".mp4"
        r = sh(f'ffmpeg -y -v error -i "{p}" -movflags faststart -pix_fmt yuv420p '
               f'-vf "scale={target}:-2:flags=lanczos" -c:v libx264 -crf 27 -an "{out}"')
        if r.returncode or not os.path.exists(out):
            print("ffmpeg не справился:", p); continue
        os.remove(p)
        rename[web] = os.path.splitext(web)[0] + ".mp4"
        stat["gif"][0] += 1; stat["gif"][1] += orig; stat["gif"][2] += os.path.getsize(out)

    json.dump(rename, open(RENAME_FILE, "w"), ensure_ascii=False, indent=1)
    mb = lambda x: x / 1024 / 1024
    print(f"удалено неиспользуемых: {stat['removed'][0]:4} шт, {mb(stat['removed'][1]):6.1f} МБ")
    print(f"переведено в WebP:      {stat['webp'][0]:4} шт, {mb(stat['webp'][1]):6.1f} → {mb(stat['webp'][2]):5.1f} МБ")
    print(f"GIF → mp4:              {stat['gif'][0]:4} шт, {mb(stat['gif'][1]):6.1f} → {mb(stat['gif'][2]):5.1f} МБ")
    print(f"оставлено как есть:     {stat['kept'][0]:4} шт, {mb(stat['kept'][1]):6.1f} МБ")
    print(f"\nдальше: python3 tools/optimize-images.py --fix-links && npm run build")


if __name__ == "__main__":
    main()
