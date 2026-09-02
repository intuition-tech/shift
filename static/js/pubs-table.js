/* Фильтрация и группировка таблицы публикаций на главной (.ids__pubs).
   Состояние целиком в URL: ?group=markets|teams|collections, ?author=…, ?market=…,
   ?team=…, ?area=…, ?collection=…, ?new=1 — параметры комбинируются.
   Сервер рендерит все строки по дате (новое сверху); скрипт перекладывает их
   в tbody, при группировке вставляет строки-подзаголовки (публикация с несколькими
   тегами повторяется в каждой своей группе). Локализованные имена — в JSON-острове
   #pubs-taxonomy, язык знает только шаблон. Активный пункт меню в хедере
   подсвечивается по ?group. */

(() => {
  const pubs = document.querySelector(".ids__pubs");
  const island = document.getElementById("pubs-taxonomy");
  if (!pubs || !island) return;

  const tbody = pubs.querySelector("tbody");
  const toolbar = pubs.querySelector(".ids__pubs--toolbar");
  const taxonomy = JSON.parse(island.textContent);
  const allRows = Array.from(tbody.rows);

  // измерение фильтра → имя data-атрибута строки
  const DIMS = {
    author: "authors",
    market: "markets",
    team: "teams",
    area: "areas",
    collection: "collections"
  };

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
        th.colSpan = 3;
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

    renderChips(state);
    highlightNav(state);
  }

  // Чип на каждый активный фильтр: «Рынок: Россия ×», × сбрасывает этот фильтр
  function renderChips(state) {
    toolbar.textContent = "";
    const dims = Object.keys(state.filters);
    toolbar.hidden = !dims.length;
    for (const dim of dims) {
      const chip = document.createElement("span");
      chip.className = "ids__pubs--chip";
      chip.append(
        dim === "new"
          ? taxonomy.dims.new
          : taxonomy.dims[dim] + ": " + (taxonomy.names[dim][state.filters[dim]] || state.filters[dim])
      );
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "ids__pubs--chip-reset";
      reset.textContent = "×";
      reset.addEventListener("click", () => {
        delete state.filters[dim];
        writeState(state);
        render(state);
      });
      chip.append(reset);
      toolbar.append(chip);
    }
  }

  function highlightNav(state) {
    for (const link of document.querySelectorAll("header [data-nav-group]")) {
      link.classList.toggle("active", (link.dataset.navGroup || null) === state.group);
    }
  }

  let state = readState();
  render(state);
  window.addEventListener("popstate", () => {
    state = readState();
    render(state);
  });
})();
