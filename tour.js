/* Self Scale Academy — first-visitor guided tour (Founder order 2026-10-22).
   Shows ONCE per device: a welcome popup offering a short tour of how to use
   the site, with a Skip option at every step. Never shows again afterwards. */
(function () {
  var LS = "ssa_tour_done";
  try { if (localStorage.getItem(LS)) return; } catch (e) { return; }
  function done() { try { localStorage.setItem(LS, "1"); } catch (e) {} }
  function esc(t) { return String(t == null ? "" : t); }

  var STEPS = [
    { sel: ".main-nav a[href='courses.html']", title: "📚 সব কোর্স এখানে", text: "Spoken English, Phonics — সব কোর্স ও পণ্য এই মেনুতে পাবেন।" },
    { sel: ".slide-cap .btn", title: "🛒 ভর্তি ও অর্ডার", text: "প্রতিটি কোর্সের কার্ডে ও এখানে ভর্তি/অর্ডার বাটন আছে — বিকাশে পেমেন্ট করে ফর্ম জমা দিলেই অর্ডার হয়ে যাবে।" },
    { sel: "#ssaLoginLink", title: "🔐 Login / Dashboard", text: "কেনার পর Login করে Dashboard-এ আপনার সব কোর্স, অগ্রগতি ও সার্টিফিকেট পাবেন।" },
    { sel: ".notice-ticker", title: "📢 আপডেট ও নোটিশ", text: "সব খবর, শুভেচ্ছা ও নোটিশ এই স্ক্রলিং বারে আর Footer-এর নোটিশ বোর্ডে পাবেন।" },
    { sel: null, title: "🤖 সাহায্য লাগলে — Ask Nowshin", text: "ডানদিকের নিচের Ask Nowshin বাটনে যেকোনো প্রশ্ন করুন — আমাদের Customer Manager সঙ্গে সঙ্গে উত্তর দেবে। ট্যুর শেষ — শুভ শিক্ষা! 🎉" }
  ];

  var shade = null, card = null, hi = null, idx = 0;
  function cleanup() {
    [shade, card].forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    if (hi) { hi.classList.remove("tour-hi"); hi = null; }
    shade = card = null;
  }
  function finish() { done(); cleanup(); }
  function place(target) {
    if (!card) return;
    var mobile = window.innerWidth < 760;
    if (!target || mobile) {
      card.style.left = "50%"; card.style.top = "auto"; card.style.bottom = "18px"; card.style.transform = "translateX(-50%)";
      return;
    }
    var r = target.getBoundingClientRect();
    card.style.transform = "none";
    card.style.bottom = "auto";
    var top = r.bottom + 14, left = Math.min(Math.max(r.left, 12), window.innerWidth - 352);
    if (top + 190 > window.innerHeight) top = Math.max(r.top - 200, 12);
    card.style.left = left + "px"; card.style.top = top + "px";
  }
  function showStep(i) {
    idx = i;
    var step = STEPS[i];
    if (hi) { hi.classList.remove("tour-hi"); hi = null; }
    var target = step.sel ? document.querySelector(step.sel) : null;
    if (target) {
      hi = target; target.classList.add("tour-hi");
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setTimeout(function () { place(target); }, 350);
    card.querySelector(".tour-title").textContent = step.title;
    card.querySelector(".tour-text").textContent = step.text;
    card.querySelector(".tour-count").textContent = "ধাপ " + (i + 1) + " / " + STEPS.length;
    card.querySelector(".tour-next").textContent = i === STEPS.length - 1 ? "✔ শেষ করুন" : "পরের ধাপ →";
    card.querySelector(".tour-back").style.visibility = i === 0 ? "hidden" : "visible";
  }
  function startTour() {
    shade = document.createElement("div"); shade.className = "tour-shade";
    card = document.createElement("div"); card.className = "tour-card";
    card.innerHTML =
      '<div class="tour-count"></div><h3 class="tour-title"></h3><p class="tour-text"></p>' +
      '<div class="tour-btns"><button type="button" class="tour-skip">এড়িয়ে যান (Skip)</button>' +
      '<span class="tour-nav"><button type="button" class="tour-back">← আগে</button>' +
      '<button type="button" class="tour-next"></button></span></div>';
    document.body.appendChild(shade); document.body.appendChild(card);
    card.querySelector(".tour-skip").addEventListener("click", finish);
    card.querySelector(".tour-back").addEventListener("click", function () { if (idx > 0) showStep(idx - 1); });
    card.querySelector(".tour-next").addEventListener("click", function () {
      if (idx >= STEPS.length - 1) finish(); else showStep(idx + 1);
    });
    shade.addEventListener("click", function () { /* shade does not dismiss — Skip does */ });
    showStep(0);
  }
  function invite() {
    var pop = document.createElement("div");
    pop.className = "tour-invite";
    pop.innerHTML =
      '<div class="tour-invite-card">' +
        '<div style="font-size:34px">👋</div>' +
        '<h3>Self Scale Academy-তে স্বাগতম!</h3>' +
        '<p>সাইটটি কীভাবে ব্যবহার করবেন — মাত্র ১ মিনিটের ছোট্ট ট্যুরে দেখে নিন।</p>' +
        '<div class="tour-btns center"><button type="button" class="tour-go">▶ ট্যুর শুরু করুন</button>' +
        '<button type="button" class="tour-skip">এড়িয়ে যান (Skip)</button></div>' +
      '</div>';
    document.body.appendChild(pop);
    pop.querySelector(".tour-go").addEventListener("click", function () {
      pop.parentNode.removeChild(pop); startTour();
    });
    pop.querySelector(".tour-skip").addEventListener("click", function () {
      done(); pop.parentNode.removeChild(pop);
    });
  }
  function init() { setTimeout(invite, 900); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
