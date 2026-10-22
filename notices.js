/* Self Scale Academy — Notices v2 (Founder redesign 2026-10-22).
   A small notice icon sits at the lower-left side. Clicking it opens the
   notice board. When a visitor reaches the footer and STAYS to read, the
   board also glides in from the left by itself — premium, glassy, green —
   and stays while they are there. If they do not stay, it never comes.
   Notices come from Supabase `site_notices` (Super Admin → Settings). */
(function () {
  var DEFAULTS = [
    { title: "Self Scale Academy-তে স্বাগতম!", detail: "Explore Yourself — নিজেকে আবিষ্কার করো, ধাপে ধাপে বড় হও।", created_at: null },
    { title: "ভর্তি চলছে — Spoken English ও Phonics কোর্সে", detail: "মাত্র ৳৪৯৯ করে! আজই ভর্তি হোন।", created_at: null }
  ];
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleDateString("en-GB") : ""; } catch (e) { return ""; } }

  var fab = null, panel = null, autoShown = false, suppressed = false, dwellTimer = null;

  function build() {
    fab = document.createElement("button");
    fab.className = "notice-fab"; fab.type = "button";
    fab.setAttribute("aria-label", "নোটিশ বোর্ড খুলুন");
    fab.innerHTML = "📋<span class=\"notice-fab-dot\" style=\"display:none\"></span>";
    panel = document.createElement("div");
    panel.className = "notice-panel";
    panel.innerHTML =
      '<div class="notice-panel-head"><span>📋 নোটিশ বোর্ড</span>' +
      '<button type="button" class="notice-panel-close" aria-label="বন্ধ করুন">✕</button></div>' +
      '<ul class="notice-panel-list"></ul>' +
      '<p class="notice-panel-foot">সব আপডেট ও শুভেচ্ছা এখানেই পাবেন 💚</p>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    fab.addEventListener("click", function () { toggle(); });
    panel.querySelector(".notice-panel-close").addEventListener("click", function () {
      suppressed = true; close();
    });
    render(DEFAULTS);
    watchFooter();
  }
  function open() { if (panel) panel.classList.add("open"); }
  function close() { if (panel) panel.classList.remove("open"); }
  function toggle() { if (!panel) return; suppressed = false; panel.classList.toggle("open"); }
  function render(rows) {
    if (!panel) return;
    var list = panel.querySelector(".notice-panel-list");
    var use = rows && rows.length ? rows : DEFAULTS;
    list.innerHTML = use.slice(0, 5).map(function (r) {
      var d = fmtDate(r.created_at);
      return '<li>' + (d ? '<span class="np-date">' + d + '</span>' : '') +
        '<span class="np-text"><b>' + esc(r.title) + '</b>' + (r.detail ? '<br>' + esc(r.detail) : '') + '</span></li>';
    }).join("");
    var dot = fab.querySelector(".notice-fab-dot");
    if (dot) dot.style.display = rows && rows.length ? "" : "none";
  }
  window.SSA_renderNotices = render;

  /* Glide in only when the visitor reaches the footer AND stays to read. */
  function watchFooter() {
    var footer = document.querySelector(".site-footer");
    if (!footer || !("IntersectionObserver" in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (autoShown || suppressed) return;
          dwellTimer = setTimeout(function () {
            if (!suppressed) { autoShown = true; open(); }
          }, 1200);
        } else {
          if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
          if (autoShown) { close(); autoShown = false; }
        }
      });
    }, { threshold: 0.35 });
    obs.observe(footer);
  }

  function waitDb(n) {
    if (window.SSA_DB && typeof window.SSA_DB.from === "function") {
      window.SSA_DB.from("site_notices").select("title,detail,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(8)
        .then(function (r) { if (r && r.data && r.data.length) render(r.data); }, function () {});
      return;
    }
    if ((n || 0) < 40) setTimeout(function () { waitDb((n || 0) + 1); }, 250);
  }
  function init() { build(); waitDb(0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
