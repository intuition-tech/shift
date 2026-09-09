// Генератор поискового индекса: /search-index.json.
// Обходит все страницы обоих языков и складывает их чистый текст
// в один общий JSON — поиск с любой страницы находит и русские,
// и английские страницы. На клиенте по нему работает js/search.js.
// Портировано с arutyunov.info (там поиск обкатывался как прототип).

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

function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? clean(m[1]) : "";
}

// Заголовки фронтматтера — с суффиксом « — Shift» для <title>/OG
function stripSuffix(title) {
  return title ? title.replace(/\s+—\s+Shift$/, "") : "";
}

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
    const entries = data.collections.all
      .filter((item) => item.url && item.data.searchIndex !== false)
      .map((item) => ({
        url: item.url,
        lang: item.data.lang,
        // h1 отрендерен на языке прохода и без суффикса; фронтматтер — фолбэк
        title:
          extractH1(item.templateContent) ||
          stripSuffix(
            item.data.lang === "en" && item.data.titleEn
              ? item.data.titleEn
              : item.data.title
          ),
        text: clean(item.templateContent)
      }));
    return JSON.stringify(entries);
  }
};
