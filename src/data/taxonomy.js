// Справочник тегов публикаций. Порядок в массивах = порядок групп в таблице
// на главной (группировка по рынкам, командам, подборкам).
// Английские имена переведены вручную. Правится руками.
export default {
  markets: [
    { slug: "russia", ru: "Россия", en: "Russia" },
    { slug: "eurasia", ru: "Евразия", en: "Eurasia" },
    { slug: "uae", ru: "ОАЭ", en: "UAE" }
  ],

  // Плейсхолдеры: реальных данных о командах нет, публикации разложены
  // эвристикой по предметным областям (см. tools/import-csv.mjs).
  teams: [
    { slug: "brand-design", ru: "Бренд-дизайн", en: "Brand design" },
    { slug: "digital", ru: "Диджитал", en: "Digital" },
    { slug: "social-media", ru: "Соцсети", en: "Social media" },
    { slug: "photo-video", ru: "Фото и видео", en: "Photo & video" }
  ],

  areas: [
    { slug: "graphic-design", ru: "Графический дизайн", en: "Graphic design" },
    { slug: "work-with-files", ru: "Работа с файлами", en: "Working with files" },
    { slug: "smm", ru: "СММ", en: "SMM" },
    { slug: "photoshoot", ru: "Фотосъемка", en: "Photography" },
    { slug: "channels-and-media", ru: "Каналы и носители", en: "Channels and media" },
    { slug: "kv-packs", ru: "KV паки", en: "KV packs" },
    { slug: "legal-aspects", ru: "Юридические аспекты", en: "Legal aspects" },
    { slug: "texts", ru: "Тексты", en: "Texts" },
    { slug: "infoplanning", ru: "Инфопланирование", en: "Infoplanning" },
    { slug: "meme-park", ru: "Meme park", en: "Meme park" },
    { slug: "retouching", ru: "Ретушь", en: "Retouching" },
    { slug: "automation", ru: "Автоматизация", en: "Automation" },
    { slug: "design-team-management", ru: "Менеджмент в дизайн-команде", en: "Design team management" },
    { slug: "producing", ru: "Продюсирование", en: "Producing" },
    { slug: "motion-design", ru: "Моушен-дизайн", en: "Motion design" },
    { slug: "creative-techniques", ru: "Креативные техники", en: "Creative techniques" }
  ],

  collections: [
    { slug: "keyvisual", ru: "Кейвижуал", en: "Key visual" },
    { slug: "design-hygiene", ru: "Дизайн-гигиена", en: "Design hygiene" },
    { slug: "hq-layouts-adaptation", ru: "Адаптация макетов от УК", en: "Adapting HQ layouts" },
    { slug: "social-media-launch", ru: "Запуск соцсетей в новой стране", en: "Launching social media in a new country" },
    { slug: "in-app-stories", ru: "Сторис в приложении", en: "In-app stories" },
    { slug: "digital-ad-layouts", ru: "Макеты для диджитал рекламы", en: "Digital ad layouts" },
    { slug: "dodo-design-basics", ru: "Основы дизайна в контексте Додо", en: "Design basics in the Dodo context" },
    { slug: "editorial-policy-archive", ru: "Редполитика (архив)", en: "Editorial policy (archive)" },
    { slug: "catalog-pizza-shoot", ru: "Каталожная съемка пиццы", en: "Catalog pizza photoshoot" },
    { slug: "dodo-pizzas-brand-identity", ru: "Айдентика Додо Пиццы", en: "Dodo Pizza brand identity" },
    { slug: "package", ru: "Упаковка", en: "Packaging" },
    { slug: "menu", ru: "Меню", en: "Menu" },
    { slug: "video", ru: "Видеоролик", en: "Video" }
  ]
};
