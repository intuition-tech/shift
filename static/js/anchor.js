/* Ссылка на любое место публикации (стили — css/components/anchor.css).
   1. Блокам тела статьи (внутри article.publication, кроме h1, аннотации
      и мета-блока) раздаются id: слаг раздела + хэш содержимого — абзацы
      и картинки без имени получают стабильный адрес, который переживает
      перестановки и ломается только при правке самого блока.
   2. Когда курсор в левой трети колонки над блоком, в левом поле сразу
      появляется иконка-цепь; клик копирует в буфер URL с якорем. В правых
      двух третях иконка не появляется — так она не преследует читателя,
      а задержки, которая воспринималась как тормоз, нет. Уже показанная
      иконка следует за курсором по блокам по всей ширине колонки и гаснет
      (с фейдом), как только курсор выходит из колонки и её левого поля.
   3. Открытие URL с якорем: страница доскролливает к блоку, затем его левый
      верхний угол обводится оранжевым «маркером» — рукописным эллипсом
      (SVG, прорисовка и исчезновение через stroke-dashoffset). */
(function () {
  var article = document.querySelector("article.publication");
  if (!article) return;

  var BLOCKS = "h2, h3, p, ul, ol, figure, table, aside, blockquote, .ids__sequence, .ids__media-group, .ids__video, .ids__download, .ids__compare, .ids__checklist, .ids__color-palette, .ids__slide-pair";
  var SKIP = "h1, .ids__description, .ids__pub-meta, .publication__nav, figcaption, .ids__pubs, .ids__anchor";
  // Иконка появляется только в левой трети колонки
  var ZONE = 1 / 3;
  // Живая зона слева от колонки (там иконка) — в em статьи
  var EXTEND = 2.2;
  var lang = document.documentElement.lang === "en" ? "en" : "ru";
  var T = lang === "en"
    ? { copy: "Copy link to this place", copied: "Link copied" }
    : { copy: "Скопировать ссылку на это место", copied: "Ссылка скопирована" };

  /* ---------- id блоков ---------- */

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function fingerprint(el) {
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) {
      var media = el.querySelector("img, video, iframe, source");
      text = media ? (media.getAttribute("src") || media.getAttribute("data-src") || "") : el.outerHTML;
    }
    return text;
  }

  function isBlock(el) {
    if (!el.matches(BLOCKS) || el.closest(SKIP)) return false;
    // вложенные блоки (абзац внутри врезки, фигура внутри ряда) якорем не отмечаем
    var parent = el.parentElement && el.parentElement.closest(BLOCKS);
    return !(parent && article.contains(parent) && !parent.closest(SKIP));
  }

  var blocks = Array.prototype.filter.call(article.querySelectorAll(BLOCKS), isBlock);
  blocks.forEach(function (el) {
    el.setAttribute("data-anchored", "");
    if (el.id) return;
    var section = el.closest("ids-nav-item");
    var id = (section && section.id ? section.id + "-" : "b-") + hash(fingerprint(el));
    var unique = id, n = 2;
    while (document.getElementById(unique)) unique = id + "-" + n++;
    el.id = unique;
  });

  /* ---------- маркер цели ---------- */

  var SVG_NS = "http://www.w3.org/2000/svg";

  // Путь «рукописного» эллипса: чуть больше оборота, вторая половина шире
  // на 5%, так что конец линии не приходит в точку начала; лёгкая волна
  // радиуса — чтобы не выглядел циркульным. Центр в (0, 0), rx/ry — полуоси
  function ellipsePath(rx, ry) {
    var start = -2.4; // радианы: старт слева-сверху, по часовой
    var turns = 1.0 + 0.1; // полный оборот плюс хвост
    var steps = 72;
    var d = "";
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var a = start + t * turns * Math.PI * 2;
      // первая половина — ровно, вторая постепенно расходится до +5%
      var grow = t < 0.5 ? 1 : 1 + 0.05 * ((t - 0.5) / 0.6);
      var wobble = 1 + 0.012 * Math.sin(a * 3 + 0.7) + 0.008 * Math.sin(a * 5 - 1.1);
      var x = Math.cos(a) * rx * grow * wobble;
      var y = Math.sin(a) * ry * grow * wobble;
      d += (i ? " L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
    }
    return d;
  }

  function mark(el) {
    var old = article.querySelector(".ids__anchor-mark");
    if (old) old.remove();
    var a = article.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var rx = a.width / 4; // ширина эллипса — половина колонки, пропорции 2:1
    var ry = rx / 2;
    // Эллипс заходит на блок, за его угол влево-вверх свешивается ~20%:
    // центр правее и ниже угла на 0.6 полуоси. На узких экранах прижимаем
    // к краю окна, чтобы не вылезать влево (горизонтальный скролл)
    var cx = Math.max(r.left - a.left + rx * 0.6, rx + 4 - a.left);
    var cy = r.top - a.top + ry * 0.6;

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ids__anchor-mark");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", -rx * 1.2 + " " + -ry * 1.2 + " " + rx * 2.4 + " " + ry * 2.4);
    svg.style.left = cx - rx * 1.2 + "px";
    svg.style.top = cy - ry * 1.2 + "px";
    svg.style.width = rx * 2.4 + "px";
    svg.style.height = ry * 2.4 + "px";
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ellipsePath(rx, ry));
    svg.appendChild(path);
    article.appendChild(svg);

    var len = path.getTotalLength();
    path.style.strokeDasharray = len + " " + len;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !path.animate) {
      path.style.strokeDashoffset = 0;
      setTimeout(function () { svg.remove(); }, 1800);
      return;
    }
    // Прорисовка не спеша (0 → 0.5), пауза, быстрое исчезновение в ту же сторону
    var anim = path.animate(
      [
        { strokeDashoffset: len, offset: 0, easing: "cubic-bezier(0.3, 0, 0.4, 1)" },
        { strokeDashoffset: 0, offset: 0.5 },
        { strokeDashoffset: 0, offset: 0.85, easing: "cubic-bezier(0.6, 0, 1, 1)" },
        { strokeDashoffset: -len, offset: 1 }
      ],
      { duration: 2200, fill: "forwards" }
    );
    anim.onfinish = function () { svg.remove(); };
  }

  // Ждём, пока страница доскроллит (scroll-behavior: smooth), и только потом
  // рисуем: иначе анимация успевает пройти, пока блок ещё не на экране
  function afterScroll(fn) {
    var last = window.scrollY, still = 0, ticks = 0;
    (function poll() {
      ticks++;
      if (window.scrollY === last) still++; else { still = 0; last = window.scrollY; }
      if (still >= 6 || ticks > 120) return fn();
      requestAnimationFrame(poll);
    })();
  }

  function highlight() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el || !el.hasAttribute("data-anchored")) return;
    el.scrollIntoView({ block: "start" });
    afterScroll(function () { mark(el); });
  }
  highlight();
  window.addEventListener("hashchange", highlight);
  // Повторный ввод того же URL с тем же якорем: страница не перезагружается
  // и hashchange не приходит — браузер только подскролливает. Ловим это
  // через Navigation API (Chrome/Edge; в Safari события нет — там повторный
  // ввод останется без маркера)
  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener("navigate", function (e) {
      if (!e.hashChange && e.destination && e.destination.url === location.href && location.hash) {
        setTimeout(highlight, 0);
      }
    });
  }
  // Для витрины: показать маркер на произвольном блоке
  window.shiftAnchorMark = mark;

  /* ---------- иконка ---------- */

  var button = document.createElement("button");
  button.type = "button";
  button.className = "ids__anchor";
  button.setAttribute("aria-label", T.copy);
  button.title = T.copy;
  button.innerHTML =
    // Два разомкнутых звена, вставленных друг в друга (контуры — Feather «link»)
    '<svg class="ids__anchor-chain" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
    '<svg class="ids__anchor-done" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>';
  article.appendChild(button);

  var live = document.createElement("div");
  live.className = "ids__anchor-live";
  live.setAttribute("aria-live", "polite");
  article.appendChild(live);

  var current = null;
  var doneTimer = null;

  function place(el) {
    var a = article.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    button.style.top = r.top - a.top + "px";
  }

  function show(el) {
    current = el;
    place(el);
    button.classList.add("visible");
  }

  function hide() {
    current = null;
    button.classList.remove("visible");
  }

  // Всё по координатам, без таймеров:
  // — вне живой зоны (колонка + левое поле с иконкой + сам блок, если он шире
  //   колонки, как .ids__media-group.XL) иконка гаснет сразу (фейд — в CSS);
  // — в зоне, но не над блоком (поля между абзацами, сама иконка) — остаётся;
  // — над блоком: показанная иконка переезжает к нему по всей ширине колонки,
  //   ещё не показанная появляется только из левой трети.
  // Слушаем и mouseover: над iframe (.ids__video) mousemove в документ
  // не приходит, а mouseover на входе в iframe — приходит. Внутри iframe
  // курсор не отследить, поэтому вход в него показывает иконку из любой точки
  function track(e) {
    if (e.type === "mouseover" && e.target.tagName === "IFRAME") {
      var block = e.target.closest("[data-anchored]");
      if (block && article.contains(block)) show(block);
      return;
    }
    var a = article.getBoundingClientRect();
    var em = parseFloat(getComputedStyle(article).fontSize);
    var visible = button.classList.contains("visible");
    var onButton = e.target === button || button.contains(e.target);
    var el = e.target.closest ? e.target.closest("[data-anchored]") : null;
    if (el && !article.contains(el)) el = null;
    var inField = e.clientX >= a.left - EXTEND * em && e.clientX < a.left &&
      e.clientY >= a.top && e.clientY <= a.bottom;
    var inZone = el || onButton || inField || (e.clientX >= a.left && e.clientX <= a.right &&
      e.clientY >= a.top && e.clientY <= a.bottom);
    if (!inZone) { if (visible) hide(); return; }
    // В левом поле блок берём по вертикали — так ссылку получает и iframe,
    // над которым курсор не отследить
    if (!el && inField && !onButton) {
      var under = document.elementFromPoint(a.left + 2, e.clientY);
      el = under && under.closest ? under.closest("[data-anchored]") : null;
      if (el && !article.contains(el)) el = null;
    }
    if (!el) return;
    if (visible) { if (el !== current) show(el); return; }
    if (e.clientX < a.left + a.width * ZONE) show(el);
  }
  document.addEventListener("mousemove", track);
  document.addEventListener("mouseover", track);
  // Вход курсора в iframe — ещё и mouseenter на самом iframe (не всплывает)
  Array.prototype.forEach.call(article.querySelectorAll("[data-anchored] iframe"), function (frame) {
    frame.addEventListener("mouseenter", track);
  });

  // Курсор ушёл из окна
  document.documentElement.addEventListener("mouseleave", hide);

  button.addEventListener("click", function () {
    if (!current || !current.id) return;
    var url = location.origin + location.pathname + "#" + current.id;
    var done = function () {
      live.textContent = T.copied;
      button.classList.add("done");
      clearTimeout(doneTimer);
      doneTimer = setTimeout(function () { button.classList.remove("done"); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {});
    }
  });

  // При ресайзе и переливке текста иконка, если видна, остаётся у своего блока
  window.addEventListener("resize", function () { if (current && button.classList.contains("visible")) place(current); });
})();
