// Поиск по сайту: выдача по разделам — люди, теги (рынки, команды, предметные
// области, подборки), заголовки, текст. Движок текста (нормализация, стеммеры,
// матчинг, сниппеты) не трогает DOM и портирован с arutyunov.info, где
// обкатывался как прототип. Индекс общий для обоих языков (поиск с английской
// страницы находит русские страницы и наоборот): /search-index.json и
// /en/search-index.json — одинаковые файлы, собираются шаблоном
// src/pages/search-index.11ty.js, формат описан там.
// UI поддерживает несколько полей на странице — индекс грузится один раз на всех.
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


  // Все слова запроса должны найтись (по стему), последнее — ещё и по префиксу,
  // чтобы результаты появлялись прямо по ходу набора. Возвращает индексы
  // совпавших токенов или null, если какое-то слово не нашлось.
  const matchTokens = (tokens, stems, query) => {
    const matchedByTerm = query.stems.map(() => false);
    const matched = [];
    for (let i = 0; i < tokens.length; i++) {
      let hit = false;
      for (let j = 0; j < query.stems.length; j++) {
        const isLast = j === query.stems.length - 1;
        if (stems[i] === query.stems[j] || (isLast && tokens[i].norm.startsWith(query.last))) {
          matchedByTerm[j] = true;
          hit = true;
        }
      }
      if (hit) matched.push(i);
    }
    return matchedByTerm.every(Boolean) ? matched : null;
  };

  // Транслит кириллического слова в латиницу — все правдоподобные варианты
  // (имена в authors.js написаны по-разному: Maksim и Alexey, Dmitry и
  // Novokhatskiy), чтобы «максимова» нашла Maksimova, а «алексей» — Alexey.
  // Потолок вариантов — чтобы длинное слово с несколькими ё/й/я не взрывалось.
  const TRANSLIT = {
    а: ["a"], б: ["b"], в: ["v"], г: ["g"], д: ["d"], е: ["e"], ё: ["e", "yo"],
    ж: ["zh"], з: ["z"], и: ["i"], й: ["y", "i", "j"], к: ["k"], л: ["l"],
    м: ["m"], н: ["n"], о: ["o"], п: ["p"], р: ["r"], с: ["s"], т: ["t"],
    у: ["u"], ф: ["f"], х: ["kh", "h"], ц: ["ts", "c"], ч: ["ch"], ш: ["sh"],
    щ: ["shch", "sch"], ъ: [""], ы: ["y", "i"], ь: ["", "i"], э: ["e"],
    ю: ["yu", "iu"], я: ["ya", "ia"]
  };
  const TRANSLIT_PAIRS = { кс: ["ks", "x"], ий: ["iy", "y"] };
  const TRANSLIT_CAP = 64;
  const translit = (word) => {
    let variants = [""];
    for (let i = 0; i < word.length; i++) {
      const pair = TRANSLIT_PAIRS[word.slice(i, i + 2)];
      const options = pair || TRANSLIT[word[i]] || [word[i]];
      if (pair) i++;
      const next = [];
      for (const v of variants)
        for (const o of options) {
          if (next.length >= TRANSLIT_CAP) break;
          next.push(v + o);
        }
      variants = next;
    }
    return variants;
  };

  // Люди: без стемминга, по префиксу слов имени. Кандидаты для слова запроса —
  // само слово (латиница), варианты транслита (кириллица) и латинские формы
  // из словарика aliases: по ключам, которые начинаются с этого слова
  // («кат» → катя → ekaterina, katya), и по значениям — латинская форма тянет
  // остальные формы того же имени («katya» → катя → ekaterina).
  const personCandidates = (term, aliases) => {
    const cyrillic = /[а-я]/.test(term);
    const out = new Set(cyrillic ? translit(term) : [term]);
    for (const key in aliases) {
      const forms = aliases[key];
      if (cyrillic ? key.startsWith(term) : forms.some((f) => f.startsWith(term)))
        for (const f of forms) out.add(f);
    }
    return [...out].filter(Boolean);
  };

  const matchPerson = (person, query, aliases) => {
    const matched = new Set();
    for (const term of query.terms) {
      const candidates = personCandidates(term.norm, aliases);
      let hit = false;
      person.tokens.forEach((t, i) => {
        if (candidates.some((c) => t.norm.startsWith(c))) {
          matched.add(i);
          hit = true;
        }
      });
      if (!hit) return null;
    }
    return [...matched].sort((a, b) => a - b);
  };

  const prepare = (text) => {
    const tokens = tokenize(text);
    const stems = tokens.map((t) => stem(t.norm));
    return { tokens, stems };
  };

  // Готовит индекс к поиску: публикации группируются по слагу (RU и EN записи
  // одной страницы — одна строка выдачи), у людей токены имени, у тегов —
  // токены имён на обоих языках.
  const buildIndex = (data) => {
    const pubs = new Map();
    for (const entry of data.pubs) {
      const prepared = {
        ...entry,
        ...prepare(entry.text),
        title: entry.title,
        titleTokens: tokenize(entry.title)
      };
      prepared.titleStems = prepared.titleTokens.map((t) => stem(t.norm));
      if (!pubs.has(entry.slug)) pubs.set(entry.slug, { slug: entry.slug, entries: {} });
      pubs.get(entry.slug).entries[entry.lang] = prepared;
    }
    const people = data.people.map((p) => ({ ...p, tokens: tokenize(p.name) }));
    const tags = data.tags.map((t) => ({
      ...t,
      ru: { name: t.ru, ...prepare(t.ru) },
      en: { name: t.en, ...prepare(t.en) }
    }));
    return { pubs: [...pubs.values()], people, tags, aliases: data.aliases || {} };
  };

  const parseQuery = (query) => {
    const terms = tokenize(normalizeWord(query));
    if (!terms.length) return null;
    return { terms, stems: terms.map((t) => stem(t.norm)), last: terms[terms.length - 1].norm };
  };

  // Выдача по разделам. lang — язык страницы: какую запись публикации и какое
  // имя тега показывать. Публикации — двумя списками: совпавшие заголовком
  // (любого языка) и только текстом; в выдаче они идут одним разделом в этом порядке.
  const search = (index, queryText, lang, limit = 8) => {
    const query = parseQuery(queryText);
    const empty = { people: [], tags: { market: [], team: [], area: [], collection: [] }, titles: [], texts: [] };
    if (!query) return empty;
    const result = empty;

    for (const person of index.people) {
      const matched = matchPerson(person, query, index.aliases);
      if (matched) result.people.push({ person, matchedTokens: matched });
    }

    for (const tag of index.tags) {
      const shown = tag[lang] || tag.ru;
      const other = shown === tag.ru ? tag.en : tag.ru;
      const matched = matchTokens(shown.tokens, shown.stems, query);
      const matchedOther = matched ? null : matchTokens(other.tokens, other.stems, query);
      if (matched || matchedOther)
        result.tags[tag.dim].push({ tag, name: shown, matchedTokens: matched || [] });
    }

    const titles = [];
    const texts = [];
    for (const pub of index.pubs) {
      const shown = pub.entries[lang] || pub.entries.ru || Object.values(pub.entries)[0];
      let best = null;
      for (const entry of Object.values(pub.entries)) {
        const matchedTokens = matchTokens(entry.tokens, entry.stems, query);
        const matchedTitleTokens = matchTokens(entry.titleTokens, entry.titleStems, query);
        if (!matchedTokens && !matchedTitleTokens) continue;
        const score =
          (matchedTitleTokens ? 10 * matchedTitleTokens.length : 0) +
          (matchedTokens ? matchedTokens.length + matchedTokens.length / (entry.tokens.length || 1) : 0);
        const candidate = { entry, matchedTokens, matchedTitleTokens, score };
        // Запись языка страницы при равном счёте предпочтительнее
        if (!best || score > best.score || (score === best.score && entry === shown)) best = candidate;
      }
      if (!best) continue;
      const inTitle = Object.values(pub.entries).some(
        (e) => matchTokens(e.titleTokens, e.titleStems, query)
      );
      const shownTitle = matchTokens(shown.titleTokens, shown.titleStems, query) || [];
      const item = {
        pub,
        entry: shown,
        // Подсветка — по заголовку показываемой записи; если совпал только
        // заголовок другого языка, заголовок показывается без подсветки
        matchedTitleTokens: shownTitle,
        // Сниппет — из той записи, где текст совпал (может быть другой язык)
        snippetFrom: best.matchedTokens ? best : null,
        inTitle,
        score: best.score
      };
      (inTitle ? titles : texts).push(item);
    }
    const byScore = (a, b) => b.score - a.score;
    result.titles = titles.sort(byScore).slice(0, limit);
    result.texts = texts.sort(byScore).slice(0, limit);
    return result;
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
  const T =
    lang === "ru"
      ? {
          empty: "Ничего не нашлось",
          people: "Люди",
          market: "Рынки",
          team: "Команды",
          area: "Предметные области",
          collection: "Подборки",
          pubs_label: "Публикации",
          pubs: ["публикация", "публикации", "публикаций"]
        }
      : {
          empty: "Nothing found",
          people: "People",
          market: "Markets",
          team: "Teams",
          area: "Subject areas",
          collection: "Collections",
          pubs_label: "Publications",
          pubs: ["publication", "publications", "publications"]
        };
  const PREFIX = lang === "en" ? "/en" : "";
  const PUB_LIMIT = 8;
  // Насколько можно проскроллить страницу, прежде чем выпадайка закроется:
  // случайный микро-скролл не должен мешать выбирать результат.
  const SCROLL_TOLERANCE = 40;

  // «1 публикация», «3 публикации», «12 публикаций» / «1 publication», «2 publications»
  const pluralize = (n) => {
    const forms = T.pubs;
    let form;
    if (lang === "ru") {
      const m10 = n % 10;
      const m100 = n % 100;
      form = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 1 : 2;
    } else form = n === 1 ? 0 : 1;
    return `${n} ${forms[form]}`;
  };

  // «17 мая», для прошлых лет «31 октября 2019» (без « г.» из Intl)
  const thisYear = new Date().getFullYear();
  const formatDate = (iso) => {
    if (!iso) return "";
    const date = new Date(iso + "T00:00:00Z");
    const withYear = date.getUTCFullYear() !== thisYear;
    return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
      day: "numeric",
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC"
    })
      .format(date)
      .replace(/\s*г\.$/, "");
  };

  // Индекс один на все поля страницы
  const indexPromise = fetch(
    lang === "en" ? "/en/search-index.json" : "/search-index.json"
  )
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => buildIndex(data))
    .catch(() => null); // индекс не загрузился — поиск молча неактивен

  const el = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.append(content);
    return node;
  };

  const setup = (root, instance) => {
    const input = root.querySelector(".search-input");
    const panel = root.querySelector(".search-results");
    const clearButton = root.querySelector(".search-clear");
    // id связки combobox → listbox уникальны на инстанс
    panel.id = "search-results-" + instance;
    input.setAttribute("aria-controls", panel.id);

    let index = null;
    let rows = []; // строки выдачи по порядку — для стрелок и Enter
    let activeIndex = -1;
    let debounceTimer;
    let scrollOrigin = null;

    indexPromise.then((idx) => {
      index = idx;
      if (index && document.activeElement === input) update();
    });

    // Выпадайка не выходит за низ экрана: потолок высоты — от её верха до низа
    // окна минус отступ; внутри — свой скролл
    const BOTTOM_GAP = 24;
    // Туман у нижнего края — пока ниже есть ещё строки (search.css, has-more)
    const updateFade = () => {
      const more = panel.scrollHeight - panel.clientHeight - panel.scrollTop > 2;
      panel.classList.toggle("has-more", more);
    };
    panel.addEventListener("scroll", updateFade, { passive: true });

    const fit = () => {
      if (panel.hidden) return;
      const top = panel.getBoundingClientRect().top;
      panel.style.maxHeight = Math.max(120, window.innerHeight - top - BOTTOM_GAP) + "px";
      updateFade();
    };

    const open = () => {
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      scrollOrigin = window.scrollY;
      fit();
    };
    window.addEventListener("resize", fit);

    const close = () => {
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
      scrollOrigin = null;
    };

    const setActive = (i) => {
      const items = panel.querySelectorAll(".search-result");
      items.forEach((node, n) => {
        node.classList.toggle("is-active", n === i);
        node.setAttribute("aria-selected", n === i ? "true" : "false");
      });
      activeIndex = i;
      if (i >= 0 && items[i]) {
        input.setAttribute("aria-activedescendant", items[i].id);
        items[i].scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    };

    // Мета-строка публикации: «дата · рынки · команды», пустые части пропускаются
    const metaFor = (entry) => {
      const names = (dim, slugs) =>
        slugs
          .map((slug) => index.tags.find((t) => t.dim === dim && t.slug === slug))
          .filter(Boolean)
          .map((t) => (t[lang] || t.ru).name)
          .join(", ");
      return [formatDate(entry.date), names("market", entry.markets), names("team", entry.teams)]
        .filter(Boolean)
        .join(" · ");
    };

    const addLabel = (text) => {
      const li = el("li", "search-group-label", text);
      li.setAttribute("role", "presentation");
      panel.append(li);
    };

    const addRow = (href, kind, build) => {
      const li = el("li", "search-result " + kind);
      li.id = "search-option-" + instance + "-" + rows.length;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      const a = el("a");
      a.href = href;
      build(a);
      li.append(a);
      panel.append(li);
      rows.push({ href });
    };

    const render = (result) => {
      panel.textContent = "";
      rows = [];

      if (result.people.length) {
        addLabel(T.people);
        for (const { person, matchedTokens } of result.people)
          addRow(`${PREFIX}/publications/?author=${person.slug}`, "person", (a) => {
            a.append(
              el("span", "search-result-title", markRange(person.name, person.tokens, matchedTokens, 0, person.name.length)),
              " ",
              el("span", "search-result-count", pluralize(person.count))
            );
          });
      }

      for (const dim of ["market", "team", "area", "collection"]) {
        const list = result.tags[dim];
        if (!list.length) continue;
        addLabel(T[dim]);
        for (const { tag, name, matchedTokens } of list)
          addRow(`${PREFIX}/publications/?${dim}=${tag.slug}`, "tag", (a) => {
            a.append(
              el("span", "search-result-title", markRange(name.name, name.tokens, matchedTokens, 0, name.name.length)),
              " ",
              el("span", "search-result-count", pluralize(tag.count))
            );
          });
      }

      // Публикации одним разделом: сначала совпавшие заголовком (крупнее),
      // затем совпавшие текстом — со сниппетом
      const pubs = [...result.titles, ...result.texts].slice(0, PUB_LIMIT);
      if (pubs.length) {
        addLabel(T.pubs_label);
        for (const item of pubs)
          addRow(item.entry.url, item.inTitle ? "pub in-title" : "pub", (a) => {
            const title = el("span", "search-result-title");
            if (item.matchedTitleTokens.length) title.append(markTitle(item));
            else title.textContent = item.entry.title;
            a.append(title);
            if (!item.inTitle && item.snippetFrom)
              a.append(el("span", "search-result-snippet", makeSnippet(item.snippetFrom)));
            const meta = metaFor(item.entry);
            if (meta) a.append(el("span", "search-result-meta", meta));
          });
      }

      if (!rows.length) panel.append(el("li", "search-empty", T.empty));
      activeIndex = -1;
      panel.scrollTop = 0;
      open();
    };

    const update = () => {
      const query = input.value.trim();
      if (clearButton) clearButton.hidden = !input.value;
      if (!index || query.length < 2) {
        close();
        return;
      }
      render(search(index, query, lang));
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
      if (panel.hidden || !rows.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + delta + rows.length) % rows.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = rows[activeIndex >= 0 ? activeIndex : 0];
        if (target) location.href = target.href;
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

  // Движок наружу — для отладки в консоли: siteSearch.search(siteSearch.index, "катя", "ru")
  window.siteSearch = { normalizeWord, tokenize, stem, translit, buildIndex, search, lang };
  indexPromise.then((idx) => (window.siteSearch.index = idx));
})();
