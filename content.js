/* Self Scale Academy — Phase 4: runtime catalog from the database.
   The site ALWAYS renders first from the static data.js (identical to v3).
   When Supabase answers, the published courses + their lessons are merged
   into SSA_DATA.courses (same shape) and the page re-renders, so the
   Founder can add / edit courses from the Admin panel without touching
   code. On ANY failure (offline, no client, empty result) the static
   content stays exactly as-is. */
(function () {
  "use strict";

  window.SSA_CATALOG_DONE = false;

  function finish() {
    window.SSA_CATALOG_DONE = true;
    try {
      window.dispatchEvent(new Event("ssaCatalogLoaded"));
    } catch (e) { /* older browser — pages also poll SSA_CATALOG_DONE */ }
  }

  function coverUrl(row) {
    var c = row.cover_url || "";
    if (!c) return "assets/logo.png";
    if (c.indexOf("http://") === 0 || c.indexOf("https://") === 0) return c;
    if (c.indexOf("assets/") === 0) return c;
    try {
      return window.SSA_DB.storage.from("public-assets").getPublicUrl(c).data.publicUrl;
    } catch (e) {
      return c;
    }
  }

  function pageFor(slug) {
    if (slug === "spoken") return "course-spoken.html";
    if (slug === "phonics") return "course-phonics.html";
    return "course.html?slug=" + encodeURIComponent(slug);
  }

  function mapCourse(row, lessonsBySlug) {
    var lessons = (lessonsBySlug[row.slug] || []).map(function (l) {
      return { id: l.id, title: l.title, desc: l.descr || "", is_preview: !!l.is_preview };
    });
    return {
      id: row.slug,
      type: "course",
      title: row.title,
      titleBn: row.title_bn || "",
      price: row.price,
      regular: row.regular,
      cover: coverUrl(row),
      page: pageFor(row.slug),
      cta: "ভর্তি হোন",
      ages: row.ages || "",
      learn: (row.learn && row.learn.length) ? row.learn : [],
      lessons: lessons
    };
  }

  /* lessons === null means the lessons query FAILED: then keep the static
     lesson lists of courses we already know rather than blanking them. */
  function merge(rows, lessons) {
    var bySlug = {};
    if (lessons) {
      lessons.forEach(function (l) {
        if (!bySlug[l.course_slug]) bySlug[l.course_slug] = [];
        bySlug[l.course_slug].push(l);
      });
    }
    rows.forEach(function (row) {
      var nc = mapCourse(row, bySlug);
      var idx = -1;
      for (var i = 0; i < SSA_DATA.courses.length; i++) {
        if (SSA_DATA.courses[i].id === nc.id) { idx = i; break; }
      }
      if (idx >= 0) {
        if (!lessons && !nc.lessons.length && SSA_DATA.courses[idx].lessons) {
          nc.lessons = SSA_DATA.courses[idx].lessons;
        }
        SSA_DATA.courses[idx] = nc;
      } else {
        SSA_DATA.courses.push(nc);
      }
    });
  }

  function rerender() {
    if (typeof window.ssaRenderCatalog === "function") {
      try { window.ssaRenderCatalog(); } catch (e) {}
    }
    if (typeof window.ssaRenderCart === "function") {
      try { window.ssaRenderCart(); } catch (e) {}
    }
  }

  if (!window.SSA_DB) { finish(); return; }

  window.SSA_DB.from("courses")
    .select("*")
    .eq("published", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true })
    .then(function (r) {
      if (r.error || !r.data || !r.data.length) { finish(); return null; }
      var rows = r.data;
      var slugs = rows.map(function (c) { return c.slug; });
      return window.SSA_DB.from("lessons")
        .select("id, course_slug, position, title, descr, is_preview")
        .in("course_slug", slugs)
        .order("position", { ascending: true })
        .then(function (lr) {
          if (!lr.error && lr.data) merge(rows, lr.data);
          else merge(rows, null);
          rerender();
          finish();
          return null;
        }, function () {
          merge(rows, null);
          rerender();
          finish();
          return null;
        });
    }, function () { finish(); })
    .then(null, function () { finish(); });

  /* ---- Phase 9: products + site settings (editable from Admin) ---- */
  function applySettings(s) {
    window.SSA_SETTINGS = s || {};
    if (s.bkash_number) SSA_DATA.bkashNumber = s.bkash_number;
    if (s.whatsapp_number) SSA_DATA.whatsappNumber = s.whatsapp_number;
    var bk = document.querySelectorAll(".bkash");
    for (var i = 0; i < bk.length; i++) {
      if (s.bkash_number) bk[i].textContent = s.bkash_number;
    }
    if (s.whatsapp_number) {
      var wa = document.querySelectorAll('a[href*="wa.me/"]');
      for (var j = 0; j < wa.length; j++) {
        wa[j].href = "https://wa.me/880" + String(s.whatsapp_number).replace(/^0/, "");
        if (wa[j].textContent.indexOf("017") === 0) wa[j].textContent = s.whatsapp_number;
      }
    }
    try { window.dispatchEvent(new Event("ssaSettingsLoaded")); } catch (e) {}
  }

  function mapProduct(row) {
    var covers = { packs: "assets/cover-packs.jpg", ebook: "assets/cover-ebook.jpg" };
    return {
      id: row.slug,
      type: "product",
      title: row.title,
      titleBn: row.title_bn || "",
      price: row.price,
      regular: row.regular,
      cover: covers[row.slug] || "assets/logo.png",
      page: "courses.html#card-" + row.slug,
      cta: "অর্ডার করুন",
      descr: row.descr || "",
      filePath: row.file_path || ""
    };
  }

  window.SSA_DB.from("products")
    .select("*")
    .eq("published", true)
    .order("sort", { ascending: true })
    .then(function (r) {
      if (!r.error && r.data && r.data.length) {
        window.SSA_PRODUCTS = {};
        r.data.forEach(function (row) {
          var np = mapProduct(row);
          window.SSA_PRODUCTS[row.slug] = row;
          var idx = -1;
          for (var i = 0; i < SSA_DATA.products.length; i++) {
            if (SSA_DATA.products[i].id === np.id) { idx = i; break; }
          }
          if (idx >= 0) SSA_DATA.products[idx] = np; else SSA_DATA.products.push(np);
        });
        rerender();
      }
      return window.SSA_DB.from("site_settings").select("key, value");
    }, function () { return null; })
    .then(function (r) {
      if (r && !r.error && r.data) {
        var s = {};
        r.data.forEach(function (row) { s[row.key] = row.value; });
        applySettings(s);
      }
    }, function () {});
})();
