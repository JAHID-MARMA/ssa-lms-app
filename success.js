/* Purchase success experience — separate file so an auth.js error can never block it. */
/* ---------- purchase success experience (Founder order, 2026-10-22) ----------
   After a payment is approved and the enrollment lands, the student must
   KNOW it instantly: a celebration popup with a big green start button,
   green "purchased" buttons on course cards, and a big green start
   button on the course page itself. Shown once per purchase. */
(function boot(tries) {
  if (!window.SSA_AUTH) {
    if ((tries || 0) < 40) setTimeout(function () { boot((tries || 0) + 1); }, 250);
    return;
  }

  function courseUrl(slug) {
    if (slug === "spoken") return "course-spoken.html";
    if (slug === "phonics") return "course-phonics.html";
    return "course.html?slug=" + encodeURIComponent(slug);
  }
  function itemOf(slug) {
    try { return typeof ssaFindItem === "function" ? ssaFindItem(slug) : null; }
    catch (e) { return null; }
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function seenList() {
    try { return JSON.parse(localStorage.getItem("ssa_seen_enr") || "[]"); } catch (e) { return []; }
  }
  function markSeen(slugs) {
    try {
      var seen = seenList();
      slugs.forEach(function (x) { if (seen.indexOf(x) < 0) seen.push(x); });
      localStorage.setItem("ssa_seen_enr", JSON.stringify(seen));
    } catch (e) {}
  }

  function showPopup(rows) {
    if (document.getElementById("ssaPop")) return;
    var html = '<div class="ssa-pop">' +
      '<div class="ssa-pop-check">✓</div>' +
      '<h3>অভিনন্দন! আপনার কেনা সম্পন্ন হয়েছে 🎉</h3>' +
      '<p>আপনার পেমেন্ট নিশ্চিত হয়েছে — এখনই শেখা শুরু করুন।</p>';
    rows.forEach(function (row) {
      var it = itemOf(row.course_slug);
      var title = it ? it.title : row.course_slug;
      var cover = it && it.cover ? '<img src="' + esc(it.cover) + '" alt="">' : "";
      var isCourse = it ? it.type === "course" : true;
      var href = isCourse ? courseUrl(row.course_slug) : "dashboard.html";
      var label = isCourse ? "▶ কোর্স শুরু করুন" : "▶ ড্যাশবোর্ডে যান";
      html += '<div class="ssa-pop-row">' + cover + '<b>' + esc(title) + '</b>' +
        '<a class="btn-start" href="' + href + '">' + label + '</a></div>';
    });
    html += '<button type="button" class="ssa-pop-close" id="ssaPopClose">পরে দেখব</button></div>';
    var ov = document.createElement("div");
    ov.className = "ssa-pop-overlay";
    ov.id = "ssaPop";
    ov.innerHTML = html;
    document.body.appendChild(ov);
    function close() {
      markSeen(rows.map(function (r) { return r.course_slug; }));
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    ov.querySelector("#ssaPopClose").addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelectorAll(".btn-start").forEach(function (a) {
      a.addEventListener("click", function () {
        markSeen(rows.map(function (r) { return r.course_slug; }));
      });
    });
  }
  window.SSA_purchasePopup = showPopup;

  function swapButtons(rows) {
    rows.forEach(function (row) {
      var it = itemOf(row.course_slug);
      var isCourse = it ? it.type === "course" : true;
      document.querySelectorAll('a[data-add="' + row.course_slug + '"]').forEach(function (a) {
        a.setAttribute("href", isCourse ? courseUrl(row.course_slug) : "dashboard.html");
        a.textContent = isCourse ? "✅ কেনা হয়েছে — কোর্সে যান" : "✅ কেনা হয়েছে — ড্যাশবোর্ডে যান";
        a.classList.add("green");
        a.removeAttribute("data-add");
      });
    });
  }

  function heroStart(slug) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var list = document.getElementById("lessonList");
      if (list && !document.getElementById("heroStart")) {
        var box = document.createElement("div");
        box.className = "hero-start";
        box.id = "heroStart";
        box.innerHTML = '<a class="btn-start big" href="#lessonList">▶ লেসন শুরু করুন</a>' +
          '<p style="color:var(--muted);margin-top:8px">আপনি এই কোর্সে ভর্তি আছেন — সব লেসন খোলা আছে।</p>';
        list.parentNode.insertBefore(box, list);
        clearInterval(iv);
      }
      if (tries > 14) clearInterval(iv);
    }, 400);
  }

  function markActiveNav() {
    try {
      var page = (window.location.pathname.split("/").pop() || "index.html");
      document.querySelectorAll(".main-nav a").forEach(function (a) {
        var href = (a.getAttribute("href") || "").split("?")[0];
        if (href === page || (page === "" && href === "index.html")) a.classList.add("active");
      });
    } catch (e) {}
  }

  window.SSA_AUTH.ready.then(function () {
    markActiveNav();
    var user = window.SSA_AUTH.getUser();
    if (!user || !window.SSA_DB) return;
    window.SSA_DB.from("enrollments")
      .select("course_slug,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(function (r) {
        if (!r || r.error || !r.data) return;
        var rows = r.data;
        if (!rows.length) return;
        swapButtons(rows);
        var n = 0;
        var iv = setInterval(function () { swapButtons(rows); if (++n > 5) clearInterval(iv); }, 900);
        var hero = document.getElementById("courseHero");
        if (hero) {
          var slug = hero.getAttribute("data-course");
          if (slug && rows.some(function (x) { return x.course_slug === slug; })) heroStart(slug);
        }
        var seen = seenList();
        var unseen = rows.filter(function (x) { return seen.indexOf(x.course_slug) < 0; });
        if (unseen.length && !document.getElementById("courseHero")) showPopup(unseen.slice(0, 3));
        if (unseen.length && document.getElementById("courseHero")) markSeen(unseen.map(function (x) { return x.course_slug; }));
      }, function () {});
  });
})(0);
