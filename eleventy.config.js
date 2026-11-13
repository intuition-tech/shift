import fs from "node:fs";
import path from "node:path";
import publications from "./src/data/publications.js";

// Где используется компонент — для витрины /design-system/. Сканирует разметку
// страниц (кроме самой витрины) и инклюдов на сборке. Селектор: "tag.class.class",
// ".class" или "tag"; несколько через запятую. Одно вхождение на странице —
// якорная ссылка на охватывающий <ids-nav-item id>, несколько — просто URL.
const PAGES_DIR = "./src/pages";
const INCLUDES_DIR = "./src/includes";
let sourcesCache = null;

function readSources() {
  if (sourcesCache) return sourcesCache;
  const list = [];
  for (const file of fs.readdirSync(PAGES_DIR)) {
    if (!file.endsWith(".html") || file === "design-system.html") continue;
    const slug = file.replace(/\.html$/, "");
    const text = fs.readFileSync(path.join(PAGES_DIR, file), "utf8");
    const pub = publications.find((p) => p.slug === slug);
    const fm = text.match(/^title:\s*(.+)$/m);
    const title = pub?.title || (fm ? fm[1].replace(/\s*[—-]\s*Shift\s*$/, "").trim() : slug);
    list.push({ kind: "page", slug, text, url: slug === "index" ? "/" : `/${slug}/`, title: slug === "index" ? "Главная" : title });
  }
  for (const file of fs.readdirSync(INCLUDES_DIR)) {
    if (!file.endsWith(".html")) continue;
    list.push({ kind: "include", slug: file, text: fs.readFileSync(path.join(INCLUDES_DIR, file), "utf8"), title: `includes/${file}` });
  }
  sourcesCache = list;
  return list;
}

function parseSelector(sel) {
  const [tagPart, ...classes] = sel.trim().split(".");
  return { tag: tagPart || null, classes };
}

// Позиции всех тегов, подходящих под селектор
function findMatches(text, selectors) {
  const positions = [];
  const tagRe = /<([a-z][a-z0-9-]*)\b([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(text))) {
    const classAttr = m[2].match(/\sclass="([^"]*)"/);
    // Шаблонные вставки в атрибуте (class="search{% if … %}") — не токены
    const tokens = classAttr ? classAttr[1].replace(/{[%{][\s\S]*?[%}]}/g, " ").split(/\s+/).filter(Boolean) : [];
    for (const { tag, classes } of selectors) {
      if (tag && m[1] !== tag) continue;
      if (classes.every((c) => tokens.includes(c))) {
        positions.push(m.index);
        break;
      }
    }
  }
  return positions;
}

// id охватывающего <ids-nav-item> для позиции в тексте, если он есть
function enclosingSection(text, pos) {
  const before = text.slice(0, pos);
  const open = before.lastIndexOf("<ids-nav-item");
  if (open === -1) return null;
  if (before.lastIndexOf("</ids-nav-item>") > open) return null;
  const id = before.slice(open).match(/\sid="([^"]+)"/);
  return id ? id[1] : null;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function renderUsages(selectorList) {
  const selectors = selectorList.split(",").map(parseSelector);
  const items = [];
  for (const src of readSources()) {
    const positions = findMatches(src.text, selectors);
    if (!positions.length) continue;
    if (src.kind === "include") {
      items.push({ title: src.title, html: `<li>${escapeHtml(src.title)}</li>` });
      continue;
    }
    const section = positions.length === 1 ? enclosingSection(src.text, positions[0]) : null;
    const href = section ? `${src.url}#${section}` : src.url;
    items.push({ title: src.title, html: `<li><a href="${href}">${escapeHtml(src.title)}</a></li>` });
  }
  items.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const list = items.length
    ? `<ul>${items.map((i) => i.html).join("")}</ul>`
    : `<p class="guide-component__usage-none">Пока не используется</p>`;
  const body = items.length > 24
    ? `<details><summary>${items.length} страниц</summary>${list}</details>`
    : list;
  return `<div class="guide-component__usage">${body}</div>`;
}

export default function (conf) {
  // static/ повторяет корень сайта: css и js дизайн-системы, fonts, favicon
  conf.addPassthroughCopy({ static: "/" });

  // Абсолютный адрес сайта — для canonical, og:url, hreflang и sitemap.xml
  conf.addGlobalData("siteUrl", "https://shift.dodobrands.io");

  // Страницы для sitemap.xml: без служебных (404, витрина) и без скрытых публикаций
  conf.addFilter("sitemapPages", (pages) =>
    pages.filter((item) => {
      const stem = item.data.page.filePathStem;
      if (stem === "/404" || stem === "/sitemap" || stem === "/design-system") return false;
      const pub = publications.find((p) => p.slug === item.data.page.fileSlug);
      return !(pub && pub.status === "hidden");
    })
  );

  // Дев-режим (--serve/--watch): в продовой сборке isDev = false.
  // Функция — чтобы ELEVENTY_RUN_MODE читался в момент сборки данных
  conf.addGlobalData("isDev", () => process.env.ELEVENTY_RUN_MODE !== "build");

  // Публикация по слагу страницы — для мета-блока pub-meta.html
  conf.addFilter("pub", (publications, slug) =>
    publications.find((p) => p.slug === slug)
  );

  // Все публикации по дате, новое сверху; без даты (внешние) — в конец
  conf.addFilter("byDateDesc", (publications) =>
    [...publications].filter((p) => p.status !== "hidden").sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    })
  );

  // Разрез по флагу «новое» — для двух частей таблицы на главной
  conf.addFilter("newOnly", (publications) => publications.filter((p) => p.isNew));
  conf.addFilter("notNew", (publications) => publications.filter((p) => !p.isNew));

  // Число публикаций с тегом — для промоблоков главной
  conf.addFilter("countPubs", (publications, kind, slug) =>
    publications.filter((p) =>
      p.status !== "hidden" && (kind === "market" ? p.markets : p.collections).includes(slug)
    ).length
  );

  // Люди — для блока «Люди» (people.html): авторы, у которых есть публикации,
  // с числом публикаций, по алфавиту. Справочник authors.js шире — в нём
  // есть и люди без публикаций, их не выводим
  conf.addFilter("people", (publications, authors) => {
    const counts = new Map();
    for (const p of publications) {
      if (p.status === "hidden") continue;
      for (const slug of p.authors || []) counts.set(slug, (counts.get(slug) || 0) + 1);
    }
    return [...counts]
      .map(([slug, count]) => ({ slug, count, name: slug, photo: null, ...authors[slug] }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  });

  // Имя тега по слагу из списка таксономии: taxonomy.markets | tagName("russia", lang)
  conf.addFilter("tagName", (list, slug, lang) => {
    const tag = list.find((t) => t.slug === slug);
    return tag ? (lang === "en" ? tag.en : tag.ru) : slug;
  });

  // «17.06.2025» — короткая дата для таблицы
  conf.addFilter("shortDate", (iso) =>
    iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—"
  );

  // «1 июня 2025» / «1 June 2025»
  conf.addFilter("formatDate", (iso, lang) => {
    if (!iso) return "";
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
      .format(new Date(iso))
      .replace(/\s*г\.$/, "");
  });
  // Список использований компонента на витрине; кэш исходников сбрасывается на каждую сборку
  conf.on("eleventy.before", () => { sourcesCache = null; });
  conf.addFilter("usages", renderUsages);

  conf.addPassthroughCopy({ "src/styles/site.css": "assets/site.css" });
  conf.addPassthroughCopy({ "src/scripts/main.js": "assets/main.js" });

  conf.addWatchTarget("./src/styles/");
  conf.addWatchTarget("./src/scripts/");

  return {
    dir: {
      input: "./src/pages",
      includes: "../includes",
      data: "../data",
      output: "./site"
    },
    htmlTemplateEngine: "njk"
  };
}
