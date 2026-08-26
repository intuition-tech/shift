(function () {
  // Переключатель языка: запоминаем выбор в куке
  document.querySelectorAll(".switcher a").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      document.cookie =
        "_int_locale=" + link.dataset.locale + "; path=/; max-age=31536000";
      window.location.href = link.getAttribute("href");
    });
  });
})();
