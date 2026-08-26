/* Живой дамп дизайн-токенов для витрины /style.
   Подход перенесён из pndlnk-site/modulate-design-system: токены не хардкодятся
   в разметке, а собираются из document.styleSheets по префиксу — витрина
   не может разойтись с кодом.

   Использование в HTML:
   <div data-tokens-prefix="color" data-tokens-render="swatch"></div>
   <div data-tokens-namespace="--shift__" data-tokens-prefix="" data-tokens-render="swatch"></div>

   Рендерер swatch резолвит значения в контексте контейнера: контейнер с классом
   .dark покажет тёмные значения семантических токенов. */

(function () {
  "use strict";

  var DEFAULT_NS = "--ids__";

  function formatRgb(color) {
    var m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return "rgb(" + m[1] + ", " + m[2] + ", " + m[3] + ")";
    var s = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (s) {
      return (
        "rgb(" +
        Math.round(parseFloat(s[1]) * 255) + ", " +
        Math.round(parseFloat(s[2]) * 255) + ", " +
        Math.round(parseFloat(s[3]) * 255) + ")"
      );
    }
    return color;
  }

  function parseRgb(color) {
    var m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function isDarkBg(rgb) {
    var l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return l < 150;
  }

  /* Обход всех стилей: токены с именем ns + prefix + "-", объявленные под :root
     (правила тем — .dark — пропускаются: имена совпадают, значения
     резолвятся пробником в контексте контейнера). Порядок объявления сохраняется. */
  function collectTokens(ns, prefix, excludes) {
    var fullPrefix = ns + (prefix ? prefix + "-" : "");
    var seen = new Set();
    var result = [];

    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try {
        rules = document.styleSheets[i].cssRules;
      } catch (e) {
        continue;
      }
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (rule.type !== 1) continue;
        var sel = rule.selectorText || "";
        if (sel.indexOf(":root") === -1) continue;
        if (sel.indexOf(".dark") !== -1) continue;
        for (var k = 0; k < rule.style.length; k++) {
          var prop = rule.style[k];
          if (prop.indexOf(fullPrefix) !== 0) continue;
          var short = prop.slice(ns.length);
          if (excludes && excludes.some(function (ex) { return short.indexOf(ex) === 0; })) continue;
          if (seen.has(prop)) continue;
          seen.add(prop);
          result.push({
            name: prop,
            short: short,
            raw: rule.style.getPropertyValue(prop).trim(),
          });
        }
      }
    }
    return result;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function copyOnClick(button, payload) {
    button.addEventListener("click", function () {
      navigator.clipboard.writeText(payload).then(function () {
        var flash = el("span", "guide-color-plate__flash", payload);
        button.appendChild(flash);
        flash.addEventListener("animationend", function () {
          flash.remove();
        });
      });
    });
  }

  /* --- Рендереры --- */

  function renderSwatch(container, tokens) {
    var grid = el("div", "style-color-grid");
    container.appendChild(grid);

    // Пробник внутри контейнера: значения резолвятся с учётом темы контейнера
    var probe = el("span");
    probe.style.display = "none";
    container.appendChild(probe);

    tokens.forEach(function (t) {
      var plate = el("div", "guide-color-plate");
      plate.style.backgroundColor = "var(" + t.name + ")";

      probe.style.backgroundColor = "var(" + t.name + ")";
      var resolved = getComputedStyle(probe).backgroundColor;
      var parsed = parseRgb(resolved);
      if (parsed && isDarkBg(parsed)) plate.classList.add("guide-color-plate--dark");
      // Цвет подписи — явно по светлоте плашки: наследование ломается в тёмном контейнере
      if (parsed) plate.style.color = isDarkBg(parsed) ? "#f0f0f0" : "#141e32";
      // Плашка цвета фона контейнера сливается с ним — лёгкая обводка
      var containerBgRaw = getComputedStyle(container).backgroundColor;
      var containerBg = /rgba\([^)]+,\s*0\)/.test(containerBgRaw)
        ? null
        : parseRgb(containerBgRaw);
      var blendsIn = containerBg
        ? parsed && parsed.every(function (v, i) { return Math.abs(v - containerBg[i]) <= 2; })
        : parsed && parsed[0] >= 248 && parsed[1] >= 248 && parsed[2] >= 248;
      if (blendsIn) plate.classList.add("guide-color-plate--outlined");

      plate.appendChild(el("p", "guide-color-plate__name", t.name));
      var btn = el("button", "guide-color-plate__value", formatRgb(resolved));
      btn.type = "button";
      copyOnClick(btn, "var(" + t.name + ")");
      plate.appendChild(btn);

      grid.appendChild(plate);
    });

    probe.remove();
  }

  function rowsHeader(list) {
    var header = el("div", "guide-tokens__row guide-tokens__row--header");
    header.appendChild(el("span", null, "Токен"));
    header.appendChild(el("span", null, "Образец"));
    header.appendChild(el("span", null, "Значение"));
    list.appendChild(header);
  }

  function appendRow(list, t, sample) {
    var row = el("div", "guide-tokens__row");
    var label = el("span", "guide-tokens__row-label");
    var code = el("code", null, t.name);
    label.appendChild(code);
    copyOnClick(code, "var(" + t.name + ")");
    row.appendChild(label);
    row.appendChild(sample);
    row.appendChild(el("span", "guide-tokens__row-value", t.raw));
    list.appendChild(row);
    return row;
  }

  function renderSpace(container, tokens) {
    var list = el("div", "guide-tokens__rows");
    rowsHeader(list);
    tokens.forEach(function (t) {
      var sample = el("div", "guide-tokens__sample");
      var bar = el("div", "guide-tokens__space-bar");
      bar.style.height = "var(" + t.name + ")";
      sample.appendChild(bar);
      appendRow(list, t, sample);
    });
    container.appendChild(list);
  }

  function renderGap(container, tokens) {
    var list = el("div", "guide-tokens__rows");
    rowsHeader(list);
    tokens.forEach(function (t) {
      var sample = el("div", "guide-tokens__sample");
      var bar = el("div", "guide-tokens__space-bar guide-tokens__space-bar--gap");
      bar.style.width = "var(" + t.name + ")";
      sample.appendChild(bar);
      appendRow(list, t, sample);
    });
    container.appendChild(list);
  }

  function renderRadius(container, tokens) {
    var list = el("div", "guide-tokens__rows");
    rowsHeader(list);
    tokens.forEach(function (t) {
      var sample = el("div", "guide-tokens__sample");
      var box = el("div", "guide-tokens__radius-sample");
      box.style.borderRadius = "var(" + t.name + ")";
      sample.appendChild(box);
      appendRow(list, t, sample);
    });
    container.appendChild(list);
  }

  function renderBorderWidth(container, tokens) {
    var list = el("div", "guide-tokens__rows");
    rowsHeader(list);
    tokens.forEach(function (t) {
      var sample = el("div", "guide-tokens__sample");
      var line = el("div", "guide-tokens__border-line");
      line.style.height = "var(" + t.name + ")";
      sample.appendChild(line);
      appendRow(list, t, sample);
    });
    container.appendChild(list);
  }

  function renderMotion(container, tokens) {
    // Длительности и изинги в одном списке: ховер запускает полоску
    var list = el("div", "guide-tokens__rows");
    rowsHeader(list);
    tokens.forEach(function (t) {
      var isEasing = t.short.indexOf("easing") === 0;
      var sample = el("div", "guide-tokens__sample");
      var track = el("div", "guide-tokens__bar-track");
      var fill = el("div", "guide-tokens__bar-fill");
      fill.style.transitionDuration = isEasing ? "1s" : "var(" + t.name + ")";
      fill.style.transitionTimingFunction = isEasing
        ? "var(" + t.name + ")"
        : "var(--ids__easing-base)";
      track.appendChild(fill);
      sample.appendChild(track);
      var row = appendRow(list, t, sample);
      row.addEventListener("mouseenter", function () { fill.classList.add("is-active"); });
      row.addEventListener("mouseleave", function () { fill.classList.remove("is-active"); });
    });
    container.appendChild(list);
  }

  var renderers = {
    swatch: renderSwatch,
    space: renderSpace,
    gap: renderGap,
    radius: renderRadius,
    "border-width": renderBorderWidth,
    motion: renderMotion,
  };

  function init() {
    document.querySelectorAll("[data-tokens-render]").forEach(function (section) {
      var renderer = renderers[section.dataset.tokensRender];
      if (!renderer) return;
      var ns = section.dataset.tokensNamespace || DEFAULT_NS;
      var excludes = (section.dataset.tokensExclude || "")
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      var tokens = collectTokens(ns, section.dataset.tokensPrefix || "", excludes);
      if (tokens.length) renderer(section, tokens);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
