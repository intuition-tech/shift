export default function (conf) {
  // static/ повторяет корень сайта: css и js дизайн-системы, fonts, favicon
  conf.addPassthroughCopy({ static: "/" });

  // Дев-режим (--serve/--watch): в продовой сборке isDev = false.
  // Функция — чтобы ELEVENTY_RUN_MODE читался в момент сборки данных
  conf.addGlobalData("isDev", () => process.env.ELEVENTY_RUN_MODE !== "build");

  // Публикация по слагу страницы — для мета-блока pub-meta.html
  conf.addFilter("pub", (publications, slug) =>
    publications.find((p) => p.slug === slug)
  );

  // Все публикации по дате, новое сверху; без даты (внешние) — в конец
  conf.addFilter("byDateDesc", (publications) =>
    [...publications].sort((a, b) => {
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
      (kind === "market" ? p.markets : p.collections).includes(slug)
    ).length
  );

  // Люди — для блока «Люди» (people.html): авторы, у которых есть публикации,
  // с числом публикаций, по алфавиту. Справочник authors.js шире — в нём
  // есть и люди без публикаций, их не выводим
  conf.addFilter("people", (publications, authors) => {
    const counts = new Map();
    for (const p of publications) {
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
