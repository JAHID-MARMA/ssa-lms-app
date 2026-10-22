/* Self Scale Academy — site notices (Founder order 2026-10-22).
   Fills the footer notice board + the scrolling update ticker on every page
   from the Supabase table `site_notices` (active rows only, managed by the
   Super Admin in the Settings tab). If there are no notices, the ticker
   keeps its built-in welcome messages and the notice box stays hidden. */
(function () {
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString("en-GB"); } catch (e) { return ""; }
  }
  function render(rows) {
    if (!rows || !rows.length) return;
    var track = document.querySelector("[data-notice-ticker]");
    if (track) {
      var seq = rows.map(function (r) {
        return '<span class="ticker-item">' + esc(r.title) + (r.detail ? ' — ' + esc(r.detail) : '') + '</span><span class="ticker-sep">✦</span>';
      }).join("");
      track.innerHTML = seq + seq; /* duplicated for a seamless loop */
    }
    var box = document.querySelector("[data-notice-box]");
    var list = document.querySelector("[data-notice-list]");
    if (box && list) {
      list.innerHTML = rows.slice(0, 3).map(function (r) {
        return '<li><span class="notice-date">' + fmtDate(r.created_at) + '</span><span class="notice-text"><b>' + esc(r.title) + '</b>' + (r.detail ? ' — ' + esc(r.detail) : '') + '</span></li>';
      }).join("");
      box.style.display = "";
    }
  }
  window.SSA_renderNotices = render;
  function waitDb(n) {
    if (window.SSA_DB && typeof window.SSA_DB.from === "function") {
      window.SSA_DB.from("site_notices").select("title,detail,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(8)
        .then(function (r) { if (r && r.data) render(r.data); }, function () {});
      return;
    }
    if ((n || 0) < 40) setTimeout(function () { waitDb((n || 0) + 1); }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { waitDb(0); });
  else waitDb(0);
})();
