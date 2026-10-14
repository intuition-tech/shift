/* Таблица публикаций (.ids__pubs) — три слоя поведения. Скрипт подключается
   в самой странице сразу после таблицы (не в лейауте в конце body): пины
   отрисовываются до того, как браузер покажет остальную страницу, без мигания.
   1. Строка-ссылка: клик в любое место строки (мимо пилюль и булавки) ведёт
      на data-href. Делается скриптом, а не оверлеем-псевдоэлементом: Safari
      не делает tr containing block, и оверлеи всех строк ложились на всю таблицу.
   2. Пины: личные закладки читателя в localStorage («shift:pins»). Закреплённые
      публикации собираются в группу «Всегда под рукой» наверху каждой таблицы —
      копиями строк; исходная строка остаётся на месте, чтобы состояние менялось
      там, куда смотрит читатель, и отпинить было так же легко. На главной группа
      живёт в той же таблице перед «Новым»; на /publications/ (data-pins="separate")
      пины — отдельной табличкой со спейсером, а у основной таблицы без
      группировки появляется заголовок «Всё-всё-всё».
   3. Фильтрация и группировка на /publications/: состояние целиком в URL
      (?group=markets|teams|collections, ?author=…, ?market=…, ?team=…, ?area=…,
      ?collection=…, ?new=1). Сервер рендерит все строки по дате; скрипт
      перекладывает их в tbody, при группировке вставляет строки-подзаголовки.
      Теги-фильтры под h1 (рынки и команды) — ссылки из шаблона, скрипт
      перехватывает клик и подсвечивает активный. Локализованные имена —
      в JSON-острове #pubs-taxonomy, язык знает только шаблон. */

(() => {
  const tables = Array.from(document.querySelectorAll(".ids__pubs"));
  if (!tables.length) return;

  const lang = document.documentElement.lang === "en" ? "en" : "ru";
  const T = lang === "en"
    ? { pinned: "Always at hand", rest: "All of it", livePinned: "Pinned", liveUnpinned: "Unpinned", clear: "Clear filter" }
    : { pinned: "Всегда под рукой", rest: "Всё-всё-всё", livePinned: "Закреплено", liveUnpinned: "Снято с закрепления", clear: "Снять фильтр" };
  const COLUMNS = 4;
  // Крестик сброса — SVG, а не символ: его можно точно поставить по заглавным (pubs.css)
  const RESET_SVG = '<svg class="ids__pubs--tag-reset" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8"/></svg>';

  // Исходные строки каждой таблицы по слагу — источник для копий в «Всегда под рукой»
  // (фильтр может убрать строку из DOM, копия всё равно нужна). Таблица, в которой
  // не все публикации (главная), несёт полный список в <template data-pubs-all>
  const sources = new Map();
  for (const pubs of tables) {
    const map = new Map();
    const all = pubs.querySelector("template[data-pubs-all]");
    // (строки без слага — служебные, например «Все публикации» на главной)
    if (all) for (const row of all.content.querySelectorAll(".ids__pubs--row[data-slug]")) map.set(row.dataset.slug, row);
    for (const row of pubs.querySelectorAll("tbody .ids__pubs--row[data-slug]")) map.set(row.dataset.slug, row);
    sources.set(pubs, map);
  }

  const rowTitle = (row) => {
    const a = row.querySelector(".ids__pubs--title a");
    return a ? a.textContent.trim() : "";
  };

  /* ---------- 1. Строка-ссылка ---------- */

  function openRow(row, newTab) {
    const href = row.dataset.href;
    if (!href) return;
    const external = row.querySelector('.ids__pubs--title a[target="_blank"]');
    if (newTab || external) window.open(href, "_blank", "noopener");
    else location.href = href;
  }

  // Ячейка булавки целиком — зона пина, не строки
  const NOT_ROW = "a, button, .ids__pubs--pin-cell";

  document.addEventListener("click", (e) => {
    const row = e.target.closest(".ids__pubs--row");
    if (!row || e.target.closest(NOT_ROW)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // читатель выделяет текст
    openRow(row, e.metaKey || e.ctrlKey || e.shiftKey);
  });

  document.addEventListener("auxclick", (e) => {
    const row = e.target.closest(".ids__pubs--row");
    if (!row || e.button !== 1 || e.target.closest(NOT_ROW)) return;
    e.preventDefault();
    openRow(row, true);
  });

  /* ---------- 2. Пины ---------- */

  const PINS_KEY = "shift:pins";
  const readPins = () => {
    try {
      const list = JSON.parse(localStorage.getItem(PINS_KEY));
      return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
    } catch (e) {
      return [];
    }
  };
  const writePins = (list) => {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(list)); } catch (e) { /* приватный режим */ }
  };
  let pins = readPins();

  const live = document.createElement("div");
  live.className = "ids__pubs--live";
  live.setAttribute("aria-live", "polite");
  document.body.append(live);

  // Отдельная табличка пинов (режим data-pins="separate"): перед основной,
  // со спейсером после; живёт, пока есть пины
  const separate = new Map();
  function pinsTable(pubs, create, animate) {
    let box = separate.get(pubs);
    if (!box && create) {
      box = document.createElement("div");
      box.className = "ids__pubs ids__pubs--pins";
      box.innerHTML = '<div class="ids__pubs--pins-inner"><table><tbody></tbody></table></div>';
      const space = document.createElement("div");
      space.className = "ids__space M ids__pubs--pins-space";
      pubs.before(box, space);
      separate.set(pubs, box);
      // При пине табличка раскрывается по высоте (и спейсер за ней), контент
      // ниже не прыгает; при загрузке страницы — сразу, без анимации
      if (animate) {
        box.classList.add("entering");
        space.classList.add("entering");
        setTimeout(() => { box.classList.remove("entering"); space.classList.remove("entering"); }, 400);
      }
    }
    return box || null;
  }
  function dropPinsTable(pubs) {
    const box = separate.get(pubs);
    if (!box) return;
    box.nextElementSibling.remove();
    box.remove();
    separate.delete(pubs);
  }
  // Схлопывание перед удалением (последний отпин)
  function collapsePinsTable(pubs) {
    const box = separate.get(pubs);
    if (!box) return;
    box.classList.add("leaving");
    box.nextElementSibling.classList.add("leaving");
  }
  // Где искать строки этой таблицы: сама таблица и её табличка пинов
  function scope(pubs) {
    const box = separate.get(pubs);
    return box ? [pubs, box] : [pubs];
  }
  function queryAll(pubs, selector) {
    return scope(pubs).flatMap((el) => Array.from(el.querySelectorAll(selector)));
  }

  function groupRow(text, className) {
    const tr = document.createElement("tr");
    tr.className = "ids__pubs--group " + className;
    const th = document.createElement("th");
    th.colSpan = COLUMNS;
    th.textContent = text;
    tr.append(th);
    return tr;
  }

  // Состояние булавки — у всех строк с этим слагом (оригинал, клоны групп, копия наверху)
  function syncButtons(pubs, slug) {
    const on = pins.includes(slug);
    for (const row of queryAll(pubs, `.ids__pubs--row[data-slug="${slug}"]`)) {
      const btn = row.querySelector(".ids__pubs--pin");
      if (!btn) continue;
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", (on ? btn.dataset.labelUnpin : btn.dataset.labelPin) + ": " + rowTitle(row));
    }
  }

  function syncAll(pubs) {
    for (const slug of sources.get(pubs).keys()) syncButtons(pubs, slug);
  }

  // Группа «Всегда под рукой»: заголовок + копии строк в порядке закрепления
  // (новое сверху) — в начале tbody или в отдельной табличке. Копия только что
  // закреплённой — с анимацией появления
  function renderPinned(pubs, newSlug) {
    const tbody = pubs.querySelector("tbody");
    // Что уже было — чтобы анимировать только новое (строка, заголовок группы,
    // заголовок «Всё-всё-всё»), а не всё перестроенное
    const hadGroup = queryAll(pubs, ".pinned-group").length > 0;
    const hadRest = tbody.querySelector(".pinned-rest") !== null;
    for (const row of queryAll(pubs, ".pinned-group, .pinned-copy, .pinned-rest")) row.remove();
    const map = sources.get(pubs);
    // При фильтре по автору «Всегда под рукой» не показываем (ставит render)
    const slugs = pubs.dataset.pinsHidden ? [] : pins.filter((slug) => map.has(slug));
    const isSeparate = pubs.dataset.pins === "separate";
    if (!slugs.length) {
      if (isSeparate) dropPinsTable(pubs);
      return;
    }

    const head = groupRow(T.pinned, "pinned-group");
    if (newSlug && !hadGroup && !isSeparate) head.classList.add("pinned-new");
    const rows = [head];
    for (const slug of slugs) {
      const copy = map.get(slug).cloneNode(true);
      copy.classList.add("pinned-copy");
      // В отдельной табличке первая строка приезжает вместе с самой табличкой
      if (slug === newSlug && (hadGroup || !isSeparate)) copy.classList.add("pinned-new");
      rows.push(copy);
    }
    if (isSeparate) {
      pinsTable(pubs, true, Boolean(newSlug)).querySelector("tbody").replaceChildren(...rows);
      // У основной таблицы без групп — свой заголовок, чтобы «Всегда под рукой»
      // не читалось как заголовок всего списка
      if (!tbody.querySelector(".ids__pubs--group")) {
        const rest = groupRow(T.rest, "pinned-rest");
        if (newSlug && !hadRest) rest.classList.add("pinned-new");
        tbody.prepend(rest);
      }
    } else {
      tbody.prepend(...rows);
    }
    for (const slug of slugs) syncButtons(pubs, slug);
  }

  function togglePin(btn) {
    const row = btn.closest(".ids__pubs--row");
    const slug = row.dataset.slug;
    const on = !pins.includes(slug);
    pins = on ? [slug, ...pins.filter((s) => s !== slug)] : pins.filter((s) => s !== slug);
    writePins(pins);
    live.textContent = (on ? T.livePinned : T.liveUnpinned) + ": " + rowTitle(row);

    for (const pubs of tables) {
      syncButtons(pubs, slug);
      if (on) {
        renderPinned(pubs, slug);
        continue;
      }
      // Отпин: копия (и заголовок, если она последняя) гаснут, потом перестройка
      const copies = queryAll(pubs, ".pinned-copy");
      const leaving = copies.find((row) => row.dataset.slug === slug);
      if (!leaving) continue;
      leaving.classList.add("pinned-leaving");
      if (copies.length === 1) {
        for (const row of queryAll(pubs, ".pinned-group, .pinned-rest")) row.classList.add("pinned-leaving");
        collapsePinsTable(pubs);
      }
      setTimeout(() => renderPinned(pubs), 300);
    }
  }

  document.addEventListener("click", (e) => {
    const cell = e.target.closest(".ids__pubs--pin-cell");
    const btn = cell && cell.querySelector(".ids__pubs--pin");
    if (!btn) return;
    e.preventDefault();
    togglePin(btn);
  });

  // Пины, поставленные в другой вкладке
  window.addEventListener("storage", (e) => {
    if (e.key !== PINS_KEY) return;
    pins = readPins();
    for (const pubs of tables) { syncAll(pubs); renderPinned(pubs); }
  });

  /* ---------- 3. Фильтры и группировка (/publications/) ---------- */

  const island = document.getElementById("pubs-taxonomy");
  const pubs = tables[0];
  if (!island) {
    for (const t of tables) { syncAll(t); renderPinned(t); }
    return;
  }

  const tbody = pubs.querySelector("tbody");
  const toolbar = pubs.querySelector(".ids__pubs--toolbar");
  const tagsNav = document.querySelector(".ids__pubs--tags");
  const taxonomy = JSON.parse(island.textContent);
  const allRows = Array.from(sources.get(pubs).values());

  // измерение фильтра → имя data-атрибута строки
  const DIMS = {
    author: "authors",
    market: "markets",
    team: "teams",
    area: "areas",
    collection: "collections"
  };
  // измерения, у которых есть теги под h1 — чип в тулбаре им не нужен
  const TAG_DIMS = new Set(Array.from(tagsNav ? tagsNav.querySelectorAll("[data-dim]") : [], (a) => a.dataset.dim));

  function readState() {
    const params = new URLSearchParams(location.search);
    const state = { group: null, filters: {} };
    if (taxonomy.groups[params.get("group")]) state.group = params.get("group");
    for (const dim in DIMS) {
      if (params.get(dim)) state.filters[dim] = params.get(dim);
    }
    if (params.get("new") === "1") state.filters.new = "1";
    return state;
  }

  function writeState(state) {
    const params = new URLSearchParams();
    if (state.group) params.set("group", state.group);
    for (const dim in state.filters) params.set(dim, state.filters[dim]);
    const query = params.toString();
    history.pushState(null, "", query ? "?" + query : location.pathname);
  }

  function rowMatches(row, filters) {
    for (const dim in filters) {
      if (dim === "new") {
        if (row.dataset.new !== "1") return false;
      } else if (!(row.dataset[DIMS[dim]] || "").split(",").includes(filters[dim])) {
        return false;
      }
    }
    return true;
  }

  function render(state) {
    const rows = allRows.filter((row) => rowMatches(row, state.filters));
    tbody.textContent = "";

    if (!state.group) {
      for (const row of rows) tbody.append(row);
    } else {
      const group = taxonomy.groups[state.group];
      const used = new Set();
      const appendGroup = (name, members) => {
        if (!members.length) return;
        const tr = document.createElement("tr");
        tr.className = "ids__pubs--group";
        const th = document.createElement("th");
        th.colSpan = COLUMNS;
        th.textContent = name;
        tr.append(th);
        tbody.append(tr);
        for (const row of members) tbody.append(row.cloneNode(true));
      };
      for (const item of group.items) {
        const members = rows.filter((row) =>
          (row.dataset[state.group] || "").split(",").includes(item.slug)
        );
        for (const row of members) used.add(row);
        appendGroup(item.name, members);
      }
      appendGroup(group.none, rows.filter((row) => !used.has(row)));
    }

    syncAll(pubs);
    if (state.filters.author) pubs.dataset.pinsHidden = "1"; else delete pubs.dataset.pinsHidden;
    renderPinned(pubs);
    renderTags(state);
    renderChips(state);
    highlightNav(state);
  }

  // Теги под h1 — только на «Всех публикациях» без группировки и без фильтра
  // по автору. Активный — с крестиком; клик по активному снимает фильтр,
  // по другому — заменяет (один тег за раз среди рынков и команд)
  function renderTags(state) {
    if (!tagsNav) return;
    tagsNav.hidden = Boolean(state.group || state.filters.author);
    for (const tag of tagsNav.querySelectorAll("[data-dim]")) {
      const on = state.filters[tag.dataset.dim] === tag.dataset.value;
      tag.classList.toggle("active", on);
      tag.setAttribute("aria-pressed", String(on));
      const reset = tag.querySelector(".ids__pubs--tag-reset");
      if (on && !reset) {
        tag.insertAdjacentHTML("beforeend", RESET_SVG);
      } else if (!on && reset) {
        reset.remove();
      }
    }
  }

  if (tagsNav) {
    tagsNav.addEventListener("click", (e) => {
      const tag = e.target.closest("[data-dim]");
      if (!tag) return;
      e.preventDefault();
      const { dim, value } = tag.dataset;
      const on = state.filters[dim] === value;
      for (const d of TAG_DIMS) delete state.filters[d];
      if (!on) state.filters[dim] = value;
      writeState(state);
      render(state);
    });
  }

  // Чип на каждый активный фильтр без своего тега: кнопка-пилюля «Автор: … ×»
  // (у автора — с фото, как в списке людей), клик сбрасывает фильтр
  function renderChips(state) {
    toolbar.textContent = "";
    const dims = Object.keys(state.filters).filter((dim) => !TAG_DIMS.has(dim));
    toolbar.hidden = !dims.length;
    for (const dim of dims) {
      const value = state.filters[dim];
      const name = dim === "new" ? "" : taxonomy.names[dim][value] || value;
      const text = dim === "new" ? taxonomy.dims.new : taxonomy.dims[dim] + ": " + name;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ids__pill ids__pubs--chip";
      chip.setAttribute("aria-label", T.clear + ": " + text);
      if (dim === "author") {
        const photo = taxonomy.photos[value];
        if (photo) {
          const img = document.createElement("img");
          img.className = "ids__pill-photo";
          img.src = photo;
          img.alt = "";
          chip.append(img);
        } else {
          const initial = document.createElement("span");
          initial.className = "ids__pill-photo initial";
          initial.setAttribute("aria-hidden", "true");
          initial.textContent = name.charAt(0);
          chip.append(initial);
        }
      }
      chip.append(text);
      chip.insertAdjacentHTML("beforeend", RESET_SVG);
      chip.addEventListener("click", () => {
        delete state.filters[dim];
        writeState(state);
        render(state);
      });
      toolbar.append(chip);
    }
  }

  function highlightNav(state) {
    for (const link of document.querySelectorAll("header [data-nav-group]")) {
      link.classList.toggle("active", (link.dataset.navGroup || null) === state.group);
    }
    updateHeading(state);
  }

  // h1 повторяет пункт меню: текст берём из хедера — локализацию знает шаблон
  function updateHeading(state) {
    const h1 = document.querySelector(".ids__pubs--h1");
    if (!h1) return;
    if (!h1.dataset.default) h1.dataset.default = h1.textContent;
    let text = h1.dataset.default;
    if (state.group) {
      const link = document.querySelector(`header [data-nav-group="${state.group}"]`);
      if (link) text = (link.querySelector(".nav-label-full") || link).textContent.trim();
    }
    h1.textContent = text;
  }

  let state = readState();
  render(state);
  window.addEventListener("popstate", () => {
    state = readState();
    render(state);
  });
})();
