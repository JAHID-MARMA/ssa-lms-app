/* Self Scale Academy — shared front-end logic (Phase 1, no backend).
   Cart lives in localStorage under "ssa_cart" as an array of item ids. */
(function () {
  "use strict";

  /* ---------------- cart ---------------- */
  function cartGet() {
    try {
      var raw = localStorage.getItem("ssa_cart");
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === "[object Array]" ? arr : [];
    } catch (e) { return []; }
  }
  function cartSet(ids) {
    try { localStorage.setItem("ssa_cart", JSON.stringify(ids)); } catch (e) {}
  }
  function cartAdd(id) {
    var ids = cartGet();
    if (ids.indexOf(id) === -1) { ids.push(id); cartSet(ids); }
  }
  function cartRemove(id) {
    cartSet(cartGet().filter(function (x) { return x !== id; }));
  }
  function cartClear() { cartSet([]); }
  function cartTotal() {
    return cartGet().reduce(function (sum, id) {
      var it = ssaFindItem(id);
      return sum + (it ? it.price : 0);
    }, 0);
  }
  window.SSA_CART = { get: cartGet, add: cartAdd, remove: cartRemove, clear: cartClear, total: cartTotal };

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("ssaToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "ssaToast"; t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3400);
  }
  window.ssaToast = toast;

  /* ---------------- card rendering ---------------- */
  function priceHtml(item) {
    return '<div class="price-row">' +
      '<span class="price-now">৳' + item.price + '</span>' +
      '<span class="price-was">৳' + item.regular.toLocaleString("en-US") + '</span>' +
      '<span class="price-save">' + ssaDiscount(item) + '% ছাড়</span></div>';
  }
  function cardHtml(item) {
    return '<article class="card" id="card-' + item.id + '">' +
      '<a class="cover" href="' + item.page + '"><img src="' + item.cover + '" alt="' + item.title + '" loading="lazy" decoding="async"></a>' +
      '<div class="card-body"><h3 class="en">' + item.title + '</h3>' +
      '<p class="bn">' + item.titleBn + '</p>' + priceHtml(item) +
      '<a class="btn" href="cart.html" data-add="' + item.id + '">' + item.cta + '</a>' +
      '</div></article>';
  }
  function renderInto(id, items) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(cardHtml).join("");
  }

  function bnNum(n) {
    return String(n).replace(/\d/g, function (d) { return "০১২৩৪৫৬৭৮৯"[Number(d)]; });
  }

  /* Lesson list. DB lessons carry is_preview + a database id; static
     data.js lessons fall back to "first lesson is the preview". Lessons
     with a DB id link to lesson.html — the navigation itself happens in
     the delegated click handler below, and only for lessons that are a
     free preview or already unlocked (class "open", set by auth.js).
     The current open state is snapshotted first, so a re-render after
     the database catalog lands never re-locks an enrolled student. */
  function renderLessons(course) {
    var lessonsEl = document.getElementById("lessonList");
    if (!lessonsEl) return;
    var openIdx = {};
    for (var k = 0; k < lessonsEl.children.length; k++) {
      if (lessonsEl.children[k].className === "open") openIdx[k] = true;
    }
    lessonsEl.innerHTML = (course.lessons || []).map(function (l, i) {
      var free = (typeof l.is_preview === "boolean") ? l.is_preview : (i === 0);
      var cls, tag;
      if (openIdx[i]) { cls = "open"; tag = '<span class="tag tag-open">✓ খোলা আছে</span>'; }
      else if (free) { cls = "free"; tag = '<span class="tag tag-free">ফ্রি প্রিভিউ</span>'; }
      else { cls = "locked"; tag = '<span class="tag tag-lock">🔒 লক করা</span>'; }
      var attr = (l.id != null) ? ' data-lesson-id="' + l.id + '"' : "";
      return '<li class="' + cls + '"' + attr + '><span class="l-num">' + (i + 1) + '</span>' +
        '<span class="l-text"><b class="en">' + l.title + '</b><small>' + (l.desc || "") + '</small></span>' +
        tag + '</li>';
    }).join("");
  }

  /* Catalog rendering (grids + course hero). Runs once on load with the
     static data.js content; content.js calls it again after the database
     catalog has been merged into SSA_DATA. */
  function renderCatalog() {
    renderInto("courseCards", SSA_DATA.courses);
    renderInto("productCards", SSA_DATA.products);
    renderInto("allCards", SSA_DATA.courses.concat(SSA_DATA.products));

    var heroEl = document.getElementById("courseHero");
    if (heroEl) {
      var course = ssaFindItem(heroEl.getAttribute("data-course"));
      if (course) {
        document.title = course.title + " — Self Scale Academy";
        heroEl.innerHTML =
          '<div class="cover-box"><img src="' + course.cover + '" alt="' + course.title + '"></div>' +
          '<div><h1 class="en">' + course.title + '</h1><p class="bn">' + course.titleBn + '</p>' +
          '<div class="meta-chips"><span class="chip">' + course.ages + '</span>' +
          '<span class="chip g">' + bnNum((course.lessons || []).length) + 'টি লেসন</span><span class="chip">সার্টিফিকেটসহ</span></div>' +
          priceHtml(course) +
          '<p style="margin:14px 0"><a class="btn lg" href="cart.html" data-add="' + course.id + '">ভর্তি হোন — মাত্র ৳' + course.price + '</a></p>' +
          '<p style="color:var(--muted);font-size:14.5px">পেমেন্ট: বিকাশ <span class="en" style="font-weight:700;color:var(--pink)">' + SSA_DATA.bkashNumber + '</span> — অনুমোদনের পর অ্যাক্সেস চালু হবে।</p></div>';

        var learnEl = document.getElementById("learnList");
        if (learnEl) learnEl.innerHTML = (course.learn || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");

        renderLessons(course);
      }
    }
  }
  window.ssaRenderCatalog = renderCatalog;
  renderCatalog();

  /* FAQ — premium accordion (Founder order 2026-10-23): compact dropdown
     rows, all closed by default; a tap smoothly spreads the answer open.
     Only one answer open at a time, so the section stays small. */
  var faqEl = document.getElementById("faqList");
  if (faqEl) {
    faqEl.innerHTML = SSA_DATA.faq.map(function (f, i) {
      return '<div class="faq-item"' + (f.id ? ' id="' + f.id + '"' : '') + '>' +
        '<button type="button" class="faq-q" aria-expanded="false">' +
          '<span class="faq-n">' + (i + 1) + '</span>' +
          '<span class="faq-qt">' + f.q + '</span>' +
          '<span class="faq-chev" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="faq-a"><p>' + f.a + '</p></div>' +
      '</div>';
    }).join("");
    faqEl.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".faq-q") : null;
      if (!btn) return;
      var item = btn.parentNode;
      var body = item.querySelector(".faq-a");
      var willOpen = !item.classList.contains("open");
      var openItems = faqEl.querySelectorAll(".faq-item.open");
      for (var i = 0; i < openItems.length; i++) {
        openItems[i].classList.remove("open");
        openItems[i].querySelector(".faq-a").style.maxHeight = "0px";
        openItems[i].querySelector(".faq-q").setAttribute("aria-expanded", "false");
      }
      if (willOpen) {
        item.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  /* ---------------- add-to-cart delegation ---------------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute("data-add")) {
        cartAdd(t.getAttribute("data-add"));
        return; /* let the link navigate to cart.html */
      }
      t = t.parentNode;
    }
  });

  /* ---------------- lesson navigation ----------------
     A lesson row with a database id opens lesson.html — but only when it
     is a free preview or has been unlocked for this student (auth.js). */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute("data-lesson-id")) {
        if (t.className === "free" || t.className === "open") {
          window.location.href = "lesson.html?id=" + t.getAttribute("data-lesson-id");
        }
        return;
      }
      t = t.parentNode;
    }
  });

  /* ---------------- slider ---------------- */
  var slider = document.getElementById("slider");
  if (slider) {
    var slides = slider.querySelectorAll(".slide");
    var dotsBox = slider.querySelector(".dots");
    var cur = 0, timer = null;
    for (var d = 0; d < slides.length; d++) {
      var b = document.createElement("button");
      b.className = "dot" + (d === 0 ? " active" : "");
      b.setAttribute("aria-label", "Slide " + (d + 1));
      (function (idx) { b.addEventListener("click", function () { go(idx); restart(); }); })(d);
      dotsBox.appendChild(b);
    }
    var dots = dotsBox.querySelectorAll(".dot");
    function go(n) {
      slides[cur].classList.remove("active"); dots[cur].classList.remove("active");
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add("active"); dots[cur].classList.add("active");
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { stop(); timer = setInterval(function () { go(cur + 1); }, 7000); }
    function restart() { start(); }
    var prevBtn = document.getElementById("slidePrev");
    var nextBtn = document.getElementById("slideNext");
    if (prevBtn) prevBtn.addEventListener("click", function () { go(cur - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { go(cur + 1); restart(); });
    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", start);
    var tx = null;
    slider.addEventListener("touchstart", function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
    slider.addEventListener("touchend", function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) { go(dx < 0 ? cur + 1 : cur - 1); restart(); }
      tx = null;
    }, { passive: true });
    start();
  }

  /* ---------------- scroll reveal ----------------
     Elements with class "reveal" fade/slide in once when they enter the
     viewport. Without IntersectionObserver they simply stay visible. */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    document.documentElement.classList.add("io-on");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    for (var r = 0; r < revealEls.length; r++) io.observe(revealEls[r]);
  }

  /* ---------------- header search ---------------- */
  var searchBtn = document.querySelector(".search-btn");
  if (searchBtn) {
    var headerEl = document.querySelector(".site-header");
    var sp = document.createElement("div");
    sp.className = "search-panel";
    sp.innerHTML = '<div class="sp-in"><input type="text" placeholder="কোর্স বা পণ্য খুঁজুন…" aria-label="Search">' +
      '<div class="search-results"></div></div>';
    headerEl.parentNode.insertBefore(sp, headerEl.nextSibling);
    var spInput = sp.querySelector("input");
    var spResults = sp.querySelector(".search-results");
    spInput.addEventListener("input", function () {
      var q = spInput.value.replace(/^\s+|\s+$/g, "").toLowerCase();
      if (!q) { spResults.innerHTML = ""; return; }
      var hits = SSA_DATA.courses.concat(SSA_DATA.products).filter(function (it) {
        return it.title.toLowerCase().indexOf(q) !== -1 || it.titleBn.indexOf(q) !== -1;
      });
      spResults.innerHTML = hits.length ? hits.map(function (it) {
        return '<a href="' + it.page + '"><span>' + it.title + '</span><b>৳' + it.price + '</b></a>';
      }).join("") : '<p class="search-none">কিছু পাওয়া যায়নি — অন্য নামে চেষ্টা করুন।</p>';
    });
    searchBtn.addEventListener("click", function () {
      sp.classList.toggle("open");
      if (sp.classList.contains("open")) spInput.focus();
    });
  }

  /* ---------------- mobile nav ---------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) toggle.addEventListener("click", function () { nav.classList.toggle("open"); });
  /* Login / Dashboard header state is handled by auth.js (Phase 2). */

})();

/* ===== Support link + announcement bar (Phase 9) =====
   Every page gets a সাপোর্ট link in its main nav; the announcement text
   comes from Admin → সেটিংস (site_settings) and appears site-wide. */
(function () {
  function addSupportLink() {
    var nav = document.querySelector(".main-nav");
    if (!nav || nav.querySelector('a[href="support.html"]')) return;
    var a = document.createElement("a");
    a.href = "support.html";
    a.textContent = "সাপোর্ট";
    nav.appendChild(a);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addSupportLink);
  } else { addSupportLink(); }

  var shown = false;
  function showAnnouncement() {
    if (shown) return;
    var text = window.SSA_SETTINGS && window.SSA_SETTINGS.announcement;
    if (!text) return;
    shown = true;
    var bar = document.createElement("div");
    bar.setAttribute("style", "background:var(--pink);color:#fff;text-align:center;" +
      "padding:9px 14px;font-weight:600;font-size:15.5px");
    bar.textContent = "📢 " + text;
    document.body.insertBefore(bar, document.body.firstChild);
  }
  window.addEventListener("ssaSettingsLoaded", showAnnouncement);
  window.addEventListener("load", function () { setTimeout(showAnnouncement, 1200); });
})();
/* ===== Install as mobile app (PWA) — Founder order 2026-10-22 =====
   Students, guardians and teachers can install the Academy on their phone
   home screen from one tap: Android shows an install bar with a button;
   iPhone shows the Share → "Add to Home Screen" instruction. The service
   worker (sw.js) makes repeat visits fast; live data is never cached. */
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  var standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (standalone) return;
  try {
    if (localStorage.getItem("ssa_install_dismissed") === "1") return;
  } catch (e) {}
  var deferred = null;
  var bar = null;
  function closeBar() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    try { localStorage.setItem("ssa_install_dismissed", "1"); } catch (e) {}
  }
  function showBar(isIOS) {
    if (bar) return;
    bar = document.createElement("div");
    bar.setAttribute("style", "display:flex;align-items:center;gap:10px;" +
      "background:#fff0f6;border-bottom:2px solid #E2136E;padding:8px 12px;" +
      "font-family:'Hind Siliguri',sans-serif;font-size:15px;color:#333;");
    var txt = document.createElement("span");
    txt.style.flex = "1";
    if (isIOS) {
      txt.innerHTML = "📲 এই ওয়েবসাইটটি <b>অ্যাপ হিসেবে ইনস্টল করুন</b> — " +
        "Share বোতাম চেপে <b>Add to Home Screen</b> সিলেক্ট করুন।";
      bar.appendChild(txt);
    } else {
      txt.innerHTML = "📲 <b>Self Scale Academy অ্যাপ</b> — এক ট্যাপে ফোনে " +
        "ইনস্টল করুন, হোম স্ক্রিন থেকে সরাসরি খুলবে।";
      var btn = document.createElement("button");
      btn.textContent = "ইনস্টল করুন";
      btn.setAttribute("style", "background:#E2136E;color:#fff;border:0;" +
        "border-radius:999px;padding:8px 16px;font-family:inherit;" +
        "font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;");
      btn.addEventListener("click", function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; closeBar(); });
      });
      bar.appendChild(txt);
      bar.appendChild(btn);
    }
    var x = document.createElement("button");
    x.textContent = "✕";
    x.setAttribute("aria-label", "বন্ধ করুন");
    x.setAttribute("style", "background:none;border:0;font-size:16px;" +
      "cursor:pointer;color:#888;padding:4px 6px;");
    x.addEventListener("click", closeBar);
    bar.appendChild(x);
    document.body.insertBefore(bar, document.body.firstChild);
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    showBar(false);
  });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) window.addEventListener("load", function () { showBar(true); });
})();
