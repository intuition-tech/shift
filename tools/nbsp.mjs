#!/usr/bin/env node
/* Неразрывные пробелы в тексте публикаций. Правила и ограничения — docs/nbsp.md.

   Запуск — только по запросу, для выбранных публикаций:
     node tools/nbsp.mjs <slug|путь> [<slug|путь> …]   # правит на месте
     node tools/nbsp.mjs <slug> --check                 # ничего не пишет, код выхода 1, если есть что ставить
     node tools/nbsp.mjs <slug> --diff                  # показывает замены построчно, не пишет

   Слаг раскрывается в src/pages/<slug>.html и заголовки этой публикации
   (title, titleEn) в src/data/publications.js. Путь к .html — только файл.
   Без аргументов не делает ничего: по всем страницам разом не ходит. */

import fs from "fs";
import path from "path";

const NBSP = " ";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA = path.join(ROOT, "src/data/publications.js");

// --- правила: пары [регулярка, замена]; пробел ставится только обычный (U+0020) ---

const CYR = "а-яёА-ЯЁ";
const RULES = [
  // тире: пробел перед «—» неразрывный, после — обычный
  [/ —(?=\s|$)/g, `${NBSP}—`],
  // число + слово/единица; № и § + число; разряды в числах
  [new RegExp(`(\\d) (?=[${CYR}a-zA-Z%₽$€£])`, "g"), `$1${NBSP}`],
  [/([№§]) (?=\d)/g, `$1${NBSP}`],
  [/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`],
  // инициалы и сокращения
  [new RegExp(`\\b([А-ЯЁA-Z]\\.) (?=[А-ЯЁA-Z][${CYR}a-z])`, "g"), `$1${NBSP}`],
  [/\b(т\.) (?=[еёдп]\.)/g, `$1${NBSP}`],
  [/\b(см\.|рис\.|стр\.|гл\.|табл\.) /g, `$1${NBSP}`],
  // RU: после слова из 1–2 букв
  [new RegExp(`(^|[\\s(«"'„“])([${CYR}]{1,2}) (?=[${CYR}0-9«"(])`, "g"), `$1$2${NBSP}`],
  // RU: перед частицами
  [new RegExp(`([${CYR}]) (же|ли|бы|б|ль)(?=[\\s.,;:!?)»]|$)`, "g"), `$1${NBSP}$2`],
  // EN: после слова из 1–2 букв (аббревиатуры из двух заглавных не считаются)
  [/(^|[\s("“])([A-Za-z]|[A-Z][a-z]|[a-z]{2}) (?=[A-Za-z0-9("“])/g, `$1$2${NBSP}`],
];
// короткое слово в конце отрезка, за которым строчный тег: «в <a>…»
const TRAILING = [
  new RegExp(`(^|[\\s(«"'„“])([${CYR}]{1,2}) $`),
  /(^|[\s("“])([A-Za-z]|[A-Z][a-z]|[a-z]{2}) $/,
];

function applyRules(text, nextIsInline) {
  let prev;
  do {
    prev = text;
    for (const [re, rep] of RULES) text = text.replace(re, rep);
  } while (text !== prev);
  if (nextIsInline) for (const re of TRAILING) text = text.replace(re, `$1$2${NBSP}`);
  return text;
}

// --- разбор страницы ---

const INLINE = new Set(["a", "b", "i", "em", "strong", "span", "mark", "code", "s", "u", "sub", "sup", "small", "abbr"]);
const SKIP = new Set(["code", "pre", "script", "style", "svg", "textarea"]);
const TOKEN = /<!--[\s\S]*?-->|{#[\s\S]*?#}|{%[\s\S]*?%}|{{[\s\S]*?}}|<[^>]+>/g;

function processHtml(src) {
  let head = "";
  if (src.startsWith("---\n")) {
    const end = src.indexOf("\n---\n", 4);
    if (end > 0) { head = src.slice(0, end + 5); src = src.slice(end + 5); }
  }
  const tokens = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    if (m.index > last) tokens.push({ text: src.slice(last, m.index) });
    tokens.push({ tag: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) tokens.push({ text: src.slice(last) });

  let depth = 0;
  const out = tokens.map((t, i) => {
    if (t.tag !== undefined) {
      const m = /^<(\/?)([a-zA-Z][\w-]*)/.exec(t.tag);
      if (m && SKIP.has(m[2].toLowerCase())) depth += m[1] ? -1 : 1;
      return t.tag;
    }
    if (depth > 0) return t.text;
    const next = tokens[i + 1]?.tag;
    const nextInline = !!next && INLINE.has((/^<([a-zA-Z][\w-]*)/.exec(next) || [])[1]?.toLowerCase());
    return applyRules(t.text, nextInline);
  });
  return head + out.join("");
}

// заголовки публикации в данных: только title/titleEn записи с этим слагом
function processData(src, slug) {
  const at = src.indexOf(`"slug": "${slug}"`);
  if (at < 0) return src;
  const end = src.indexOf("\n  }", at);
  const block = src.slice(at, end);
  const fixed = block.replace(/("title(?:En)?": ")(.*?)(")/g, (_, a, v, b) => a + applyRules(v, false) + b);
  return src.slice(0, at) + fixed + src.slice(end);
}

// --- CLI ---

const args = process.argv.slice(2);
const check = args.includes("--check");
const diff = args.includes("--diff");
const targets = args.filter((a) => !a.startsWith("--"));
if (!targets.length) {
  console.error("Нужны слаги или пути к .html — по всем страницам инструмент не ходит. См. docs/nbsp.md");
  process.exit(2);
}

let total = 0;
function report(file, before, after) {
  if (before === after) { console.log(`${file}: без изменений`); return; }
  const a = before.split("\n"), b = after.split("\n");
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const count = (b[i].split(NBSP).length - 1) - (a[i].split(NBSP).length - 1);
    n += count;
    if (check || diff) {
      const frag = b[i].trim().replace(/ /g, "␣");
      console.log(`  ${i + 1}: ${frag.length > 110 ? frag.slice(0, 110) + "…" : frag}`);
    }
  }
  total += n;
  console.log(`${file}: ${check || diff ? "не хватает" : "поставлено"} ${n}`);
  if (!check && !diff) fs.writeFileSync(file, after);
}

for (const t of targets) {
  if (t.endsWith(".html")) {
    const file = path.resolve(t);
    const src = fs.readFileSync(file, "utf8");
    report(path.relative(ROOT, file), src, processHtml(src));
    continue;
  }
  const page = path.join(ROOT, "src/pages", `${t}.html`);
  if (!fs.existsSync(page)) { console.error(`нет страницы ${page}`); process.exitCode = 2; continue; }
  const src = fs.readFileSync(page, "utf8");
  report(path.relative(ROOT, page), src, processHtml(src));
  const data = fs.readFileSync(DATA, "utf8");
  report(`publications.js (${t})`, data, processData(data, t));
}
if (check && total) process.exit(1);
