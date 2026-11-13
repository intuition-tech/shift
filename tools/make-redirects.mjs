// Карта редиректов со старых адресов на новые → deploy/nginx/shift-redirects.conf.
// Запуск: node tools/make-redirects.mjs. Результат коммитится; CI кладёт файл
// в /etc/nginx/snippets/ и перечитывает nginx, если он изменился.
//
// Источники: publications.js (oldUrl → /slug/), authors.js (/author/slug →
// фильтр по автору), ручная карта старых разделов /topic/* → теги новой
// таксономии. Всё — в двух вариантах, с /en и без. Что не попало в карту,
// получает 404 новой версии со ссылкой на тот же путь в архиве.
import fs from "node:fs";
import publications from "../src/data/publications.js";
import authors from "../src/data/authors.js";
import taxonomy from "../src/data/taxonomy.js";

const OUT = new URL("../deploy/nginx/shift-redirects.conf", import.meta.url);

// Старый /topic/<slug> → измерение и слаг новой таксономии. Чего нет — в общий список.
const TOPICS = {
  // подборки
  "make-basic-layouts": ["collection", "dodo-design-basics"],
  "pizza-photo-for-a-catalog": ["collection", "catalog-pizza-shoot"],
  "launching-social-network-in-a-new-country": ["collection", "social-media-launch"],
  menu: ["collection", "menu"],
  "keyvisual-compilation": ["collection", "keyvisual"],
  "key-visual": ["collection", "keyvisual"],
  "app-stories": ["collection", "in-app-stories"],
  "video-clip": ["collection", "video"],
  "editorial-policy": ["collection", "editorial-policy-archive"],
  "saving-layouts": ["collection", "design-hygiene"],
  package: ["collection", "package"],
  "digital-ad-layouts": ["collection", "digital-ad-layouts"],
  "adaptation-of-layouts": ["collection", "hq-layouts-adaptation"],
  "dodo-pizzas-brand-identity": ["collection", "dodo-pizzas-brand-identity"],
  // рынки
  dubai: ["market", "uae"],
  // области
  infoplanning: ["area", "infoplanning"],
  "work-with-files": ["area", "work-with-files"],
  photoshoot: ["area", "photoshoot"],
  smm: ["area", "smm"],
  retouching: ["area", "retouching"],
  "creative-techniques": ["area", "creative-techniques"],
  "dodo-global-meme-park": ["area", "meme-park"],
  "motion-design": ["area", "motion-design"],
  "global-kv-packs": ["area", "kv-packs"],
  producing: ["area", "producing"],
  "graphic-design": ["area", "graphic-design"],
  "design-team-managment": ["area", "design-team-management"],
  automation: ["area", "automation"],
  "legal-aspects": ["area", "legal-aspects"],
  "channels-and-media": ["area", "channels-and-media"],
  texts: ["area", "texts"]
};

const DIM_LIST = { collection: "collections", market: "markets", area: "areas" };
for (const [topic, [dim, slug]] of Object.entries(TOPICS)) {
  if (!taxonomy[DIM_LIST[dim]].some((t) => t.slug === slug)) {
    throw new Error(`Нет тега ${dim}:${slug} для /topic/${topic}`);
  }
}

// Остальные старые темы — просто на список публикаций
const OTHER_TOPICS = [
  "drinkit", "feedback-for-designers", "surveys", "interiors-in-qsr", "brand",
  "design", "layouts", "circulation", "naming", "positioning", "process",
  "typography", "food-styling", "radio-commercial"
];

const rules = []; // [старый путь без /en, новый путь без /en]

for (const p of publications) {
  if (!p.oldUrl) continue;
  const oldPath = new URL(p.oldUrl).pathname.replace(/\/$/, "");
  const newPath = `/${p.slug}/`;
  if (oldPath + "/" === newPath) continue; // адрес не менялся
  rules.push([oldPath, newPath]);
}

rules.push(["/author", "/people/"]);
for (const slug of Object.keys(authors)) {
  rules.push([`/author/${slug}`, `/publications/?author=${slug}`]);
}

rules.push(["/topic", "/publications/?group=collections"]);
for (const [topic, [dim, slug]] of Object.entries(TOPICS)) {
  rules.push([`/topic/${topic}`, `/publications/?${dim}=${slug}`]);
}
for (const topic of OTHER_TOPICS) rules.push([`/topic/${topic}`, "/publications/"]);

// Проверка на дубли старых путей
const seen = new Set();
for (const [from] of rules) {
  if (seen.has(from)) throw new Error(`Дубль старого пути ${from}`);
  seen.add(from);
}

// map в контексте http: точные ключи (хэш, а не перебор регулярок) — по четыре
// на правило: с хвостовым слэшем и без, с /en и без. Пустое значение — редиректа нет.
const lines = [
  "# Сгенерировано tools/make-redirects.mjs — не править руками.",
  `# ${rules.length} старых адресов × 2 языка × слэш. Лежит в /etc/nginx/conf.d/,`,
  "# срабатывает в server {} shift.dodobrands.io одной строкой:",
  "#   if ($shift_redirect) { return 301 $shift_redirect; }",
  "",
  "# Ключи длинные: нужен map_hash_bucket_size 128 — он в conf.d/00-map-hash.conf,",
  "# отдельно, потому что nginx принимает его только до первого map в http {}",
  "",
  "map $uri $shift_redirect {",
  "    default \"\";",
  "",
  "    # Старый глоссарий был деревом страниц — всё в новый глоссарий",
  "    \"~^/(?<en>en/)?glossary/.\"  /${en}glossary/;",
  ""
];
for (const [from, to] of rules) {
  for (const prefix of ["", "/en"]) {
    const target = `${prefix}${to}`;
    lines.push(`    ${prefix}${from}  ${target};`);
    lines.push(`    ${prefix}${from}/  ${target};`);
  }
}
lines.push("}");
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${rules.length} правил → ${OUT.pathname}`);

function escapeRe(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}
