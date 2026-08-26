/* Сравнение картинок: на тач-устройствах переключение по тапу. */
document.querySelectorAll(".ids__compare").forEach(function (el) {
  el.addEventListener("click", function () { el.classList.toggle("toggled"); });
});
