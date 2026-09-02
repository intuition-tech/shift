// Одноразовый импорт CSV «Shift — All Guides» → src/data/publications.js + src/data/authors.js.
// Дальше данные правятся руками, CSV не перечитывается.
//
//   node tools/import-csv.mjs [--force] [путь-к-csv]
//
// Что делает:
// - парсит CSV, нормализует теги в слаги (карты ниже, те же слаги в src/data/taxonomy.js);
// - матчит авторов со справочником старого сайта (dbdt/author-data.pug), копирует их фото _XS
//   в static/images/authors/<slug>.jpg;
// - контактное лицо (RU-имя) добавляет в авторы публикации, если его там нет;
// - дату берёт из последнего коммита pug-файла гайда в старом репозитории (git log);
// - команды раскладывает эвристикой по предметным областям (плейсхолдеры);
// - печатает отчёт: промахи по датам, несматченные авторы, рынки «?».
// Без --force существующие publications.js / authors.js не перезаписывает.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DBDT = "/Users/arutyunov/dbdt";
const force = process.argv.includes("--force");
const csvPath =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ||
  "/Users/arutyunov/Downloads/Copy of Shift — All Guides - All.csv";

const outPubs = path.join(root, "src/data/publications.js");
const outAuthors = path.join(root, "src/data/authors.js");
if (!force && (fs.existsSync(outPubs) || fs.existsSync(outAuthors))) {
  console.error("publications.js/authors.js уже существуют — данные правятся руками. Перезапись: --force");
  process.exit(1);
}

// ---------- карты нормализации (слаги = src/data/taxonomy.js) ----------

const MARKETS = { Россия: "russia", Евразия: "eurasia", ОАЭ: "uae" };

const AREAS = {
  "Графический дизайн": "graphic-design",
  "Работа с файлами": "work-with-files",
  СММ: "smm",
  Фотосъемка: "photoshoot",
  "Каналы и носители": "channels-and-media",
  "KV паки": "kv-packs",
  "Юридические аспекты": "legal-aspects",
  texts: "texts",
  Инфопланирование: "infoplanning",
  "Meme park": "meme-park",
  Ретушь: "retouching",
  Автоматизация: "automation",
  "Менеджмент в дизайн команде": "design-team-management",
  Продюсирование: "producing",
  "Моушен-дизайн": "motion-design",
  "Креативные техники": "creative-techniques"
};

const COLLECTIONS = {
  Кейвижуал: "keyvisual",
  "Дизайн-гигиена": "design-hygiene",
  "Адаптация макетов от УК": "hq-layouts-adaptation",
  "Запуск соцсетей в новой стране": "social-media-launch",
  "Сторис в приложении": "in-app-stories",
  "Макеты для диджитал рекламы": "digital-ad-layouts",
  "Основы дизайна в контексте Додо": "dodo-design-basics",
  "Редполитика (архив)": "editorial-policy-archive",
  "Каталожная съемка пиццы": "catalog-pizza-shoot",
  "dodo-pizzas-brand-identity": "dodo-pizzas-brand-identity",
  Упаковка: "package",
  Меню: "menu",
  Видеоролик: "video"
};

// Контактные лица в CSV названы по-русски; слаги — из справочника dbdt,
// пятерых там нет — заводим новых авторов без фото.
const CONTACTS = {
  "Катя Максимова": "katya-maksimova",
  "Аня Горохова": "anna-gorokhova",
  "Женя Ревенко": "evgeny-revenko",
  "Катя Бочкарёва": "katya-bochkaryova",
  "Сережа Лапухин": "sergey-lapukhin",
  "Спартак Петросян": "spartak-petrosyan",
  "Толя Малахов": "anatoly-malakhov",
  "Алина Афонькина": "alina-afonkina",
  "Андрей Лазагреев": "andrey-lazagreev",
  "Денис Хапинин": "denis-khapinin",
  "Ира Кнутас": "irina-knutas",
  "Катя Литвин": "katya-litvin",
  "Лена Алёхина": "elena-alekhina",
  "Соня Анненкова": "sofya-annenkova",
  "Тимур Якупов": "timur-yakupov",
  "Вова Чернышев": "vova-chernyshev",
  "Женя Хаидова": "evgeniya-hayidova"
};

const NEW_AUTHORS = {
  "katya-bochkaryova": "Katya Bochkaryova",
  "spartak-petrosyan": "Spartak Petrosyan",
  "katya-litvin": "Katya Litvin",
  "timur-yakupov": "Timur Yakupov",
  "vova-chernyshev": "Vova Chernyshev"
};

// Плейсхолдерные команды: эвристика по предметным областям, первая сработавшая.
const TEAM_BY_AREA = {
  smm: "social-media",
  photoshoot: "photo-video",
  retouching: "photo-video",
  producing: "photo-video",
  "motion-design": "photo-video",
  "channels-and-media": "digital",
  automation: "digital",
  infoplanning: "digital"
};
const DEFAULT_TEAM = "brand-design";

// Протухшие URL в CSV → фактический путь на старом сайте
const URL_OVERRIDES = {
  "https://shift.dodobrands.io/graphic-design/brandbook-dodo-pizza":
    "https://shift.dodobrands.io/graphic-design/visual-style-dodo-pizza"
};

// ---------- CSV ----------

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const clean = (s) => (s || "").replace(/ /g, " ").trim();
const splitList = (s) => clean(s).split(";").map(clean).filter(Boolean);

// ---------- справочник авторов dbdt ----------

const authorPug = fs.readFileSync(
  path.join(DBDT, "src/pages/partials/data/author-data.pug"), "utf8"
);
const dbdtAuthors = {}; // name → slug
for (const m of authorPug.matchAll(/slug: '([^']+)',\s*\n\s*nameAndSurname: '([^']+)'/g)) {
  dbdtAuthors[m[2]] = m[1];
}

const authors = {}; // slug → { slug, name, photo }
const report = { dateMiss: [], authorMiss: [], marketUnknown: [], stubs: 0 };

function authorBySlug(slug, name) {
  if (!authors[slug]) authors[slug] = { slug, name, photo: null };
  return slug;
}

function resolveAuthor(raw) {
  const name = clean(raw).replace(/\s*\(.*?\)\s*/g, ""); // «(не работает)» и т.п.
  if (!name) return null;
  if (dbdtAuthors[name]) return authorBySlug(dbdtAuthors[name], name);
  if (CONTACTS[name]) {
    const slug = CONTACTS[name];
    return authorBySlug(slug, NEW_AUTHORS[slug] || name);
  }
  // не нашли — заводим по имени, в отчёт
  const slug = name.toLowerCase().replace(/[^a-zа-яё]+/gi, "-").replace(/^-|-$/g, "");
  report.authorMiss.push(name);
  return authorBySlug(slug, name);
}

// ---------- публикации ----------

const rows = parseCSV(fs.readFileSync(csvPath, "utf8"))
  .filter((r) => clean(r[1]) && clean(r[1]) !== "Название" && clean(r[5]));

const publications = [];
for (const r of rows) {
  const title = clean(r[1]);
  const marketRaw = clean(r[2]);
  const contactRaw = clean(r[4]);
  const url = URL_OVERRIDES[clean(r[5])] || clean(r[5]);
  const external = !url.includes("shift.dodobrands.io");

  const slug = external
    ? null
    : url.replace(/\/+$/, "").split("/").pop();

  // авторы: «;»-списки, но есть и грязная запятая с RU-именами
  const authorList = [];
  for (const part of clean(r[12]).split(/[;,]/)) {
    const a = resolveAuthor(part);
    if (a && !authorList.includes(a)) authorList.push(a);
  }

  // контакт обязан быть автором: нет в списке — добавляем (решение владельца)
  let contact = null;
  if (contactRaw) {
    contact = CONTACTS[contactRaw] || null;
    if (!contact) report.authorMiss.push(`контакт: ${contactRaw}`);
    else {
      authorBySlug(contact, NEW_AUTHORS[contact] ||
        Object.entries(dbdtAuthors).find(([, s]) => s === contact)?.[0] || contactRaw);
      if (!authorList.includes(contact)) authorList.push(contact);
    }
  }

  const markets = MARKETS[marketRaw] ? [MARKETS[marketRaw]] : [];
  if (marketRaw === "?") report.marketUnknown.push(title);

  const areas = splitList(r[10]).map((a) => AREAS[a]).filter(Boolean);
  const collections = splitList(r[9]).map((c) => COLLECTIONS[c]).filter(Boolean);
  const teams = [areas.map((a) => TEAM_BY_AREA[a]).find(Boolean) || DEFAULT_TEAM];

  // статус: есть файл страницы → published, нет → stub, внешние → external
  let status = "external";
  if (!external) {
    status = fs.existsSync(path.join(root, "src/pages", slug + ".html")) ? "published" : "stub";
    if (status === "stub") report.stubs++;
  }

  // дата последнего коммита pug-файла в dbdt
  let date = null;
  if (!external) {
    const rel = "src/pages" + new URL(url).pathname + ".pug";
    try {
      date = execFileSync("git", ["-C", DBDT, "log", "-1", "--format=%cs", "--", rel],
        { encoding: "utf8" }).trim() || null;
    } catch { /* git недоступен — в отчёт ниже */ }
    if (!date) report.dateMiss.push(`${slug}  (${rel})`);
  }

  publications.push({
    slug,
    title,
    titleEn: null,
    date,
    authors: authorList,
    contact,
    markets,
    teams,
    areas,
    collections,
    isNew: false,
    status,
    oldUrl: external ? null : url,
    externalUrl: external ? url : null
  });
}

// ---------- заголовки titleEn из фронтматтера существующих страниц ----------

for (const pub of publications) {
  if (pub.status !== "published") continue;
  const page = fs.readFileSync(path.join(root, "src/pages", pub.slug + ".html"), "utf8");
  const m = page.match(/^titleEn:\s*["']?(.+?)["']?\s*$/m);
  if (m) pub.titleEn = m[1].replace(/\s*—\s*Shift\s*$/, "").trim();
}

// ---------- фото авторов ----------

const photoDir = path.join(root, "static/images/authors");
fs.mkdirSync(photoDir, { recursive: true });
for (const a of Object.values(authors)) {
  const src = path.join(DBDT, "static/images/authors", `${a.slug}_XS.jpg`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(photoDir, `${a.slug}.jpg`));
    a.photo = `/images/authors/${a.slug}.jpg`;
  }
}

// ---------- запись ----------

const header =
  "// Мастер-данные публикаций для таблицы на главной и мета-блоков под h1.\n" +
  "// Сгенерировано tools/import-csv.mjs из CSV «Shift — All Guides», дальше правится руками.\n" +
  "// Заголовки здесь — без суффикса « — Shift»; фронтматтер страниц остаётся для <title>/OG,\n" +
  "// слаг связывает запись со страницей src/pages/<slug>.html.\n" +
  "// Слаги тегов — из taxonomy.js, авторов — из authors.js. isNew — ручной флаг «новое».\n";

fs.writeFileSync(outPubs, header + "export default " + JSON.stringify(publications, null, 2) + ";\n");

const sortedAuthors = Object.fromEntries(
  Object.values(authors).sort((a, b) => a.slug.localeCompare(b.slug)).map((a) => [a.slug, a])
);
fs.writeFileSync(outAuthors,
  "// Справочник авторов. Имена английские (как на старом сайте); фото скопированы\n" +
  "// из dbdt (вариант _XS), photo: null — фото не было. Правится руками.\n" +
  "export default " + JSON.stringify(sortedAuthors, null, 2) + ";\n");

// ---------- отчёт ----------

console.log(`Публикаций: ${publications.length} (заглушек: ${report.stubs}, внешних: ${publications.filter(p => p.status === "external").length})`);
console.log(`Авторов: ${Object.keys(authors).length}, без фото: ${Object.values(authors).filter(a => !a.photo).map(a => a.slug).join(", ") || "нет"}`);
if (report.dateMiss.length) console.log(`\nMISS дат (${report.dateMiss.length}):\n  ` + report.dateMiss.join("\n  "));
if (report.authorMiss.length) console.log(`\nНесматченные авторы:\n  ` + [...new Set(report.authorMiss)].join("\n  "));
if (report.marketUnknown.length) console.log(`\nРынок «?» → без рынка (${report.marketUnknown.length}):\n  ` + report.marketUnknown.join("\n  "));
