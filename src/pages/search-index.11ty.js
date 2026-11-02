// Генератор поискового индекса: /search-index.json.
// Один общий JSON для обоих языков (поиск с любой страницы находит и русские,
// и английские страницы), на клиенте по нему работает js/search.js.
// Формат:
//   pubs    — страницы публикаций обоих языков: url, lang, slug, title, text
//             (чистый текст страницы без мета-блока; у заглушек пустой),
//             date, markets[], teams[] — для мета-строки в выдаче;
//   people  — авторы с публикациями: slug, name, count;
//   tags    — рынки, команды, предметные области, подборки: dim, slug, ru, en, count;
//   aliases — русские формы имён авторов (src/data/aliases.js).
// Движок текста портирован с arutyunov.info (там поиск обкатывался как прототип).

// Сущности, которые встречаются в контенте. &shy; и &#173; исчезают
// (они стоят внутри слов), пробельные становятся обычным пробелом.
const NAMED_ENTITIES = {
  shy: "",
  nbsp: " ",
  thinsp: " ",
  hairsp: " ",
  ensp: " ",
  emsp: " ",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  hellip: "…",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">"
};

function decodeEntities(text) {
  return text
    .replace(/&([a-z]+);/gi, (m, name) => {
      const key = name.toLowerCase();
      return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : m;
    })
    .replace(/&#(\d+);/g, (m, code) => {
      const cp = Number(code);
      return cp === 173 ? "" : String.fromCodePoint(cp);
    })
    .replace(/&#x([0-9a-f]+);/gi, (m, code) => {
      const cp = parseInt(code, 16);
      return cp === 0xad ? "" : String.fromCodePoint(cp);
    })
    .replace(/&amp;/g, "&");
}

function clean(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[­​]/g, "")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Мета-блок под h1 (pub-meta.html: авторы, теги, дата) в текст не идёт —
// авторы и теги ищутся своими разделами выдачи. Вложенных div в блоке нет.
function stripMeta(html) {
  return html.replace(/<div class="ids__pub-meta">[\s\S]*?<\/div>/, " ");
}

function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? clean(m[1]) : "";
}

// Заголовки фронтматтера — с суффиксом « — Shift» для <title>/OG
function stripSuffix(title) {
  return title ? title.replace(/\s+—\s+Shift$/, "") : "";
}

const DIMS = [
  ["market", "markets"],
  ["team", "teams"],
  ["area", "areas"],
  ["collection", "collections"]
];

export default {
  data() {
    return {
      // pages.11tydata.js навешивает layout и пагинацию по языкам;
      // отключить её из шаблона нельзя (pagination: false игнорируется,
      // permalink: false на одном проходе гасит оба). Поэтому оба прохода
      // пишут один и тот же полный двуязычный индекс по своим адресам,
      // а клиент берёт файл своего языкового раздела.
      layout: false,
      eleventyExcludeFromCollections: true,
      eleventyImport: { collections: ["all"] },
      eleventyComputed: {
        permalink: (data) =>
          data.lang === "en" ? "/en/search-index.json" : "/search-index.json"
      }
    };
  },

  render(data) {
    const { publications, authors, taxonomy } = data;
    const bySlug = new Map(publications.map((p) => [p.slug, p]));

    const pubs = data.collections.all
      .filter((item) => item.url && item.data.searchIndex !== false)
      .map((item) => {
        const pub = bySlug.get(item.fileSlug);
        return {
          url: item.url,
          lang: item.data.lang,
          slug: item.fileSlug,
          // h1 отрендерен на языке прохода и без суффикса; фронтматтер — фолбэк
          title:
            extractH1(item.templateContent) ||
            stripSuffix(
              item.data.lang === "en" && item.data.titleEn
                ? item.data.titleEn
                : item.data.title
            ),
          // У заглушки текст — только нота «гайд переносится», по ней искать нечего
          text:
            pub?.status === "stub" ? "" : clean(stripMeta(item.templateContent)),
          date: pub?.date || null,
          markets: pub?.markets || [],
          teams: pub?.teams || []
        };
      });

    // Авторы с публикациями и число публикаций — та же логика, что у фильтра people
    const counts = new Map();
    for (const p of publications)
      for (const slug of p.authors || []) counts.set(slug, (counts.get(slug) || 0) + 1);
    const people = [...counts]
      .map(([slug, count]) => ({ slug, name: authors[slug]?.name || slug, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));

    const tags = [];
    for (const [dim, field] of DIMS)
      for (const t of taxonomy[field]) {
        const count = publications.filter((p) => (p[field] || []).includes(t.slug)).length;
        if (count) tags.push({ dim, slug: t.slug, ru: t.ru, en: t.en, count });
      }

    return JSON.stringify({ pubs, people, tags, aliases: data.aliases });
  }
};
