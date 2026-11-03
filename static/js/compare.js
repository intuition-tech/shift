/* Сравнение картинок: вторая видна, пока центр блока ниже середины окна
   (порт scroll-change.js старого сайта); тап переворачивает состояние. */
(function () {
  const blocks = document.querySelectorAll(".ids__compare");
  if (!blocks.length) return;

  function update() {
    const middle = window.innerHeight / 2;
    blocks.forEach(function (el) {
      const rect = el.getBoundingClientRect();
      el.classList.toggle("passed", rect.top + rect.height / 2 < middle);
    });
  }

  blocks.forEach(function (el) {
    el.addEventListener("click", function () { el.classList.toggle("toggled"); });
  });
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
