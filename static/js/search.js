// Поиск по сайту. Движок (нормализация, стеммеры, матчинг, сниппеты)
// не трогает DOM и портирован как есть с arutyunov.info, где обкатывался
// как прототип. Индекс общий для обоих языков (поиск с английской страницы
// находит русские страницы и наоборот): /search-index.json и
// /en/search-index.json — одинаковые файлы, собираются шаблоном
// src/pages/search-index.11ty.js.
// UI поддерживает несколько полей на странице (шапка + образцы
// на /design-system/) — индекс грузится один раз на всех.
(() => {
  const roots = document.querySelectorAll(".search");
  if (!roots.length) return;

  // ---------- Движок ----------

  const normalizeWord = (w) => w.toLowerCase().replace(/ё/g, "е");

  // Токены с офсетами в оригинальный текст — по ним строятся сниппеты.
  const tokenize = (text) => {
    const tokens = [];
    const re = /[A-Za-zА-Яа-яЁё0-9]+/g;
    let m;
    while ((m = re.exec(text))) {
      tokens.push({
        word: m[0],
        norm: normalizeWord(m[0]),
        start: m.index,
        end: m.index + m[0].length
      });
    }
    return tokens;
  };

  // Стеммер Портера для английского (Porter, 1980).
  const stemEn = (() => {
    const step2 = {
      ational: "ate", tional: "tion", enci: "ence", anci: "ance",
      izer: "ize", bli: "ble", alli: "al", entli: "ent", eli: "e",
      ousli: "ous", ization: "ize", ation: "ate", ator: "ate",
      alism: "al", iveness: "ive", fulness: "ful", ousness: "ous",
      aliti: "al", iviti: "ive", biliti: "ble", logi: "log"
    };
    const step3 = {
      icate: "ic", ative: "", alize: "al", iciti: "ic",
      ical: "ic", ful: "", ness: ""
    };
    const c = "[^aeiou]";
    const v = "[aeiouy]";
    const C = c + "[^aeiouy]*";
    const V = v + "[aeiou]*";
    const mgr0 = new RegExp("^(" + C + ")?" + V + C); // мера m > 0
    const meq1 = new RegExp("^(" + C + ")?" + V + C + "(" + V + ")?$"); // m = 1
    const mgr1 = new RegExp("^(" + C + ")?" + V + C + V + C); // m > 1
    const hasVowel = new RegExp("^(" + C + ")?" + v);

    return (word) => {
      if (word.length < 3) return word;
      let w = word;
      if (w[0] === "y") w = "Y" + w.slice(1);

      // Шаг 1a: множественное число
      if (/(sses|ies)$/.test(w)) w = w.replace(/(sses|ies)$/, (s) => (s === "sses" ? "ss" : "i"));
      else if (/[^s]s$/.test(w)) w = w.slice(0, -1);

      // Шаг 1b: -eed, -ed, -ing
      let m = /^(.+?)eed$/.exec(w);
      if (m) {
        if (mgr0.test(m[1])) w = w.slice(0, -1);
      } else {
        m = /^(.+?)(ed|ing)$/.exec(w);
        if (m && hasVowel.test(m[1])) {
          w = m[1];
          if (/(at|bl|iz)$/.test(w)) w += "e";
          else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
          else if (new RegExp("^" + C + v + "[^aeiouwxy]$").test(w)) w += "e";
        }
      }

      // Шаг 1c: y → i
      m = /^(.+)y$/.exec(w);
      if (m && hasVowel.test(m[1])) w = m[1] + "i";

      // Шаги 2 и 3: замены суффиксов при m > 0
      for (const table of [step2, step3]) {
        for (const suf in table) {
          if (w.endsWith(suf)) {
            const stem = w.slice(0, -suf.length);
            if (mgr0.test(stem)) w = stem + table[suf];
            break;
          }
        }
      }

      // Шаг 4: отбрасывание длинных суффиксов при m > 1
      m = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/.exec(w);
      if (m) {
        if (mgr1.test(m[1])) w = m[1];
      } else {
        m = /^(.+?)(s|t)(ion)$/.exec(w);
        if (m && mgr1.test(m[1] + m[2])) w = m[1] + m[2];
      }

      // Шаг 5a: конечная e
      m = /^(.+?)e$/.exec(w);
      if (m) {
        const stem = m[1];
        if (
          mgr1.test(stem) ||
          (meq1.test(stem) && !new RegExp("^" + C + v + "[^aeiouwxy]$").test(stem))
        )
          w = stem;
      }
      // Шаг 5b: -ll при m > 1
      if (/ll$/.test(w) && mgr1.test(w)) w = w.slice(0, -1);

      return w.toLowerCase();
    };
  })();

  // Стеммер Snowball для русского. Слово уже нормализовано (ё → е).
  const stemRu = (() => {
    const VOWELS = "аеиоуыэюя";
    const PERFECTIVE_1 = ["вшись", "вши", "в"]; // требуют предшествующей а/я
    const PERFECTIVE_2 = ["ившись", "ывшись", "ивши", "ывши", "ив", "ыв"];
    const REFLEXIVE = ["ся", "сь"];
    const ADJECTIVE = [
      "ими", "ыми", "его", "ого", "ему", "ому", "ее", "ие", "ые", "ое",
      "ей", "ий", "ый", "ой", "ем", "им", "ым", "ом", "их", "ых",
      "ую", "юю", "ая", "яя", "ою", "ею"
    ];
    const PARTICIPLE_1 = ["ем", "нн", "вш", "ющ", "щ"]; // требуют а/я
    const PARTICIPLE_2 = ["ивш", "ывш", "ующ"];
    const VERB_1 = [
      "ешь", "нно", "ете", "йте", "ла", "на", "ли", "ем", "ло", "но",
      "ет", "ют", "ны", "ть", "й", "л", "н"
    ]; // требуют а/я
    const VERB_2 = [
      "ейте", "уйте", "ила", "ыла", "ена", "ите", "или", "ыли", "ило",
      "ыло", "ено", "ует", "уют", "ены", "ить", "ыть", "ишь",
      "ей", "уй", "ил", "ыл", "им", "ым", "ен", "ят", "ит", "ыт", "ую", "ю"
    ];
    const NOUN = [
      "иями", "ями", "ами", "ией", "иям", "ием", "иях",
      "ев", "ов", "ие", "ье", "еи", "ии", "ей", "ой", "ий",
      "ям", "ем", "ам", "ом", "ах", "ях", "ию", "ью", "ия", "ья",
      "а", "е", "и", "й", "о", "у", "ы", "ь", "ю", "я"
    ];
    const SUPERLATIVE = ["ейше", "ейш"];

    const isVowel = (ch) => VOWELS.includes(ch);

    // rv — часть слова после первой гласной; все суффиксы ищутся в ней.
    const findRegions = (w) => {
      let rvStart = w.length;
      for (let i = 0; i < w.length; i++) {
        if (isVowel(w[i])) {
          rvStart = i + 1;
          break;
        }
      }
      // R2: после второй пары «гласная + согласная»
      let r1Start = w.length;
      for (let i = 1; i < w.length; i++) {
        if (isVowel(w[i - 1]) && !isVowel(w[i])) {
          r1Start = i + 1;
          break;
        }
      }
      let r2Start = w.length;
      for (let i = r1Start + 1; i < w.length; i++) {
        if (isVowel(w[i - 1]) && !isVowel(w[i])) {
          r2Start = i + 1;
          break;
        }
      }
      return { rvStart, r2Start };
    };

    // Пытается срезать один из суффиксов (в rv); group1 — только после а/я.
    const removeSuffix = (state, suffixes, needAYa) => {
      const w = state.w;
      for (const suf of suffixes) {
        if (!w.endsWith(suf)) continue;
        const cut = w.length - suf.length;
        if (cut < state.rvStart) continue;
        if (needAYa) {
          const prev = w[cut - 1];
          if (prev !== "а" && prev !== "я") continue;
        }
        state.w = w.slice(0, cut);
        return true;
      }
      return false;
    };

    return (word) => {
      if (word.length < 3 || !/[а-я]/.test(word)) return word;
      const { rvStart, r2Start } = findRegions(word);
      const state = { w: word, rvStart };

      // Шаг 1: деепричастие, иначе возвратность + прилагательное/глагол/существительное
      if (
        !removeSuffix(state, PERFECTIVE_2, false) &&
        !removeSuffix(state, PERFECTIVE_1, true)
      ) {
        removeSuffix(state, REFLEXIVE, false);
        if (removeSuffix(state, ADJECTIVE, false)) {
          if (!removeSuffix(state, PARTICIPLE_2, false))
            removeSuffix(state, PARTICIPLE_1, true);
        } else if (
          !removeSuffix(state, VERB_2, false) &&
          !removeSuffix(state, VERB_1, true)
        ) {
          removeSuffix(state, NOUN, false);
        }
      }

      // Шаг 2: конечная и
      if (state.w.endsWith("и") && state.w.length - 1 >= rvStart)
        state.w = state.w.slice(0, -1);

      // Шаг 3: словообразовательный суффикс в R2
      for (const suf of ["ость", "ост"]) {
        if (state.w.endsWith(suf) && state.w.length - suf.length >= r2Start) {
          state.w = state.w.slice(0, -suf.length);
          break;
        }
      }

      // Шаг 4: нн, превосходная степень, мягкий знак
      const inRv = (n) => state.w.length - n >= rvStart;
      if (state.w.endsWith("нн") && inRv(1)) state.w = state.w.slice(0, -1);
      else if (removeSuffix(state, SUPERLATIVE, false)) {
        if (state.w.endsWith("нн") && inRv(1)) state.w = state.w.slice(0, -1);
      } else if (state.w.endsWith("ь") && inRv(1)) state.w = state.w.slice(0, -1);

      return state.w;
    };
  })();

  const stem = (word) => {
    if (word.length < 3 || /^\d+$/.test(word)) return word;
    return /[а-я]/.test(word) ? stemRu(word) : stemEn(word);
  };

  // Готовит записи индекса к поиску: токены, стемы, множества стемов.
  const buildIndex = (entries) =>
    entries.map((entry) => {
      const tokens = tokenize(entry.text);
      const stems = tokens.map((t) => stem(t.norm));
      const titleTokens = tokenize(entry.title);
      const titleStems = titleTokens.map((t) => stem(t.norm));
      return {
        ...entry,
        tokens,
        stems,
        stemSet: new Set(stems),
        titleTokens,
        titleStems,
        titleStemSet: new Set(titleStems)
      };
    });

  // Все слова запроса должны найтись (по стему), последнее — ещё и по префиксу,
  // чтобы результаты появлялись прямо по ходу набора.
  const search = (index, query, limit = 8) => {
    const terms = tokenize(normalizeWord(query));
    if (!terms.length) return [];
    const stems = terms.map((t) => stem(t.norm));
    const last = terms[terms.length - 1].norm;

    const results = [];
    for (const entry of index) {
      const matchedByTerm = stems.map(() => false);
      const matchedTokens = [];
      for (let i = 0; i < entry.tokens.length; i++) {
        let hit = false;
        for (let j = 0; j < stems.length; j++) {
          const isLast = j === stems.length - 1;
          if (
            entry.stems[i] === stems[j] ||
            (isLast && entry.tokens[i].norm.startsWith(last))
          ) {
            matchedByTerm[j] = true;
            hit = true;
          }
        }
        if (hit) matchedTokens.push(i);
      }
      if (!matchedByTerm.every(Boolean)) continue;

      let titleHits = 0;
      const matchedTitleTokens = [];
      for (let i = 0; i < entry.titleTokens.length; i++) {
        const t = entry.titleTokens[i];
        const tStem = entry.titleStems[i];
        for (let j = 0; j < stems.length; j++) {
          const isLast = j === stems.length - 1;
          if (tStem === stems[j] || (isLast && t.norm.startsWith(last))) {
            matchedTitleTokens.push(i);
            break;
          }
        }
      }
      for (let j = 0; j < stems.length; j++) {
        const isLast = j === stems.length - 1;
        if (
          entry.titleStemSet.has(stems[j]) ||
          (isLast && entry.titleTokens.some((t) => t.norm.startsWith(last)))
        )
          titleHits++;
      }

      const score =
        titleHits * 10 +
        matchedTokens.length +
        matchedTokens.length / (entry.tokens.length || 1);
      results.push({ entry, matchedTokens, matchedTitleTokens, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  };

  // Кусок текста [from, to) с совпавшими токенами, завёрнутыми в <mark>.
  // Собирается через DOM-узлы, без innerHTML.
  const markRange = (text, tokens, matchedIdxs, from, to) => {
    const frag = document.createDocumentFragment();
    if (from > 0) frag.append("…");
    let pos = from;
    for (const i of matchedIdxs) {
      const t = tokens[i];
      if (t.end <= from || t.start >= to) continue;
      if (t.start > pos) frag.append(text.slice(pos, t.start));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(t.start, t.end);
      frag.append(mark);
      pos = t.end;
    }
    if (pos < to) frag.append(text.slice(pos, to));
    if (to < text.length) frag.append("…");
    return frag;
  };

  // Фрагмент текста вокруг первого совпадения.
  const makeSnippet = (result, radius = 40) => {
    const { entry, matchedTokens } = result;
    const first = entry.tokens[matchedTokens[0]];
    let from = Math.max(0, first.start - radius);
    let to = Math.min(entry.text.length, first.end + radius);
    // расширяем до границ слов
    while (from > 0 && !/\s/.test(entry.text[from - 1])) from--;
    while (to < entry.text.length && !/\s/.test(entry.text[to])) to++;
    return markRange(entry.text, entry.tokens, matchedTokens, from, to);
  };

  // Заголовок целиком с подсветкой совпавших слов.
  const markTitle = (result) =>
    markRange(
      result.entry.title,
      result.entry.titleTokens,
      result.matchedTitleTokens,
      0,
      result.entry.title.length
    );

  // ---------- UI ----------

  const lang =
    document.documentElement.lang ||
    (location.pathname.startsWith("/en/") ? "en" : "ru");
  const EMPTY_TEXT = lang === "ru" ? "Ничего не нашлось" : "Nothing found";
  // Насколько можно проскроллить страницу, прежде чем выпадайка закроется:
  // случайный микро-скролл не должен мешать выбирать результат.
  const SCROLL_TOLERANCE = 40;

  // Индекс один на все поля страницы
  const indexPromise = fetch(
    lang === "en" ? "/en/search-index.json" : "/search-index.json"
  )
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((entries) => buildIndex(entries))
    .catch(() => null); // индекс не загрузился — поиск молча неактивен

  const setup = (root, instance) => {
    const input = root.querySelector(".search-input");
    const panel = root.querySelector(".search-results");
    const clearButton = root.querySelector(".search-clear");
    // id связки combobox → listbox уникальны на инстанс
    panel.id = "search-results-" + instance;
    input.setAttribute("aria-controls", panel.id);

    let index = null;
    let results = [];
    let activeIndex = -1;
    let debounceTimer;
    let scrollOrigin = null;

    indexPromise.then((idx) => {
      index = idx;
      if (index && document.activeElement === input) update();
    });

    const open = () => {
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      scrollOrigin = window.scrollY;
    };

    const close = () => {
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
      scrollOrigin = null;
    };

    const setActive = (i) => {
      const items = panel.querySelectorAll(".search-result");
      items.forEach((el, n) => {
        el.classList.toggle("is-active", n === i);
        el.setAttribute("aria-selected", n === i ? "true" : "false");
      });
      activeIndex = i;
      if (i >= 0 && items[i]) {
        input.setAttribute("aria-activedescendant", items[i].id);
        items[i].scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    };

    const render = () => {
      panel.textContent = "";
      if (!results.length) {
        const li = document.createElement("li");
        li.className = "search-empty";
        li.textContent = EMPTY_TEXT;
        panel.append(li);
      } else {
        results.forEach((result, i) => {
          const li = document.createElement("li");
          li.className = "search-result";
          li.id = "search-option-" + instance + "-" + i;
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", "false");

          const a = document.createElement("a");
          a.href = result.entry.url;
          const title = document.createElement("span");
          title.className = "search-result-title";
          // Совпадение в заголовке подсвечивается прямо в нём,
          // и сниппет тогда не нужен.
          if (result.matchedTitleTokens.length) {
            title.append(markTitle(result));
            a.append(title);
          } else {
            title.textContent = result.entry.title;
            const snippet = document.createElement("span");
            snippet.className = "search-result-snippet";
            snippet.append(makeSnippet(result));
            a.append(title, snippet);
          }
          li.append(a);
          panel.append(li);
        });
      }
      activeIndex = -1;
      open();
    };

    const update = () => {
      const query = input.value.trim();
      if (clearButton) clearButton.hidden = !input.value;
      if (!index || query.length < 2) {
        close();
        return;
      }
      results = search(index, query);
      render();
    };

    input.addEventListener("input", () => {
      if (clearButton) clearButton.hidden = !input.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 120);
    });

    if (clearButton)
      clearButton.addEventListener("click", () => {
        input.value = "";
        clearButton.hidden = true;
        close();
        input.focus();
      });

    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) update();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        close();
        // Chrome по Escape нативно чистит type=search — синхронизируем крестик
        if (clearButton)
          setTimeout(() => (clearButton.hidden = !input.value), 0);
        return;
      }
      if (panel.hidden || !results.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + delta + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = results[activeIndex >= 0 ? activeIndex : 0];
        if (target) location.href = target.entry.url;
      }
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });

    // Заметный скролл страницы закрывает выпадайку.
    window.addEventListener(
      "scroll",
      () => {
        if (panel.hidden || scrollOrigin === null) return;
        if (Math.abs(window.scrollY - scrollOrigin) > SCROLL_TOLERANCE) close();
      },
      { passive: true }
    );
  };

  roots.forEach(setup);

  // Движок наружу — для отладки в консоли
  window.siteSearch = { normalizeWord, tokenize, stem, buildIndex, search };
})();
