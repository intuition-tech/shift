// Одноразовая генерация страниц-заглушек для публикаций со status: "stub"
// в src/data/publications.js: реальный URL, h1, мета-блок, нота о переносе.
// Перенос гайда = перезаписать файл настоящей вёрсткой (и сменить status
// на "published" в publications.js). Существующие файлы скрипт не трогает.
//
//   node tools/make-stubs.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publications = (await import(path.join(root, "src/data/publications.js"))).default;

// titleEn у заглушек не выдумываем: нет перевода — английская страница
// показывает русский текст (правило проекта).
const stub = (pub) => `---
title: ${pub.title.includes(":") ? JSON.stringify(pub.title + " — Shift") : pub.title + " — Shift"}
tags: guide
stub: true
---
<div class="ids__space XL"></div>
<article class="ids__wrapper guide">
  <h1>${pub.title}</h1>
  {% include "pub-meta.html" %}
  {% include "stub-note.html" %}
  <div class="ids__space L"></div>
</article>
`;

let made = 0;
for (const pub of publications.filter((p) => p.status === "stub")) {
  const file = path.join(root, "src/pages", pub.slug + ".html");
  if (fs.existsSync(file)) { console.log("skip (файл есть):", pub.slug); continue; }
  fs.writeFileSync(file, stub(pub));
  made++;
}
console.log(`Создано заглушек: ${made}`);
