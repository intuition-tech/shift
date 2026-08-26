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
eleventy.config.js   # конфиг Eleventy (ESM)
src/pages/           # страницы: .html с фронтматтером + Nunjucks
src/pages/pages.11tydata.js  # двуязычная генерация: каждая страница собирается в / и /en
src/includes/        # layout.html, footer.html
src/styles/site.css  # стили сайта поверх IDS → /assets/site.css
src/scripts/main.js  # кука переключателя языка → /assets/main.js
static/              # копируется в корень сайта как есть
site/                # результат сборки (в гитигноре)
```

## Дизайн-система IDS

В `static/css`, `static/js`, `static/fonts` лежит копия [IDS](https://github.com/intuition-tech/ids) (снепшот от 2026-08-26, версия 1.0), **перестиленная под дизайн старого сайта Shift** (shift.dodobrands.io): шрифты Pragmatica + Elma Trio, цвета и кегли старого сайта, флюидная рампа 13→23 px (desktop) / 17→26 px (mobile). По философии IDS система не подключается как зависимость, а копируется и правится в проекте.

Что изменено и добавлено относительно ванильной IDS:

- `tokens/colors.css` — семантические цвета заданы прямыми значениями старого сайта;
- `tokens/shift.css` — брендовые токены (`--shift__dodo-orange`, `--shift__gray-caption`, `--shift__aside-background`, `--shift__shadow-color`, `--shift__description-font`);
- `settings.css` — @font-face старых шрифтов и рампа со старыми числами;
- `components/ids.css` — типографика по старым кеглям (h1 3.23em/650, h2 2.5em/570, `h2.h3`, `h2.special`, списки, таблицы, `aside`, `figcaption`, `.lead`, `.ids__description`, `.ids__table-wrapper`);
- новые локальные компоненты: `components/media.css` (`.ids__media`, `.ids__media-group`), `components/no-yes.css` (`.ids__no-yes`, `.ids__billet`), `components/video.css` (`.ids__video`), `components/style-guide.css` (витрина);
- `components/navbar.css` — `ids-navbar` перестилен под оглавление публикации (sticky слева, скрыт < 768px);
- стрелки «НЕТ/ДА» — `static/images/no-yes/`.

Внимание: нативный CSS-нестинг не умеет Sass-конкатенацию `&--mod` — модификаторы с длинными суффиксами пишутся полными селекторами (см. `no-yes.css`).

Порядок подключения CSS в `src/includes/layout.html` нормативный: tokens → settings → reset → page-composition → components.

Темы: используется только светлая, переключателя темы нет (`theme-toggle.css/js` лежат в `static/`, но не подключены). Позже отдельные публикации будут собираться в тёмной теме через класс `.dark` (см. `static/css/tokens/colors.css`).

Демо-скрипты `gen-cover-demo.js` и `sleepy.js` тоже не подключены.

## Публикации

Каждый гайд — один файл `src/pages/<slug>.html` с фронтматтером (`title`/`titleEn`, `description`/`descriptionEn`, `tags: guide`) и инлайновым переключением языка `{% if lang == 'ru' %}…{% else %}…{% endif %}`. URL плоские: `/<slug>/` и `/en/<slug>/`. Разделы оборачиваются в `<ids-nav-item id="слаг" label="…">` — из них строится оглавление. Картинки — в `static/images/<slug>/`. Главная — неоформленный список по коллекции `guide`.

Контент переносится со старого сайта `/Users/arutyunov/dbdt` (Pug, миксины `+ru`/`+en`). Список публикаций и их статусы — CSV «Shift — All Guides». Перенесено 5 из 35 актуальных гайдов.

## Витрина /style

`/style/` — перечень компонентов и токенов (по образцу ponedelnik.ru/style): токены дампятся из живого CSS скриптом `static/js/tokens-dump.js` (слоты `data-tokens-prefix` / `data-tokens-render`), компоненты показаны живыми образцами. В навигацию не выводится, доступна по прямой ссылке.

## Двуязычность

Каждая страница в `src/pages` собирается дважды через pagination по `locales` (`pages.11tydata.js`): русская в корень, английская с префиксом `/en`. Внутри шаблона язык переключается инлайново: `{% if lang == 'ru' %} … {% endif %}`. Переключатель в футере ведёт на парную страницу (`otherLangUrl`) и запоминает выбор в куке `_int_locale`.

## Деплой

GitHub Pages: пуш в `main` запускает `.github/workflows/deploy.yml` — сборка Eleventy и публикация `site/` через `actions/deploy-pages`. В настройках репозитория Pages должен быть в режиме «GitHub Actions».
