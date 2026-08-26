/* Замеряет, с какой шириной каждая картинка реально рисуется на собранном сайте.
   Результат → tools/image-widths.json, его читает optimize-images.py.

   Запуск (нужен собранный сайт и локальный сервер):
     npm run build
     python3 -m http.server 8091 --directory site &
     node tools/measure-images.mjs

   Playwright берётся из соседнего проекта; если его нет — поставьте
   `npm i -D playwright-core` и поправьте путь импорта. */

import { chromium } from "/Users/arutyunov/pndlnk-site/node_modules/playwright-core/index.mjs";
import fs from "fs";

const PORT = process.env.PORT || 8091;
const VIEWPORT = 1600; // максимальная ширина контейнера сайта

const dirs = fs.readdirSync("site").filter((d) => fs.existsSync(`site/${d}/index.html`) && d !== "en");
const urls = [...dirs.map((d) => `/${d}/`), "/", ...dirs.map((d) => `/en/${d}/`), "/en/"];

const browser = await chromium.launch({ channel: "chrome" });
const widths = {};
const gallery = new Set();

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: VIEWPORT, height: 1200 } });
  try {
    await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));
    const data = await page.evaluate(() => ({
      imgs: Array.from(document.querySelectorAll("img")).map((i) => ({
        src: i.getAttribute("src"),
        disp: Math.round(i.getBoundingClientRect().width),
      })),
      // картинки, открывающиеся в лайтбоксе — им нужен размер побольше
      hrefs: Array.from(document.querySelectorAll("ids-gallery a")).map((a) => a.getAttribute("href")),
    }));
    for (const i of data.imgs) {
      if (!i.src?.startsWith("/images/")) continue;
      if (!widths[i.src] || i.disp > widths[i.src]) widths[i.src] = i.disp;
    }
    for (const h of data.hrefs) if (h?.startsWith("/images/")) gallery.add(h);
  } catch (e) {
    console.error("не открылась:", url, e.message.slice(0, 60));
  }
  await page.close();
}

fs.writeFileSync("tools/image-widths.json", JSON.stringify({ widths, gallery: [...gallery] }, null, 1));
console.log(`страниц: ${urls.length}, картинок: ${Object.keys(widths).length}, в галереях: ${gallery.size}`);
await browser.close();
