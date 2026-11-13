// Каждая страница собирается дважды из одного файла:
// RU в корень (/slug/), EN с префиксом (/en/slug/).
export default {
  layout: "layout.html",
  locales: ["ru", "en"],
  pagination: {
    data: "locales",
    size: 1,
    alias: "lang",
    // Без этого в коллекции попадает только первый (ru) проход,
    // а поисковому индексу нужны обе языковые версии страниц
    addAllPagesToCollections: true
  },
  eleventyComputed: {
    permalink(data) {
      const stem = data.page.filePathStem; // "/index", "/sms"
      const prefix = data.lang === "en" ? "/en" : "";
      // Одиночные файлы вне двуязычной схемы: 404.html отдаёт nginx на любой
      // язык (текст переключается скриптом по пути), sitemap.xml один на сайт.
      // У них во фронтматтере locales: [ru] — один проход (permalink: false
      // для en-прохода гасил бы оба файла: у страниц пагинации общий флаг записи)
      if (stem === "/404") return "/404.html";
      if (stem === "/sitemap") return "/sitemap.xml";
      return stem === "/index"
        ? `${prefix}/index.html`
        : `${prefix}${stem}/index.html`;
    },
    // Канонический URL страницы
    canonical(data) {
      const stem = data.page.filePathStem;
      if (stem === "/404" || stem === "/sitemap") return null; // служебные, без canonical/hreflang
      const path = stem === "/index" ? "/" : `${stem}/`;
      return data.lang === "en" ? `/en${path === "/" ? "/" : path}` : path;
    },
    // URL этой же страницы на другом языке — для переключателя в хедере
    otherLangUrl(data) {
      const stem = data.page.filePathStem;
      const path = stem === "/index" ? "/" : `${stem}/`;
      return data.lang === "en" ? path : `/en${path === "/" ? "/" : path}`;
    }
  }
};
