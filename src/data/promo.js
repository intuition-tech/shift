// Промоблоки на главной: сетка цветных плашек-подборок (+ рынок MENA).
// Массив колонок, в колонке — блоки сверху вниз. kind: "collection" | "market",
// slug — из taxonomy.js (заголовок берётся оттуда, если нет title здесь),
// size XS…XL и color — модификаторы плашки (components/promo-grid.css).
// Число публикаций считается на сборке из publications.js.
// Описания — со старой главной (digest-data.pug), правятся руками.
export default [
  [
    {
      kind: "collection", slug: "dodo-design-basics", size: "M", color: "orange",
      description: {
        ru: "Базовые принципы графического дизайна в контексте Додо: цвет, композиция, типографика, иерархия в макетах. Теория и кейсы.",
        en: "Basic principles of graphic design in the context of Dodo: colour, composition, typography, hierarchy in layouts. Theory and examples."
      }
    },
    {
      kind: "collection", slug: "catalog-pizza-shoot", size: "XL", color: "yellow",
      description: {
        ru: "Разбираем особенности каталожных съемок. Инструкции по приготовлению пиццы, проведению фотосессий и ретушированию фотографий.",
        en: "Breaking down the specifics of catalog shoots. Tips on preparing pizza, conducting photo shoots and retouching photos."
      }
    },
    {
      kind: "collection", slug: "social-media-launch", size: "S", color: "dark",
      description: {
        ru: "Важное о запуске соцсетей: создание нового аккаунта, тон оф войс, визуальный стиль, темы для публикаций, инструменты вовлечения.",
        en: "Essential things about launching brand’s social media pages: creating a new account, tone of voice, visual style, posts topics, engagement tools."
      }
    },
    {
      kind: "collection", slug: "menu", size: "S", color: "pink",
      description: {
        ru: "Гайды по подготовке меню для пиццерий: разработка названий и описаний, оформление ТВ-бордов, тиражирование макетов по ценовым группам.",
        en: "Guides on creating menus for pizzerias: how to develop titles and descriptions, design TV boards, replicate layouts by price groups."
      }
    }
  ],
  [
    {
      kind: "collection", slug: "keyvisual", size: "L", color: "dark",
      description: {
        ru: "Процесс создания промокоммуникаций: все этапы от поиска референсов до тиражирования дизайна на разные носители.",
        en: "The process of creating promotional communications: all stages from finding references to replicating design on various media."
      }
    },
    {
      kind: "collection", slug: "in-app-stories", size: "M", color: "green",
      description: {
        ru: "Материалы, которые помогут сделать сторис для приложения Додо: структура, редполитика, визуальный стиль и примеры.",
        en: "Materials to help make and upload stories onto Dodoapp: structure, editorial policy, visual style and examples."
      }
    },
    {
      kind: "collection", slug: "video", size: "XS", color: "pink",
      description: {
        ru: "Этапы работы над роликом: продюсирование, пред- и постпродакшн, проведение съемок.",
        en: "Stages of clip making: production, pre- and post-production, filming."
      }
    },
    {
      kind: "collection", slug: "editorial-policy-archive", size: "XS", color: "gray",
      description: {
        ru: "Серия гайдов по редполитике: тональность, правила обращения к читателям, требования к оформлению сообщений для внешних коммуникаций.",
        en: "A series of guides on editorial policy: tone, rules for addressing readers, and message design requirements for external communications."
      }
    }
  ],
  [
    {
      kind: "collection", slug: "design-hygiene", size: "XL", color: "pink",
      description: {
        ru: "Поддерживаем порядок в проектах. В подборке о том, как правильно сохранить, назвать и передать макет партнерам или команде.",
        en: "Keeping projects in order. Here you’ll find tips on how to properly save, name and hand the layout to partners or the team."
      }
    },
    {
      kind: "collection", slug: "package", size: "S", color: "gray",
      description: {
        ru: "Всё о создании упаковки: процессы и роли в команде, этапы работы над разными видами упаковки, особенности дизайна.",
        en: "Everything about creating packaging: processes and roles in the team, stages of work on different types of packaging, design specifics."
      }
    },
    {
      kind: "collection", slug: "digital-ad-layouts", size: "S", color: "yellow",
      description: {
        ru: "Принципы создания диджитал-макетов: удачные и неудачные примеры, правила изображения людей и продуктов, технические требования.",
        en: "Principles of creating digital layouts: successful examples and fails, rules for displaying people and products, technical requirements."
      }
    },
    {
      kind: "collection", slug: "hq-layouts-adaptation", size: "M", color: "green",
      description: {
        ru: "Инструкции для партнеров по локальной адаптации макетов. Помогут отредактировать и сохранить макеты для печати.",
        en: "Instructions for partners on how to customize layouts locally. The guide helps to edit and save layouts for printing."
      }
    },
    {
      kind: "market", slug: "uae", size: "S", color: "orange",
      title: { ru: "Додо Пицца MENA", en: "Dodo Pizza MENA" },
      description: {
        ru: "Материалы для креативных команд сети Додо Пицца в ОАЭ.",
        en: "Materials for the creative teams of the Dodo Pizza network in UAE."
      }
    }
  ]
];
