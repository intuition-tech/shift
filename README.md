# Shift

Двуязычный статический сайт на [Eleventy 3](https://www.11ty.dev). Русская версия в корне, английская — под `/en`.

## Запуск

```
npm install
npm run dev     # http://localhost:8080
npm run build   # сборка в site/
```

## Структура

```
eleventy.config.js   # конфиг Eleventy (ESM): фильтры pub, tagName, formatDate…
src/pages/           # страницы: .html с фронтматтером + Nunjucks
src/pages/pages.11tydata.js  # двуязычная генерация: каждая страница собирается в / и /en
src/data/            # данные: publications.js (мастер), authors.js, taxonomy.js, promo.js
src/includes/        # layout.html, header.html, footer.html, pub-meta.html, stub-note.html
src/styles/site.css  # стили сайта поверх IDS → /assets/site.css
src/scripts/main.js  # кука переключателя языка → /assets/main.js
static/              # копируется в корень сайта как есть
site/                # результат сборки (в гитигноре)
```

## Дизайн-система IDS

В `static/css`, `static/js`, `static/fonts` лежит копия [IDS](https://github.com/intuition-tech/ids) (снепшот от 2026-08-26, версия 1.0), **перестиленная под дизайн старого сайта Shift** (shift.dodobrands.io): шрифты Pragmatica + Elma Trio, цвета и кегли старого сайта, флюидная рампа 13→23 px (desktop) / 17→26 px (mobile). По философии IDS система не подключается как зависимость, а копируется и правится в проекте.

Что изменено и добавлено относительно ванильной IDS:

- `tokens/palette.css` — базовый слой: статичные значения цвета старого сайта, названные по оттенку и весу (`--ids__color-navy-900`, `--ids__color-orange-500`…); в компонентах напрямую не используются;
- `tokens/colors.css` — семантические цвета IDS, только ссылки на палитру;
- `tokens/shift.css` — семантические токены, специфичные для Shift (`--shift__dodo-orange`, `--shift__gray-caption`, `--shift__aside-background`, `--shift__shadow-color`, `--shift__billet-under`, `--shift__description-font`) — тот же слой, что colors.css;
- `settings.css` — @font-face старых шрифтов и рампа со старыми числами;
- `components/ids.css` — типографика по старым кеглям (h1 3.23em/650, h2 2.5em/570, `h2.h3`, `h2.special`, списки, таблицы, `aside`, `figcaption`, `.lead`, `.ids__description`, `.ids__table-wrapper`);
- новые локальные компоненты: `components/media.css` (`.ids__media`, `.ids__media-group`), `components/no-yes.css` (`.ids__no-yes`, `.ids__billet`), `components/note.css` (`.ids__with-note`, `.ids__note` — сноска на полях), `components/video.css` (`.ids__video`, iframe или `<video>`), `components/report.css` (`.ids__report-header`, `.ids__portraits` — отчёты Meme Park), `components/color-palette.css` (`.ids__color-palette`, `.ids__copy`, `.ids__icon-set` — копирование цвета/SVG, JS в `js/copy.js`), `components/checklist.css` (`.ids__checklist`), `components/slide.css` (`.ids__slide`, `.ids__slide-pair`), `components/download.css` (`.ids__download`, JS в `js/download.js`), `components/compare.css` (`.ids__compare`, JS в `js/compare.js`), `components/style-guide.css` (витрина); модификаторы `.ids__sequence` — `.no-wrap`, `.tight`, `.labels` в `page-composition/layout.css`; `gallery.css` — превью 8em как в старых отчётах;
- `components/navbar.css` — `ids-navbar` перестилен под оглавление публикации (sticky слева, скрыт < 768px);
- стрелки «НЕТ/ДА» — `static/images/no-yes/`.

Внимание: нативный CSS-нестинг не умеет Sass-конкатенацию `&--mod` — модификаторы с длинными суффиксами пишутся полными селекторами (см. `no-yes.css`).

Порядок подключения CSS в `src/includes/layout.html` нормативный: tokens → settings → reset → page-composition → components.

Темы: используется только светлая, переключателя темы нет (`theme-toggle.css/js` лежат в `static/`, но не подключены). Позже отдельные публикации будут собираться в тёмной теме через класс `.dark` (см. `static/css/tokens/colors.css`).

Демо-скрипты `gen-cover-demo.js` и `sleepy.js` тоже не подключены.

## Вёрстка публикаций

Структура публикации, компоненты, работа с картинками, правила переноса со старого сайта и грабли — в [docs/content-markup.md](docs/content-markup.md). Инструменты в [tools/](tools/): `measure-images.mjs` меряет фактическую ширину отрисовки картинок, `optimize-images.py` ужимает их и переводит GIF в mp4.

## Публикации

Каждый гайд — один файл `src/pages/<slug>.html` с фронтматтером (`title`/`titleEn`, `description`/`descriptionEn`, `tags: guide`) и инлайновым переключением языка `{% if lang == 'ru' %}…{% else %}…{% endif %}`. URL плоские: `/<slug>/` и `/en/<slug>/`. Разделы оборачиваются в `<ids-nav-item id="слаг" label="…">` — из них строится оглавление. Картинки — в `static/images/<slug>/`, оптимизированные (WebP, анимации — mp4; см. [docs/content-markup.md](docs/content-markup.md)).

### Данные публикаций

Мастер-данные всех публикаций — `src/data/publications.js`: слаг, заголовки, дата, авторы (контактное лицо — флагом `contact`, обязан входить в `authors`), теги (рынки, команды, предметные области, подборки — слаги из `src/data/taxonomy.js`), ручной флаг «новое» `isNew`, статус `published | stub | external`. Справочник авторов — `src/data/authors.js` (имена английские, фото в `static/images/authors/`). Порядок тегов в `taxonomy.js` = порядок групп в таблице. Данные правятся руками; заголовки страниц дублируются во фронтматтере (он остаётся для `<title>`/OG), слаг связывает.

Данные были сгенерированы одноразовыми скриптами: `tools/import-csv.mjs` (из CSV «Shift — All Guides»; даты — из последних коммитов гайдов в dbdt) и `tools/make-stubs.mjs` (страницы-заглушки для неперенесённых гайдов — реальный URL, h1, мета-блок, ссылка на старый адрес; перенос гайда = перезаписать файл и сменить `status`). Команды в данных — плейсхолдеры, разложены эвристикой по областям.

### Главная и /publications/

Главная — не то же, что «Все публикации»: сначала новые публикации (`isNew` — болдом), затем сетка промоблоков (подборки + рынок MENA; конфиг с колонками, цветами и описаниями — `src/data/promo.js`, счётчики считаются на сборке), затем остальная таблица. Фильтров на главной нет.

Полная таблица живёт на `/publications/`: все публикации по дате, фильтрация (автор, рынок, команда, область, подборка, новизна) и группировка (рынки, команды, подборки — ссылки в хедере) — `static/js/pubs-table.js`; состояние целиком в URL (`/publications/?market=russia`, `/publications/?group=teams&area=smm`), над таблицей — чип активного фильтра со сбросом. Контролов фильтрации нет: фильтр включается тегами на страницах публикаций (мета-блок `pub-meta.html` под h1) и ссылками. Активный пункт хедера — болдом (ставит `pubs-table.js`). Компоненты — `components/pubs.css`, `components/pub-meta.css`, `components/promo-grid.css`, образцы на `/design-system/`.

Контент переносится со старого сайта `/Users/arutyunov/dbdt` (Pug, миксины `+ru`/`+en`). Список публикаций и их статусы — CSV «Shift — All Guides». Перенесены 33 из 35 актуальных гайдов.

Не перенесены:

- «Визуальный стиль Додо Пиццы» (`/graphic-design/brandbook-dodo-pizza` → исходник `graphic-design/visual-style-dodo-pizza.pug`, 2117 строк и 185 МБ картинок) — отложен, пока заглушка `/visual-style-dodo-pizza/`;
- гайды в статусе «Обновить» — у них страницы-заглушки со ссылкой на старый адрес (`status: "stub"` в `publications.js`);
- «Процессы и инструменты команды Stories In App» и «Перед началом работы» — внешние ссылки на buildin.ai, отдельных страниц сайта нет, в таблице открываются в новой вкладке.

## Дизайн-система /design-system

`/design-system/` — витрина (по образцу ponedelnik.ru/style): палитра и семантические токены дампятся из живого CSS скриптом `static/js/tokens-dump.js` (слоты `data-tokens-prefix` / `data-tokens-render`); типографика — таблицей «элемент / образец / токены»; компоненты — блоками «табличка название+токены → образец на всю ширину → спейсер». Новые компоненты сразу добавляются сюда. В навигацию не выводится, доступна по прямой ссылке.

## Двуязычность

Каждая страница в `src/pages` собирается дважды через pagination по `locales` (`pages.11tydata.js`): русская в корень, английская с префиксом `/en`. Внутри шаблона язык переключается инлайново: `{% if lang == 'ru' %} … {% endif %}`. Переключатель в футере ведёт на парную страницу (`otherLangUrl`) и запоминает выбор в куке `_int_locale`.

## Деплой

GitHub Pages: пуш в `main` запускает `.github/workflows/deploy.yml` — сборка Eleventy и публикация `site/` через `actions/deploy-pages`. В настройках репозитория Pages должен быть в режиме «GitHub Actions».
