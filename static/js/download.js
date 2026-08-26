/* Виджет скачивания: клик по плашке открывает меню ссылок, клик вне — закрывает. */
(function () {
  var items = document.querySelectorAll(".ids__download-item");
  function closeAll() {
    items.forEach(function (item) {
      item.classList.remove("active");
      var menu = item.querySelector(".ids__download-menu");
      if (menu) menu.classList.remove("visible");
    });
  }
  items.forEach(function (item) {
    var plate = item.querySelector(".ids__download-plate");
    var menu = item.querySelector(".ids__download-menu");
    if (!plate) return;
    plate.addEventListener("click", function (e) {
      e.stopPropagation();
      var wasActive = item.classList.contains("active");
      closeAll();
      if (!wasActive) {
        item.classList.add("active");
        if (menu) menu.classList.add("visible");
      }
    });
  });
  window.addEventListener("click", function (e) {
    if (!e.composedPath().some(function (n) { return n.classList && n.classList.contains("ids__download-item"); })) closeAll();
  });
})();
