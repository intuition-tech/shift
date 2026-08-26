/* Копирование по клику: .ids__copy (текст из data-copy) и .ids__icon-copy (SVG-файл картинки).
   Подсказки — соседние .ids__copy-hint / .ids__copy-done внутри общего родителя. */
(function () {
  function captions(el) {
    var parent = el.closest(".ids__color-sample-text") || el;
    return {
      hint: parent.querySelector(".ids__copy-hint"),
      done: parent.querySelector(".ids__copy-done"),
    };
  }
  function show(el, which) {
    var c = captions(el);
    if (c.hint) c.hint.classList.toggle("visible", which === "hint");
    if (c.done) c.done.classList.toggle("visible", which === "done");
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  document.querySelectorAll(".ids__copy").forEach(function (btn) {
    btn.addEventListener("mouseenter", function () { show(btn, "hint"); });
    btn.addEventListener("mouseleave", function () { show(btn, null); });
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      if (await copyText(btn.dataset.copy || btn.textContent.trim())) show(btn, "done");
    });
  });

  document.querySelectorAll(".ids__icon-copy").forEach(function (btn) {
    btn.addEventListener("mouseenter", function () { show(btn, "hint"); });
    btn.addEventListener("mouseleave", function () { show(btn, null); });
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      var img = btn.querySelector("img");
      if (!img) return;
      try {
        var svg = await (await fetch(img.src)).text();
        if (await copyText(svg)) show(btn, "done");
      } catch (err) {
        /* оффлайн или CORS — молча */
      }
    });
  });
})();
