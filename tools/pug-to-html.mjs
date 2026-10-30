// Рендерит Pug-страницу старого сайта (dbdt) в HTML с переключением языка
// Nunjucks — заготовка для переноса публикации. Текст приезжает дословно,
// разметку дальше перекладываем на компоненты IDS руками.
//
//   node tools/pug-to-html.mjs <путь к .pug> [--ru-only] [--out <файл>]
//
// Что делает: убирает extends/include и блоки шапки (meta, теги, авторы),
// подменяет миксины +ru/+en/+es маркерами, рендерит Pug (из скретчпада,
// см. PUG_DIR), затем <ru>…</ru><en>…</en> → {% if lang == 'ru' %}…{% else %}…{% endif %}.
// Пустой +en → русский текст без условия. --ru-only — выбросить все +en
// (решение «без перевода, как на старом сайте»).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const PUG_DIR = process.env.PUG_DIR || "/private/tmp/claude-501/-Users-arutyunov-shift/867b2286-8e5a-420a-a17b-e036400017fb/scratchpad/pugenv";
const pug = createRequire(path.join(PUG_DIR, "/"))("pug");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const ruOnly = args.includes("--ru-only");
const outIdx = args.indexOf("--out");
const out = outIdx !== -1 ? args[outIdx + 1] : null;
if (!file) {
  console.error("usage: node tools/pug-to-html.mjs <file.pug> [--ru-only] [--out file]");
  process.exit(1);
}

const basedir = file.replace(/\/src\/pages\/.*$/, "/src/pages");
let src = fs.readFileSync(file, "utf8");

// Шапка страницы: extends, include, блоки meta/digestTags/peopleTags — не нужны
const lines = src.split("\n");
const kept = [];
let skipping = false;
for (const line of lines) {
  if (/^(extends|include)\b/.test(line)) continue;
  if (/^block (meta|digestTags|peopleTags)\b/.test(line)) { skipping = true; continue; }
  if (/^block content\b/.test(line)) { skipping = false; continue; }
  if (/^\S/.test(line) && !/^\s*$/.test(line)) skipping = false;
  if (skipping) continue;
  kept.push(line);
}
// block content — отступ в два пробела снимаем
let body = kept.map((l) => (l.startsWith("  ") ? l.slice(2) : l));

// Обвязка старого шаблона: блоки выбрасываем целиком, обёртки — раскрываем
const DROP = [/^\s*\.mobile-breadcrumbs\b/, /^\s*\.guide-nav-wrapper\b/, /^\s*\.ids__stack-/];
const UNWRAP = [/^\s*\.ids__wrapper\b/, /^\s*\.guide-body-wrapper\b/, /^\s*\.guide-three-column-wrapper\b/];
const indentOf = (l) => l.match(/^\s*/)[0].length;
function stripBlocks(lines, patterns, unwrap) {
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!patterns.some((re) => re.test(line))) { result.push(line); continue; }
    const base = indentOf(line);
    let j = i + 1;
    while (j < lines.length && (/^\s*$/.test(lines[j]) || indentOf(lines[j]) > base)) {
      if (unwrap) result.push(/^\s*$/.test(lines[j]) ? lines[j] : lines[j].slice(2));
      j++;
    }
    i = j - 1;
  }
  return result;
}
body = stripBlocks(body, DROP, false);
body = stripBlocks(body, UNWRAP, true);
src = body.join("\n");

const prelude = `mixin ru
  ru
    block
mixin en
  en
    block
mixin es
  es
    block
mixin a
  a&attributes(attributes)
    block
mixin digest-tag(x)
  - void 0
mixin topic-tag(x)
  - void 0
mixin author-tag(x)
  - void 0
mixin meta(x)
  - void 0
`;

let html = pug.render(prelude + src, { basedir, filename: file, pretty: true, doctype: "html" });

// Маркеры → Nunjucks. Сначала внутренние пары (без вложенных маркеров внутри)
const RU = /<ru>((?:(?!<ru>)[\s\S])*?)<\/ru>/;
const PAIR = /<ru>((?:(?!<ru>)[\s\S])*?)<\/ru>\s*<en>((?:(?!<en>)[\s\S])*?)<\/en>/;
html = html.replace(/<es>[\s\S]*?<\/es>\s*/g, "");
if (ruOnly) {
  html = html.replace(/<en>((?:(?!<en>)[\s\S])*?)<\/en>\s*/g, "");
}
// Сначала все пары (глобально, до стабилизации — так внешние +ru с вложенными
// парами внутри резолвятся после внутренних), затем одиночные +ru
const pairFn = (m, ru, en) => {
  ru = ru.trim(); en = en.trim();
  return en ? `{% if lang == 'ru' %}${ru}{% else %}${en}{% endif %}` : ru;
};
let prev;
do { prev = html; html = html.replace(new RegExp(PAIR.source, "g"), pairFn); } while (html !== prev);
do { prev = html; html = html.replace(new RegExp(RU.source, "g"), (m, ru) => ru.trim()); } while (html !== prev);
// Одиночные <en> без пары (например, стоящие первыми) — оставляем как есть, их видно
html = html.replace(/<\/?(ru|en)>/g, (m) => `<!-- ${m} -->`);

if (out) {
  fs.writeFileSync(out, html);
  console.error(`→ ${out} (${html.split("\n").length} строк)`);
} else {
  process.stdout.write(html);
}
