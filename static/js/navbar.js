class IdsNavbar extends HTMLElement {
  static #items = document.getElementsByTagName("ids-nav-item");
  static #instances = document.getElementsByTagName("ids-navbar");

  #listItems = []

  constructor() {
    super();
    this.render();
  }

  static updateItems() {
    for (const instance of this.#instances) {
      instance.render();
    }
    this.updateCurrent();
  }

  static updateCurrent() {
    let highestTopPositionIndex = 0;
    for (let i = 0; i < this.#items.length; i++) {
      let { bottom, top } = this.#items[i].getBoundingClientRect() ?? {
        top: 0,
        bottom: 0,
      };
      let topPosition = (top + bottom) / 2;
      if (topPosition < 0) {
        highestTopPositionIndex = i;
      }
      if (topPosition >= 0 && topPosition < window.innerHeight / 2) {
        highestTopPositionIndex = i;
        break;
      }
    }

    for (const instance of this.#instances) {
      instance.setCurrent(highestTopPositionIndex);
    }
  }

  setCurrent(index) {
    for (let i = 0; i < this.#listItems.length; i += 1) {
      if (i === index) {
        this.#listItems[i].classList.add("current");
      } else {
        this.#listItems[i].classList.remove("current");
      }
    }
  }

  render() {
    this.innerHTML = "";
    this.#listItems.length = 0;

    this.classList.add("ids__navbar");
    const ul = document.createElement("ul");
    for (const item of IdsNavbar.#items) {
      const li = document.createElement("li");
      this.#listItems.push(li);

      {
        const a = document.createElement("a");
        a.href = `#${item.getAttribute("id")}`;
        a.textContent = item.getAttribute("label");
        li.appendChild(a);
      }

      ul.appendChild(li);
    }
    this.appendChild(ul);
  }
}

// TODO можно добавлять/убирать этот лисенер
document.addEventListener("scroll", () => IdsNavbar.updateCurrent());

class IdsNavItem extends HTMLElement {
  constructor() {
    super();
    this.classList.add("ids__nav-item");
  }

  connectedCallback() {
    IdsNavbar.updateItems();
  }
  disconnectedCallback() {
    IdsNavbar.updateItems();
  }
}

window.customElements.define("ids-navbar", IdsNavbar);
window.customElements.define("ids-nav-item", IdsNavItem);

// Рамка-индикатор в оглавлении (перенос nav-indicator.js с arutyunov.info,
// адаптация под ids-navbar). Обрамляет пункт, соответствующий текущей позиции
// скролла, и плавно едет между пунктами пропорционально прокрутке между их
// якорями. По клику страница подскролливается к якорю, и рамка «перелетает»
// ровно к пункту. Отличия от исходника: пункты и якоря берутся из живого DOM
// на каждый кадр (ids-navbar может перерендериться), позиция якоря учитывает
// scroll-margin-top секций, рамка симметричная (учтён и padding-bottom).
(function () {
  var navbar = document.querySelector("ids-navbar");
  if (!navbar) return;

  var frame = document.createElement("div");
  frame.className = "ids__navbar-indicator";
  frame.hidden = true;

  var desktop = window.matchMedia("(min-width: 768px)");
  var ticking = false;
  // Последний отрисованный бокс (в координатах навбара, без полей рамки).
  var current = null;
  // «Перелёт» по клику: от текущего бокса напрямую к целевому пункту,
  // прогресс — по прокрутке от стартовой позиции к якорю.
  var flight = null;
  var idleTimer = null;

  function links() {
    return Array.prototype.slice.call(navbar.querySelectorAll("ul li a"));
  }

  function target(a) {
    var href = a.getAttribute("href") || "";
    return href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
  }

  // Позиция скролла, в которой браузер оставит якорь: верх якоря минус его
  // scroll-margin-top у верха окна, но не дальше конца страницы.
  function anchorY(a) {
    var t = target(a);
    if (!t) return 0;
    var smt = parseFloat(getComputedStyle(t).scrollMarginTop) || 0;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = t.getBoundingClientRect().top + window.scrollY - smt;
    return Math.max(0, Math.min(y, max));
  }

  function box(a) {
    var nav = navbar.getBoundingClientRect();
    var r = a.getBoundingClientRect();
    return { top: r.top - nav.top, left: r.left - nav.left, w: r.width, h: r.height };
  }

  function render() {
    ticking = false;
    if (!frame.isConnected) navbar.appendChild(frame);
    var items = links();
    if (!desktop.matches || !items.length) { frame.hidden = true; return; }
    frame.hidden = false;

    var y = window.scrollY;
    var n = items.length;
    var t;

    if (flight) {
      var p = flight.y1 === flight.y0 ? 1 : (y - flight.y0) / (flight.y1 - flight.y0);
      p = Math.min(1, Math.max(0, p));
      var to = box(items[flight.to]);
      var k = function (q, r) { return q + (r - q) * p; };
      t = { top: k(flight.from.top, to.top), left: k(flight.from.left, to.left), w: k(flight.from.w, to.w), h: k(flight.from.h, to.h) };
      if (p >= 1) flight = null;
    } else {
      var i = 0;
      while (i < n - 1 && y >= anchorY(items[i + 1])) i++;
      var prog = 0;
      if (i < n - 1) {
        var y0 = anchorY(items[i]), y1 = anchorY(items[i + 1]);
        prog = y1 > y0 ? Math.min(1, Math.max(0, (y - y0) / (y1 - y0))) : 0;
      }
      var a = box(items[i]);
      var b = i < n - 1 ? box(items[i + 1]) : a;
      var lerp = function (q, r) { return q + (r - q) * prog; };
      t = { top: lerp(a.top, b.top), left: lerp(a.left, b.left), w: lerp(a.w, b.w), h: lerp(a.h, b.h) };
    }
    current = t;

    // Поля рамки заданы в CSS как её padding (на бокс не влияют:
    // размеры выставляются явно), отсюда берём их уже в пикселях.
    var cs = getComputedStyle(frame);
    var px = parseFloat(cs.paddingLeft) || 0;
    var pt = parseFloat(cs.paddingTop) || 0;
    var pb = parseFloat(cs.paddingBottom) || 0;

    frame.style.top = t.top - pt + "px";
    frame.style.left = t.left - px + "px";
    frame.style.width = t.w + 2 * px + "px";
    frame.style.height = t.h + pt + pb + "px";
  }

  navbar.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a || !desktop.matches || !current) return;
    var i = links().indexOf(a);
    if (i === -1) return;
    flight = { from: current, to: i, y0: window.scrollY, y1: anchorY(a) };
    schedule();
  });

  // Если прокрутка остановилась, не дойдя до якоря (пользователь вмешался
  // колесом), перелёт отменяем и возвращаемся к обычной привязке.
  function onScroll() {
    schedule();
    if (!flight) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { flight = null; schedule(); }, 200);
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", schedule);
  desktop.addEventListener("change", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  window.addEventListener("load", schedule);
  render();
})();
