/* Self Scale Academy — Super Admin panel (Phase 3).
   Gate (Phase 5): role "admin" = Super Admin; role "staff" = the
   Founder's Assigned person (panel access, no deletes, no role edits).
   The UI gate is only a second layer — Supabase RLS is what actually
   lets each role read/write the rows it may, and blocks everyone else.
   Sections: all orders (approve / reject), all customers, course access
   (assign manually + revoke). All data rendered with escaping. */
(function () {
  "use strict";

  var gateEl = document.getElementById("adminGate");
  var appEl = document.getElementById("adminApp");
  var ordersWrap = document.getElementById("ordersWrap");
  var ordersMsg = document.getElementById("ordersMsg");
  var customersWrap = document.getElementById("customersWrap");
  var customersMsg = document.getElementById("customersMsg");
  var accessWrap = document.getElementById("accessWrap");
  var assignForm = document.getElementById("assignForm");
  var assignUser = document.getElementById("assignUser");
  var assignCourse = document.getElementById("assignCourse");
  var assignBtn = document.getElementById("assignBtn");
  var assignMsg = document.getElementById("assignMsg");

  /* Course slugs that create an enrollment on Approve. Starts as the
     Phase 3 fallback; the gate replaces it with the live list from the
     courses table, so courses the Founder adds later approve correctly. */
  var COURSE_SLUGS = { spoken: true, phonics: true };
  function loadCourseSlugs() {
    return window.SSA_DB.from("courses").select("slug,title")
      .then(function (r) {
        if (!r.error && r.data && r.data.length) {
          var map = {};
          r.data.forEach(function (c) { map[c.slug] = true; });
          COURSE_SLUGS = map;
          /* The manual Assign-Access course list follows the same live
             course list, so a course the Founder adds can be assigned
             by hand too (CEO audit fix, Phase 4). */
          if (assignCourse) {
            assignCourse.innerHTML = r.data.map(function (c) {
              return '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.title) + '</option>';
            }).join("");
          }
        }
        return null;
      }, function () { return null; });
  }
  var ordersCache = [];
  var customersCache = [];

  /* Phase 5 roles: "admin" = Super Admin (Founder — everything,
     including deletes and role assignment); "staff" = the Founder's
     Assigned person (full panel, but NO deletes and NO role changes —
     the database refuses those for staff too; the UI just hides them).
     IS_SUPER / MY_ID are set by the gate before anything loads. */
  var IS_SUPER = false;
  var MY_ID = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return escapeHtml(iso);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function statusTag(st) {
    if (st === "pending") return '<span class="tag tag-pend">অনুমোদনের অপেক্ষায়</span>';
    if (st === "approved" || st === "completed") return '<span class="tag tag-ok">অনুমোদিত</span>';
    if (st === "rejected" || st === "cancelled" || st === "canceled") return '<span class="tag tag-bad">বাতিল</span>';
    return '<span class="tag tag-pend">' + escapeHtml(st || "pending") + '</span>';
  }
  function courseTitle(slug) {
    var it = (typeof ssaFindItem === "function") ? ssaFindItem(slug) : null;
    return it ? it.title : slug;
  }
  function showMsg(el, text, ok) {
    el.textContent = text;
    el.className = "admin-msg " + (ok ? "ok" : "err");
    el.style.display = "";
  }
  function gateMessage(html) {
    gateEl.innerHTML = '<section class="panel"><p class="empty-note">' + html + '</p></section>';
  }

  /* ---------------- orders ---------------- */
  function loadOrders() {
    window.SSA_DB.from("orders").select("*").order("created_at", { ascending: false })
      .then(function (r) {
        if (r.error) {
          ordersWrap.innerHTML = '<p class="empty-note">অর্ডারের তালিকা লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>';
          return;
        }
        ordersCache = r.data || [];
        renderOrders();
      }, function () {
        ordersWrap.innerHTML = '<p class="empty-note">অর্ডারের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  function renderOrders() {
        var rows = ordersCache.filter(function (o) {
          return dateInRange(o.created_at, reportFilters.orders);
        });
        setFilterCount("orders", "সময়কাল: " + periodText(reportFilters.orders) +
          " — মোট " + rows.length + "টি অর্ডার দেখানো হচ্ছে (সবমোট " + ordersCache.length + "টি)");
        if (!ordersCache.length) {
          ordersWrap.innerHTML = '<p class="empty-note">এখনো কোনো অর্ডার নেই।</p>';
          return;
        }
        if (!rows.length) {
          ordersWrap.innerHTML = '<p class="empty-note">এই সময়ে কোনো অর্ডার নেই। অন্য সময়কাল বেছে দেখুন।</p>';
          return;
        }
        var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>তারিখ</th><th>নাম</th><th>মোবাইল</th><th>ইউজারনেম</th><th>পণ্য</th>' +
          '<th>মোট</th><th>বিকাশ নম্বর</th><th>TrxID</th><th>স্ট্যাটাস</th><th></th>' +
          '</tr></thead><tbody>';
        html += rows.map(function (o) {
          var titles = (o.items || []).map(function (it) {
            return escapeHtml(it.title || it.slug || "");
          }).join(", ");
          var actions = "";
          if (o.status === "pending") {
            actions = '<button class="btn sm" type="button" data-act="approve" data-id="' + o.id + '">Approve</button> ' +
              '<button class="btn sm neutral" type="button" data-act="reject" data-id="' + o.id + '">Reject</button>';
          }
          return '<tr><td>' + fmtDate(o.created_at) + '</td>' +
            '<td>' + escapeHtml(o.name) + '</td>' +
            '<td class="en">' + escapeHtml(o.mobile) + '</td>' +
            '<td class="en">' + escapeHtml(o.username) + '</td>' +
            '<td>' + titles + '</td>' +
            '<td class="en">৳' + escapeHtml(o.total) + '</td>' +
            '<td class="en">' + escapeHtml(o.bkash_sender) + '</td>' +
            '<td class="en">' + escapeHtml(o.trxid) + '</td>' +
            '<td>' + statusTag(o.status) + '</td>' +
            '<td class="row-actions">' + actions + '</td></tr>';
        }).join("");
        html += '</tbody></table></div>';
        ordersWrap.innerHTML = html;
  }

  function findOrder(id) {
    for (var i = 0; i < ordersCache.length; i++) {
      if (String(ordersCache[i].id) === String(id)) return ordersCache[i];
    }
    return null;
  }

  function approveOrder(id) {
    var order = findOrder(id);
    window.SSA_DB.from("orders").update({ status: "approved" }).eq("id", id)
      .then(function (r) {
        if (r.error) {
          showMsg(ordersMsg, "অর্ডারটি অনুমোদন করা যায়নি। আবার চেষ্টা করুন।", false);
          return;
        }
        if (!order) { loadOrders(); return; }
        var items = (order.items || []).filter(function (it) {
          return it && COURSE_SLUGS[it.slug];
        });
        if (!items.length) {
          showMsg(ordersMsg, "অর্ডার #" + id + " অনুমোদিত হয়েছে।", true);
          loadOrders();
          return;
        }
        var jobs = items.map(function (it) {
          return window.SSA_DB.from("enrollments").insert({
            user_id: order.user_id,
            username: order.username,
            course_slug: it.slug,
            order_id: order.id
          }).then(function () { return null; }, function () { return null; });
        });
        Promise.all(jobs).then(function () {
          showMsg(ordersMsg, "অর্ডার #" + id + " অনুমোদিত হয়েছে এবং কোর্স অ্যাক্সেস চালু হয়েছে।", true);
          loadOrders();
          loadAccess();
        });
      }, function () {
        showMsg(ordersMsg, "অর্ডারটি অনুমোদন করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
      });
  }

  function rejectOrder(id) {
    window.SSA_DB.from("orders").update({ status: "rejected" }).eq("id", id)
      .then(function (r) {
        if (r.error) {
          showMsg(ordersMsg, "অর্ডারটি বাতিল করা যায়নি। আবার চেষ্টা করুন।", false);
          return;
        }
        showMsg(ordersMsg, "অর্ডার #" + id + " বাতিল করা হয়েছে।", true);
        loadOrders();
      }, function () {
        showMsg(ordersMsg, "অর্ডারটি বাতিল করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
      });
  }

  ordersWrap.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t.getAttribute || !t.getAttribute("data-act")) return;
    var id = t.getAttribute("data-id");
    t.disabled = true;
    if (t.getAttribute("data-act") === "approve") approveOrder(id);
    else rejectOrder(id);
  });

  /* ---------------- customers ---------------- */
  function loadCustomers() {
    window.SSA_DB.from("profiles").select("*")
      .then(function (r) {
        if (r.error) {
          customersWrap.innerHTML = '<p class="empty-note">কাস্টমারের তালিকা লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>';
          return;
        }
        customersCache = r.data || [];
        fillAssignUsers();
        if (!customersCache.length) {
          customersWrap.innerHTML = '<p class="empty-note">এখনো কোনো কাস্টমার নেই।</p>';
          return;
        }
        var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>নাম</th><th>ইউজারনেম</th><th>মোবাইল</th><th>Role</th>' +
          (IS_SUPER ? '<th>রোল বদলান</th>' : '') +
          '</tr></thead><tbody>';
        html += customersCache.map(function (p) {
          var row = '<tr><td>' + escapeHtml(p.name) + '</td>' +
            '<td class="en">' + escapeHtml(p.username) + '</td>' +
            '<td class="en">' + escapeHtml(p.mobile) + '</td>' +
            '<td class="en">' + escapeHtml(p.role || "student") + '</td>';
          if (IS_SUPER) {
            var cur = p.role || "student";
            var opts = ["student", "staff", "admin"].map(function (r) {
              return '<option value="' + r + '"' + (r === cur ? " selected" : "") + '>' + r + '</option>';
            }).join("");
            if (String(p.id) === String(MY_ID)) {
              row += '<td><select disabled>' + opts + '</select><br>' +
                '<small style="color:var(--muted)">নিজের রোল বদলানো যাবে না</small></td>';
            } else {
              row += '<td class="row-actions"><select data-role-sel="' + escapeHtml(p.id) + '">' + opts + '</select> ' +
                '<button class="btn sm" type="button" data-save-role="' + escapeHtml(p.id) + '">রোল সেভ</button></td>';
            }
          }
          return row + '</tr>';
        }).join("");
        html += '</tbody></table></div>';
        customersWrap.innerHTML = html;
      }, function () {
        customersWrap.innerHTML = '<p class="empty-note">কাস্টমারের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  function fillAssignUsers() {
    if (!customersCache.length) {
      assignUser.innerHTML = '<option value="">কোনো কাস্টমার নেই</option>';
      return;
    }
    assignUser.innerHTML = customersCache.map(function (p) {
      var label = (p.username || "") + (p.name ? " — " + p.name : "");
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(label) + '</option>';
    }).join("");
  }

  /* Phase 5: role assignment — Super Admin only (the controls are not
     even rendered for staff, and RLS refuses role writes for them).
     The signed-in admin's own row is locked (see loadCustomers) so the
     Founder can never lock himself out by accident. */
  customersWrap.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t.getAttribute || !t.getAttribute("data-save-role")) return;
    var id = t.getAttribute("data-save-role");
    var sel = customersWrap.querySelector('select[data-role-sel="' + id + '"]');
    if (!sel) return;
    var role = sel.value;
    t.disabled = true;
    window.SSA_DB.from("profiles").update({ role: role }).eq("id", id)
      .then(function (r) {
        t.disabled = false;
        if (r.error) {
          showMsg(customersMsg, "রোলটি সেভ করা যায়নি। আবার চেষ্টা করুন।", false);
          return;
        }
        showMsg(customersMsg, "রোল সেভ হয়েছে — এখন থেকে এই অ্যাকাউন্টের রোল: " + role, true);
        loadCustomers();
      }, function () {
        t.disabled = false;
        showMsg(customersMsg, "রোলটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
      });
  });

  /* ---------------- course access ---------------- */
  function loadAccess() {
    window.SSA_DB.from("enrollments").select("*")
      .then(function (r) {
        if (r.error) {
          accessWrap.innerHTML = '<p class="empty-note">অ্যাক্সেসের তালিকা লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>';
          return;
        }
        var rows = r.data || [];
        if (!rows.length) {
          accessWrap.innerHTML = '<p class="empty-note">এখনো কাউকে কোনো কোর্সের অ্যাক্সেস দেওয়া হয়নি।</p>';
          return;
        }
        var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>ইউজারনেম</th><th>কোর্স</th><th>অর্ডার আইডি</th><th>তারিখ</th><th></th>' +
          '</tr></thead><tbody>';
        html += rows.map(function (e) {
          return '<tr><td class="en">' + escapeHtml(e.username) + '</td>' +
            '<td class="en">' + escapeHtml(courseTitle(e.course_slug)) + '</td>' +
            '<td class="en">' + (e.order_id == null ? "—" : escapeHtml(e.order_id)) + '</td>' +
            '<td>' + fmtDate(e.created_at) + '</td>' +
            '<td class="row-actions">' + (IS_SUPER
              ? '<button class="btn sm neutral" type="button" data-del="1" data-uid="' +
                escapeHtml(e.user_id) + '" data-slug="' + escapeHtml(e.course_slug) + '">মুছুন</button>'
              : '') + '</td></tr>';
        }).join("");
        html += '</tbody></table></div>';
        accessWrap.innerHTML = html;
      }, function () {
        accessWrap.innerHTML = '<p class="empty-note">অ্যাক্সেসের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  accessWrap.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t.getAttribute || !t.getAttribute("data-del")) return;
    var uid = t.getAttribute("data-uid");
    var slug = t.getAttribute("data-slug");
    t.disabled = true;
    window.SSA_DB.from("enrollments").delete().eq("user_id", uid).eq("course_slug", slug)
      .then(function (r) {
        if (r.error) {
          if (window.ssaToast) ssaToast("অ্যাক্সেস মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
          t.disabled = false;
          return;
        }
        if (window.ssaToast) ssaToast("অ্যাক্সেস মুছে ফেলা হয়েছে।");
        loadAccess();
      }, function () {
        if (window.ssaToast) ssaToast("অ্যাক্সেস মুছতে সমস্যা হয়েছে। আপনার সংযোগ দেখে আবার চেষ্টা করুন।");
        t.disabled = false;
      });
  });

  assignForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var uid = assignUser.value;
    var slug = assignCourse.value;
    var customer = null;
    for (var i = 0; i < customersCache.length; i++) {
      if (String(customersCache[i].id) === String(uid)) { customer = customersCache[i]; break; }
    }
    if (!customer) {
      showMsg(assignMsg, "অনুগ্রহ করে একজন কাস্টমার নির্বাচন করুন।", false);
      return;
    }
    assignBtn.disabled = true;
    window.SSA_DB.from("enrollments").insert({
      user_id: customer.id,
      username: customer.username,
      course_slug: slug,
      order_id: null
    }).then(function (r) {
      assignBtn.disabled = false;
      if (r.error) {
        if (r.error.code === "23505") {
          showMsg(assignMsg, "এই কাস্টমারের ইতিমধ্যে এই কোর্সের অ্যাক্সেস আছে।", false);
        } else {
          showMsg(assignMsg, "অ্যাক্সেস দেওয়া যায়নি। আবার চেষ্টা করুন।", false);
        }
        return;
      }
      showMsg(assignMsg, "অ্যাক্সেস দেওয়া হয়েছে — " + (customer.username || "") + " এখন " + courseTitle(slug) + " কোর্সটি পাবেন।", true);
      loadAccess();
    }, function () {
      assignBtn.disabled = false;
      showMsg(assignMsg, "অ্যাক্সেস দেওয়া যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
    });
  });

  /* ================= Phase 4: self-managed LMS =================
     Tabs: কোর্স / লেসন / কুইজ / কুইজের ফলাফল. Everything writes through
     Supabase with the admin's own session — RLS (admin-only write) is the
     real guard; this UI is just the friendly face of it. */

  function $(id) { return document.getElementById(id); }
  var TAB_SECTIONS = {
    orders: "sec-orders", customers: "sec-customers", access: "sec-access",
    courses: "sec-courses", lessons: "sec-lessons", quizzes: "sec-quizzes",
    results: "sec-results", reports: "sec-reports", revenue: "sec-revenue",
    finance: "sec-finance", reviews: "sec-reviews", nowshin: "sec-nowshin",
    analyst: "sec-analyst",
    partners: "sec-partners",
    products: "sec-products", support: "sec-support", settings: "sec-settings"
  };
  var p4Inited = false;

  function showTab(name) {
    var tabs = document.querySelectorAll(".admin-tab");
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute("data-tab") === name) tabs[i].classList.add("active");
      else tabs[i].classList.remove("active");
    }
    for (var key in TAB_SECTIONS) {
      var el = $(TAB_SECTIONS[key]);
      if (el) el.style.display = (key === name) ? "" : "none";
    }
    if (name === "courses") loadPmCourses();
    if (name === "lessons") initLessonsTab();
    if (name === "quizzes") initQuizzesTab();
    if (name === "results") loadResults();
    if (name === "reports") loadReports();
    if (name === "revenue") loadRevenue();
    if (name === "finance") loadFinance();
    if (name === "reviews") loadReviews();
    if (name === "nowshin") loadNowshinInsights();
    if (name === "products") loadProducts();
    if (name === "support") loadSupport();
    if (name === "settings") loadSettings();
    if (name === "settings" && window.SSA_loadNotices) window.SSA_loadNotices();
    if (name === "partners" && window.SSA_loadPartners) window.SSA_loadPartners();
  }

  /* ---- shared course catalog (admin view, incl. unpublished) ---- */
  var pmCourses = [];
  var allCoursesPromise = null;
  function fetchAllCourses(force) {
    if (force) allCoursesPromise = null;
    if (!allCoursesPromise) {
      allCoursesPromise = window.SSA_DB.from("courses").select("*")
        .order("sort", { ascending: true }).order("created_at", { ascending: true })
        .then(function (r) {
          if (!r.error && r.data) pmCourses = r.data;
          return pmCourses;
        }, function () { return pmCourses; });
    }
    return allCoursesPromise;
  }
  function pmCourseBySlug(slug) {
    for (var i = 0; i < pmCourses.length; i++) if (pmCourses[i].slug === slug) return pmCourses[i];
    return null;
  }
  function fillCourseSelect(sel, keepValue) {
    if (!sel) return;
    var cur = keepValue ? sel.value : "";
    if (!pmCourses.length) {
      sel.innerHTML = '<option value="">কোনো কোর্স নেই</option>';
      return;
    }
    sel.innerHTML = pmCourses.map(function (c) {
      return '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.title) + '</option>';
    }).join("");
    if (cur && pmCourseBySlug(cur)) sel.value = cur;
  }

  /* ---------------- (a) courses manager ---------------- */
  var pmEditingSlug = null;
  var pmCurrentCover = "";

  function loadPmCourses() {
    var wrap = $("pmCoursesWrap");
    fetchAllCourses(true).then(function () {
      if (!pmCourses.length) {
        wrap.innerHTML = '<p class="empty-note">এখনো কোনো কোর্স নেই। নিচের ফর্ম থেকে নতুন কোর্স যোগ করুন।</p>';
        return;
      }
      var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
        '<th>কোর্স</th><th>Slug</th><th>দাম</th><th>অবস্থা</th><th></th>' +
        '</tr></thead><tbody>';
      html += pmCourses.map(function (c) {
        return '<tr><td><span class="en">' + escapeHtml(c.title) + '</span>' +
          (c.title_bn ? '<br><span style="color:var(--muted)">' + escapeHtml(c.title_bn) + '</span>' : '') + '</td>' +
          '<td class="en">' + escapeHtml(c.slug) + '</td>' +
          '<td class="en">৳' + escapeHtml(c.price) + '</td>' +
          '<td>' + (c.published ? '<span class="tag tag-ok">Published</span>' : '<span class="tag tag-bad">Unpublished</span>') + '</td>' +
          '<td class="row-actions"><button class="btn sm" type="button" data-edit-c="' + escapeHtml(c.slug) + '">Edit</button>' +
          (IS_SUPER ? ' <button class="btn sm neutral" type="button" data-del-c="' + escapeHtml(c.slug) + '">Delete</button>' : '') + '</td></tr>';
      }).join("");
      html += '</tbody></table></div>';
      wrap.innerHTML = html;
    });
  }

  function resetPmCourseForm() {
    $("courseForm").reset();
    $("pmPublished").checked = true;
    $("pmSort").value = "0";
    $("pmSlug").disabled = false;
    pmEditingSlug = null;
    pmCurrentCover = "";
    $("pmCourseFormTitle").textContent = "নতুন কোর্স যোগ করুন";
  }

  function fillPmCourseForm(c) {
    pmEditingSlug = c.slug;
    pmCurrentCover = c.cover_url || "";
    $("pmSlug").value = c.slug;
    $("pmSlug").disabled = true;
    $("pmTitle").value = c.title || "";
    $("pmTitleBn").value = c.title_bn || "";
    $("pmPrice").value = (c.price == null ? "" : c.price);
    $("pmRegular").value = (c.regular == null ? "" : c.regular);
    $("pmAges").value = c.ages || "";
    $("pmCoverUrl").value = c.cover_url || "";
    $("pmLearn").value = (c.learn || []).join("\n");
    $("pmSort").value = (c.sort == null ? 0 : c.sort);
    $("pmPublished").checked = !!c.published;
    $("pmCourseFormTitle").textContent = "কোর্স এডিট করুন — " + c.title;
    $("pmCourseFormTitle").scrollIntoView({ block: "center" });
  }

  function savePmCourse() {
    var msg = $("pmCourseMsg");
    var slug = $("pmSlug").value.replace(/^\s+|\s+$/g, "");
    var title = $("pmTitle").value.replace(/^\s+|\s+$/g, "");
    var price = parseInt($("pmPrice").value, 10);
    if (!pmEditingSlug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      showMsg(msg, "অনুগ্রহ করে একটি সঠিক Slug দিন (ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন)।", false);
      return;
    }
    if (!title || isNaN(price)) {
      showMsg(msg, "অনুগ্রহ করে কোর্সের নাম ও দাম দিন।", false);
      return;
    }
    var btn = $("pmCourseSave");
    btn.disabled = true;

    function proceed(coverUrl) {
      var payload = {
        slug: pmEditingSlug || slug,
        title: title,
        title_bn: $("pmTitleBn").value.replace(/^\s+|\s+$/g, ""),
        price: price,
        regular: parseInt($("pmRegular").value, 10) || price,
        ages: $("pmAges").value.replace(/^\s+|\s+$/g, ""),
        cover_url: coverUrl || "",
        learn: $("pmLearn").value.split("\n").map(function (x) {
          return x.replace(/^\s+|\s+$/g, "");
        }).filter(function (x) { return x !== ""; }),
        published: $("pmPublished").checked,
        sort: parseInt($("pmSort").value, 10) || 0
      };
      var q = pmEditingSlug
        ? window.SSA_DB.from("courses").update(payload).eq("slug", pmEditingSlug)
        : window.SSA_DB.from("courses").insert(payload);
      q.then(function (r) {
        btn.disabled = false;
        if (r.error) {
          showMsg(msg, "কোর্সটি সেভ করা যায়নি। Slug টি আগে থেকে থাকলে অন্য নাম দিন, আবার চেষ্টা করুন।", false);
          return;
        }
        showMsg(msg, "কোর্সটি সেভ হয়েছে — " + title, true);
        resetPmCourseForm();
        loadPmCourses();
      }, function () {
        btn.disabled = false;
        showMsg(msg, "কোর্সটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
      });
    }

    var file = $("pmCoverFile").files && $("pmCoverFile").files[0];
    if (file) {
      var path = "covers/" + (pmEditingSlug || slug) + "-" + Date.now() + ".jpg";
      window.SSA_DB.storage.from("public-assets").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" })
        .then(function (r) {
          if (r.error) {
            btn.disabled = false;
            showMsg(msg, "কভার ছবিটি আপলোড করা যায়নি। আবার চেষ্টা করুন।", false);
            return;
          }
          var url = window.SSA_DB.storage.from("public-assets").getPublicUrl(path).data.publicUrl;
          proceed(url);
        }, function () {
          btn.disabled = false;
          showMsg(msg, "কভার ছবিটি আপলোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
        });
    } else {
      var urlVal = $("pmCoverUrl").value.replace(/^\s+|\s+$/g, "");
      proceed(urlVal || (pmEditingSlug ? pmCurrentCover : ""));
    }
  }

  /* ---------------- (b) lessons manager ---------------- */
  var lmLessons = [];
  var lmEditingId = null;

  function initLessonsTab() {
    fetchAllCourses(false).then(function () {
      fillCourseSelect($("lmCourseSel"), true);
      if ($("lmCourseSel").value) loadLmLessons();
      else $("lmLessonsWrap").innerHTML = '<p class="empty-note">আগে কোর্স ট্যাব থেকে একটি কোর্স যোগ করুন।</p>';
    });
  }

  function loadLmLessons() {
    var slug = $("lmCourseSel").value;
    var wrap = $("lmLessonsWrap");
    if (!slug) { wrap.innerHTML = '<p class="empty-note">আগে একটি কোর্স নির্বাচন করুন।</p>'; return; }
    window.SSA_DB.from("lessons").select("*").eq("course_slug", slug)
      .order("position", { ascending: true })
      .then(function (r) {
        if (r.error) {
          wrap.innerHTML = '<p class="empty-note">লেসনের তালিকা লোড করা যায়নি। আবার চেষ্টা করুন।</p>';
          return;
        }
        lmLessons = r.data || [];
        if (!lmEditingId) $("lmPosition").value = String(lmLessons.length + 1);
        if (!lmLessons.length) {
          wrap.innerHTML = '<p class="empty-note">এই কোর্সে এখনো কোনো লেসন নেই। নিচের ফর্ম থেকে যোগ করুন।</p>';
          return;
        }
        var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>ক্রম</th><th>লেসন</th><th>প্রিভিউ</th><th></th>' +
          '</tr></thead><tbody>';
        html += lmLessons.map(function (l) {
          return '<tr><td class="en">' + escapeHtml(l.position) + '</td>' +
            '<td><span class="en">' + escapeHtml(l.title) + '</span>' +
            (l.descr ? '<br><span style="color:var(--muted)">' + escapeHtml(l.descr) + '</span>' : '') + '</td>' +
            '<td>' + (l.is_preview ? '<span class="tag tag-free">ফ্রি প্রিভিউ</span>' : '<span class="tag tag-lock">লক</span>') + '</td>' +
            '<td class="row-actions"><button class="btn sm" type="button" data-edit-l="' + l.id + '">Edit</button>' +
            (IS_SUPER ? ' <button class="btn sm neutral" type="button" data-del-l="' + l.id + '">Delete</button>' : '') + '</td></tr>';
        }).join("");
        html += '</tbody></table></div>';
        wrap.innerHTML = html;
      }, function () {
        wrap.innerHTML = '<p class="empty-note">লেসনের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  function lmLessonById(id) {
    for (var i = 0; i < lmLessons.length; i++) if (String(lmLessons[i].id) === String(id)) return lmLessons[i];
    return null;
  }

  function resetLmForm() {
    $("lessonForm").reset();
    lmEditingId = null;
    $("lmPosition").value = String(lmLessons.length + 1);
    $("lmFormTitle").textContent = "নতুন লেসন যোগ করুন";
  }

  function fillLmForm(l) {
    lmEditingId = l.id;
    $("lmTitle").value = l.title || "";
    $("lmDescr").value = l.descr || "";
    $("lmPosition").value = (l.position == null ? "" : l.position);
    $("lmPreview").checked = !!l.is_preview;
    $("lmFormTitle").textContent = "লেসন এডিট করুন — " + l.title;
    $("lmFormTitle").scrollIntoView({ block: "center" });
    window.SSA_DB.from("lesson_content").select("*").eq("lesson_id", l.id).maybeSingle()
      .then(function (r) {
        if (String(lmEditingId) !== String(l.id)) return;
        var c = (r && r.data) || {};
        $("lmVideo").value = c.video_url || "";
        $("lmPdfPath").value = c.pdf_path || "";
        $("lmPdfIsLink").checked = !!c.pdf_is_link;
        $("lmBody").value = c.body_text || "";
      }, function () { /* content fields just stay empty */ });
  }

  function saveLmLesson() {
    var msg = $("lmMsg");
    var slug = $("lmCourseSel").value;
    var title = $("lmTitle").value.replace(/^\s+|\s+$/g, "");
    if (!slug) { showMsg(msg, "অনুগ্রহ করে আগে একটি কোর্স নির্বাচন করুন।", false); return; }
    if (!title) { showMsg(msg, "অনুগ্রহ করে লেসনের নাম দিন।", false); return; }
    var btn = $("lmSave");
    btn.disabled = true;
    var payload = {
      course_slug: slug,
      title: title,
      descr: $("lmDescr").value.replace(/^\s+|\s+$/g, ""),
      position: parseInt($("lmPosition").value, 10) || (lmLessons.length + 1),
      is_preview: $("lmPreview").checked
    };

    function saveContent(lessonId) {
      function upsert(pdfPath, pdfIsLink) {
        window.SSA_DB.from("lesson_content").upsert({
          lesson_id: lessonId,
          video_url: $("lmVideo").value.replace(/^\s+|\s+$/g, "") || null,
          pdf_path: pdfPath || null,
          pdf_is_link: !!pdfIsLink,
          body_text: $("lmBody").value || null
        }, { onConflict: "lesson_id" }).then(function (r) {
          btn.disabled = false;
          if (r.error) {
            showMsg(msg, "লেসনটি সেভ হয়েছে, কিন্তু ভিডিও/PDF অংশটি সেভ করা যায়নি। আবার সেভ করুন।", false);
            return;
          }
          showMsg(msg, "লেসনটি সেভ হয়েছে — " + title, true);
          lmEditingId = lessonId;
          $("lmFormTitle").textContent = "লেসন এডিট করুন — " + title;
          loadLmLessons();
        }, function () {
          btn.disabled = false;
          showMsg(msg, "লেসনটি সেভ হয়েছে, কিন্তু ভিডিও/PDF অংশটি সেভ করা যায়নি। আপনার সংযোগ দেখে আবার সেভ করুন।", false);
        });
      }
      var file = $("lmPdfFile").files && $("lmPdfFile").files[0];
      if (file) {
        var path = slug + "/" + lessonId + ".pdf";
        window.SSA_DB.storage.from("course-files").upload(path, file, { upsert: true, contentType: "application/pdf" })
          .then(function (r) {
            if (r.error) {
              btn.disabled = false;
              showMsg(msg, "PDF ফাইলটি আপলোড করা যায়নি। আবার চেষ্টা করুন।", false);
              return;
            }
            $("lmPdfPath").value = path;
            $("lmPdfIsLink").checked = false;
            upsert(path, false);
          }, function () {
            btn.disabled = false;
            showMsg(msg, "PDF ফাইলটি আপলোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
          });
      } else {
        upsert($("lmPdfPath").value.replace(/^\s+|\s+$/g, ""), $("lmPdfIsLink").checked);
      }
    }

    if (lmEditingId) {
      window.SSA_DB.from("lessons").update(payload).eq("id", lmEditingId)
        .then(function (r) {
          if (r.error) {
            btn.disabled = false;
            showMsg(msg, "লেসনটি সেভ করা যায়নি। আবার চেষ্টা করুন।", false);
            return;
          }
          saveContent(lmEditingId);
        }, function () {
          btn.disabled = false;
          showMsg(msg, "লেসনটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
        });
    } else {
      window.SSA_DB.from("lessons").insert(payload).select("id").single()
        .then(function (r) {
          if (r.error || !r.data) {
            btn.disabled = false;
            showMsg(msg, "লেসনটি সেভ করা যায়নি। আবার চেষ্টা করুন।", false);
            return;
          }
          saveContent(r.data.id);
        }, function () {
          btn.disabled = false;
          showMsg(msg, "লেসনটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
        });
    }
  }

  /* ---------------- (c) quiz builder ---------------- */
  var qzQuizzes = [];
  var qzLessonsCache = [];
  var qzEditingId = null;
  var qzCounter = 0;

  function initQuizzesTab() {
    fetchAllCourses(false).then(function () {
      fillCourseSelect($("qzCourseSel"), true);
      fillQzLessons(null);
      loadQzList();
      if (!$("qzQuestions").children.length) addQzQuestion(null);
    });
  }

  function fillQzLessons(selectedLessonId) {
    var sel = $("qzLessonSel");
    var slug = $("qzCourseSel").value;
    sel.innerHTML = '<option value="">পুরো কোর্সের জন্য</option>';
    qzLessonsCache = [];
    if (!slug) return;
    window.SSA_DB.from("lessons").select("id, title, position").eq("course_slug", slug)
      .order("position", { ascending: true })
      .then(function (r) {
        if (r.error || !r.data) return;
        qzLessonsCache = r.data;
        sel.innerHTML = '<option value="">পুরো কোর্সের জন্য</option>' + r.data.map(function (l) {
          return '<option value="' + l.id + '">' + escapeHtml(l.title) + '</option>';
        }).join("");
        if (selectedLessonId) sel.value = String(selectedLessonId);
      }, function () { /* lesson select is optional */ });
  }

  function qzLessonTitle(id) {
    if (id == null) return "পুরো কোর্স";
    for (var i = 0; i < qzLessonsCache.length; i++) {
      if (String(qzLessonsCache[i].id) === String(id)) return qzLessonsCache[i].title;
    }
    return "লেসন #" + id;
  }

  function loadQzList() {
    var wrap = $("qzListWrap");
    var slug = $("qzCourseSel").value;
    if (!slug) { wrap.innerHTML = '<p class="empty-note">আগে একটি কোর্স নির্বাচন করুন।</p>'; return; }
    window.SSA_DB.from("quizzes").select("*").eq("course_slug", slug).order("id", { ascending: true })
      .then(function (r) {
        if (r.error) {
          wrap.innerHTML = '<p class="empty-note">কুইজের তালিকা লোড করা যায়নি। আবার চেষ্টা করুন।</p>';
          return;
        }
        qzQuizzes = r.data || [];
        if (!qzQuizzes.length) {
          wrap.innerHTML = '<p class="empty-note">এই কোর্সে এখনো কোনো কুইজ নেই। নিচের ফর্ম থেকে বানান।</p>';
          return;
        }
        var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>কুইজ</th><th>লেসন</th><th></th>' +
          '</tr></thead><tbody>';
        html += qzQuizzes.map(function (q) {
          return '<tr><td>' + escapeHtml(q.title) + '</td>' +
            '<td>' + escapeHtml(qzLessonTitle(q.lesson_id)) + '</td>' +
            '<td class="row-actions"><button class="btn sm" type="button" data-edit-q="' + q.id + '">Edit</button>' +
            (IS_SUPER ? ' <button class="btn sm neutral" type="button" data-del-q="' + q.id + '">Delete</button>' : '') + '</td></tr>';
        }).join("");
        html += '</tbody></table></div>';
        wrap.innerHTML = html;
      }, function () {
        wrap.innerHTML = '<p class="empty-note">কুইজের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  function addQzQuestion(data) {
    qzCounter += 1;
    var name = "qqc-" + qzCounter;
    var box = document.createElement("div");
    box.className = "qz-q";
    var opts = (data && data.options) || ["", "", "", ""];
    var correct = (data && typeof data.correct_index === "number") ? data.correct_index : 0;
    var html = '<div class="field"><label>প্রশ্ন</label>' +
      '<input type="text" class="qq-text" value="' + escapeHtml(data ? data.question : "") + '"></div>';
    for (var i = 0; i < 4; i++) {
      html += '<div class="field"><label>অপশন ' + (i + 1) + '</label>' +
        '<input type="text" class="qq-opt" value="' + escapeHtml(opts[i] || "") + '"></div>';
    }
    html += '<div class="field"><span style="font-weight:600;font-size:15px;display:block;margin-bottom:4px">সঠিক উত্তর</span>';
    for (var j = 0; j < 4; j++) {
      html += '<label class="radio-inline"><input type="radio" name="' + name + '" value="' + j + '"' +
        (j === correct ? " checked" : "") + '> অপশন ' + (j + 1) + '</label>';
    }
    html += '</div><button class="btn sm neutral qq-remove" type="button">প্রশ্নটি মুছুন</button>';
    box.innerHTML = html;
    box.querySelector(".qq-remove").addEventListener("click", function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    $("qzQuestions").appendChild(box);
  }

  function collectQzQuestions() {
    var blocks = $("qzQuestions").querySelectorAll(".qz-q");
    var out = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var text = b.querySelector(".qq-text").value.replace(/^\s+|\s+$/g, "");
      var optEls = b.querySelectorAll(".qq-opt");
      var opts = [];
      for (var j = 0; j < optEls.length; j++) opts.push(optEls[j].value.replace(/^\s+|\s+$/g, ""));
      var sel = b.querySelector('input[type="radio"]:checked');
      out.push({
        question: text,
        options: opts,
        correct_index: sel ? parseInt(sel.value, 10) : 0
      });
    }
    return out;
  }

  function resetQzForm() {
    $("quizForm").reset();
    qzEditingId = null;
    $("qzQuestions").innerHTML = "";
    addQzQuestion(null);
    $("qzFormTitle").textContent = "নতুন কুইজ বানান";
  }

  function fillQzForm(q) {
    qzEditingId = q.id;
    $("qzTitle").value = q.title || "";
    fillQzLessons(q.lesson_id);
    $("qzFormTitle").textContent = "কুইজ এডিট করুন — " + q.title;
    $("qzFormTitle").scrollIntoView({ block: "center" });
    window.SSA_DB.from("quiz_questions").select("*").eq("quiz_id", q.id)
      .order("position", { ascending: true })
      .then(function (r) {
        if (String(qzEditingId) !== String(q.id)) return;
        $("qzQuestions").innerHTML = "";
        var rows = (r && r.data) || [];
        if (!rows.length) { addQzQuestion(null); return; }
        rows.forEach(function (row) { addQzQuestion(row); });
      }, function () {
        if (String(qzEditingId) === String(q.id) && !$("qzQuestions").children.length) addQzQuestion(null);
      });
  }

  function saveQzQuiz() {
    var msg = $("qzMsg");
    var slug = $("qzCourseSel").value;
    var title = $("qzTitle").value.replace(/^\s+|\s+$/g, "");
    if (!slug) { showMsg(msg, "অনুগ্রহ করে আগে একটি কোর্স নির্বাচন করুন।", false); return; }
    if (!title) { showMsg(msg, "অনুগ্রহ করে কুইজের নাম দিন।", false); return; }
    var qs = collectQzQuestions();
    if (!qs.length) { showMsg(msg, "অনুগ্রহ করে কমপক্ষে একটি প্রশ্ন যোগ করুন।", false); return; }
    for (var i = 0; i < qs.length; i++) {
      if (!qs[i].question || qs[i].options.some(function (o) { return !o; })) {
        showMsg(msg, "প্রশ্ন " + (i + 1) + " — প্রশ্ন ও চারটি অপশনের সবগুলো পূরণ করুন।", false);
        return;
      }
    }
    if (!IS_SUPER && qzEditingId) {
      /* Staff cannot delete — and saving questions rewrites them by
         delete + re-insert, which the database forbids for staff. On a
         quiz that already has questions, that would silently duplicate
         them, so a staff edit stops here with a clear message. */
      window.SSA_DB.from("quiz_questions").select("id").eq("quiz_id", qzEditingId).limit(1)
        .then(function (r) {
          if (r && r.data && r.data.length) {
            showMsg(msg, "এই কুইজে আগেই প্রশ্ন আছে — প্রশ্ন বদলাতে Super Admin লাগবে। আপনি নতুন কুইজ বানাতে পারবেন।", false);
            return;
          }
          proceedSave();
        }, function () { proceedSave(); });
      return;
    }
    proceedSave();

    function proceedSave() {
    var btn = $("qzSave");
    btn.disabled = true;
    var payload = {
      course_slug: slug,
      lesson_id: $("qzLessonSel").value ? parseInt($("qzLessonSel").value, 10) : null,
      title: title
    };

    function saveQuestions(quizId) {
      window.SSA_DB.from("quiz_questions").delete().eq("quiz_id", quizId)
        .then(function (dr) {
          if (dr.error) {
            btn.disabled = false;
            showMsg(msg, "কুইজটি সেভ হয়েছে, কিন্তু প্রশ্নগুলো সেভ করা যায়নি। আবার সেভ করুন।", false);
            return;
          }
          var rows = qs.map(function (q, idx) {
            return {
              quiz_id: quizId, position: idx + 1, question: q.question,
              options: q.options, correct_index: q.correct_index
            };
          });
          window.SSA_DB.from("quiz_questions").insert(rows).then(function (r) {
            btn.disabled = false;
            if (r.error) {
              showMsg(msg, "কুইজটি সেভ হয়েছে, কিন্তু প্রশ্নগুলো সেভ করা যায়নি। আবার সেভ করুন।", false);
              return;
            }
            showMsg(msg, "কুইজটি সেভ হয়েছে — " + title + " (" + qs.length + "টি প্রশ্ন)", true);
            qzEditingId = quizId;
            $("qzFormTitle").textContent = "কুইজ এডিট করুন — " + title;
            loadQzList();
          }, function () {
            btn.disabled = false;
            showMsg(msg, "প্রশ্নগুলো সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার সেভ করুন।", false);
          });
        }, function () {
          btn.disabled = false;
          showMsg(msg, "প্রশ্নগুলো সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার সেভ করুন।", false);
        });
    }

    if (qzEditingId) {
      window.SSA_DB.from("quizzes").update(payload).eq("id", qzEditingId)
        .then(function (r) {
          if (r.error) {
            btn.disabled = false;
            showMsg(msg, "কুইজটি সেভ করা যায়নি। আবার চেষ্টা করুন।", false);
            return;
          }
          saveQuestions(qzEditingId);
        }, function () {
          btn.disabled = false;
          showMsg(msg, "কুইজটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
        });
    } else {
      window.SSA_DB.from("quizzes").insert(payload).select("id").single()
        .then(function (r) {
          if (r.error || !r.data) {
            btn.disabled = false;
            showMsg(msg, "কুইজটি সেভ করা যায়নি। আবার চেষ্টা করুন।", false);
            return;
          }
          saveQuestions(r.data.id);
        }, function () {
          btn.disabled = false;
          showMsg(msg, "কুইজটি সেভ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
        });
    }
    }
  }

  /* ---------------- (d) quiz results ---------------- */
  var resCacheRows = [];
  var resQuizMap = {};

  function loadResults() {
    var wrap = $("resultsWrap");
    wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    Promise.all([
      window.SSA_DB.from("quiz_results").select("*").order("created_at", { ascending: false }).limit(200),
      window.SSA_DB.from("quizzes").select("id, title, course_slug"),
      fetchAllCourses(false)
    ]).then(function (res) {
      var rr = res[0], qr = res[1];
      if (rr.error) {
        wrap.innerHTML = '<p class="empty-note">ফলাফলের তালিকা লোড করা যায়নি। আবার চেষ্টা করুন।</p>';
        return;
      }
      resCacheRows = rr.data || [];
      resQuizMap = {};
      ((qr && qr.data) || []).forEach(function (q) { resQuizMap[q.id] = q; });
      renderResults();
    }, function () {
      wrap.innerHTML = '<p class="empty-note">ফলাফলের তালিকা লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
    });
  }

  function renderResults() {
    var wrap = $("resultsWrap");
    var rows = resCacheRows.filter(function (row) {
      return dateInRange(row.created_at, reportFilters.results);
    });
    setFilterCount("results", "সময়কাল: " + periodText(reportFilters.results) +
      " — মোট " + rows.length + "টি ফলাফল দেখানো হচ্ছে (সবমোট " + resCacheRows.length + "টি)");
    if (!resCacheRows.length) {
      wrap.innerHTML = '<p class="empty-note">এখনো কোনো ছাত্র কুইজ দেয়নি।</p>';
      return;
    }
    if (!rows.length) {
      wrap.innerHTML = '<p class="empty-note">এই সময়ে কোনো কুইজের ফলাফল নেই। অন্য সময়কাল বেছে দেখুন।</p>';
      return;
    }
    var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>ছাত্র</th><th>কুইজ</th><th>কোর্স</th><th>স্কোর</th><th>তারিখ</th>' +
      '</tr></thead><tbody>';
    html += rows.map(function (row) {
      var q = resQuizMap[row.quiz_id];
      var cSlug = q ? q.course_slug : "";
      var c = cSlug ? pmCourseBySlug(cSlug) : null;
      return '<tr><td class="en">' + escapeHtml(row.username) + '</td>' +
        '<td>' + escapeHtml(q ? q.title : ("কুইজ #" + row.quiz_id)) + '</td>' +
        '<td class="en">' + escapeHtml(c ? c.title : courseTitle(cSlug)) + '</td>' +
        '<td class="en">' + escapeHtml(row.score) + ' / ' + escapeHtml(row.total) + '</td>' +
        '<td>' + fmtDate(row.created_at) + '</td></tr>';
    }).join("");
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  /* ================= Phase 5: reports + revenue =================
     Both sections read through the signed-in session, so RLS decides
     what comes back: Super Admin and staff see everything (staff just
     cannot change roles or delete — see the gate and the renderers). */

  function roleBadge(role) {
    if (role === "admin") return '<span class="tag tag-ok">Super Admin</span>';
    if (role === "staff") return '<span class="tag tag-pend">Staff (Assigned)</span>';
    return '<span class="tag tag-lock">Student</span>';
  }

  /* ---- (e) reports: one customer's full picture ---- */
  var repProfiles = [], repOrders = [], repEnrollments = [], repResults = [], repQuizMap = {};
  var repProgress = [], repLessonSlug = {}, repLessonCount = {};
  var repListenersBound = false;
  var repLoaded = false;
  var repOpenId = null;

  /* Date-range views of the report data (Phase 10): the summary totals
     and each customer's detail lists respect the selected period. */
  function repOrdersInRange() {
    return repOrders.filter(function (o) { return dateInRange(o.created_at, reportFilters.reports); });
  }
  function repEnrollmentsInRange() {
    return repEnrollments.filter(function (e) { return dateInRange(e.created_at, reportFilters.reports); });
  }
  function repResultsInRange() {
    return repResults.filter(function (r) { return dateInRange(r.created_at, reportFilters.reports); });
  }

  function loadReports() {
    var wrap = $("reportsWrap");
    wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    Promise.all([
      window.SSA_DB.from("profiles").select("*"),
      window.SSA_DB.from("orders").select("*").order("created_at", { ascending: false }),
      window.SSA_DB.from("enrollments").select("*"),
      window.SSA_DB.from("quiz_results").select("*").order("created_at", { ascending: false }),
      window.SSA_DB.from("quizzes").select("id, title, course_slug"),
      /* Phase 6: lesson progress + lesson catalogue for per-course
         completion counts. These two are non-fatal — if they fail, the
         rest of the report still renders, just without progress. */
      window.SSA_DB.from("lesson_progress").select("user_id, lesson_id"),
      window.SSA_DB.from("lessons").select("id, course_slug")
    ]).then(function (res) {
      for (var i = 0; i < 5; i++) {
        if (res[i].error) {
          wrap.innerHTML = '<p class="empty-note">রিপোর্ট লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>';
          return;
        }
      }
      repProfiles = res[0].data || [];
      repOrders = res[1].data || [];
      repEnrollments = res[2].data || [];
      repResults = res[3].data || [];
      repQuizMap = {};
      (res[4].data || []).forEach(function (q) { repQuizMap[q.id] = q; });
      repProgress = (!res[5].error && res[5].data) ? res[5].data : [];
      repLessonSlug = {};
      repLessonCount = {};
      if (!res[6].error && res[6].data) {
        res[6].data.forEach(function (l) {
          repLessonSlug[l.id] = l.course_slug;
          repLessonCount[l.course_slug] = (repLessonCount[l.course_slug] || 0) + 1;
        });
      }
      repLoaded = true;
      renderReportsShell();
      if (repOpenId) openReport(repOpenId);
    }, function () {
      wrap.innerHTML = '<p class="empty-note">রিপোর্ট লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
    });
  }

  function renderReportsShell() {
    var wrap = $("reportsWrap");
    var fOrders = repOrdersInRange();
    var fEnrollments = repEnrollmentsInRange();
    var fResults = repResultsInRange();
    setFilterCount("reports", "সময়কাল: " + periodText(reportFilters.reports) +
      " — এই সময়ে অর্ডার " + fOrders.length + "টি, ভর্তি " + fEnrollments.length +
      "টি, কুইজ ফলাফল " + fResults.length + "টি (সবমোট অর্ডার " + repOrders.length + "টি)");
    var html = '<div class="table-scroll"><table class="admin-table"><tbody><tr>' +
      '<th>মোট কাস্টমার</th><td class="en">' + repProfiles.length + '</td>' +
      '<th>মোট অর্ডার</th><td class="en">' + fOrders.length + '</td>' +
      '<th>মোট ভর্তি</th><td class="en">' + fEnrollments.length + '</td>' +
      '<th>মোট কুইজ ফলাফল</th><td class="en">' + fResults.length + '</td>' +
      '</tr></tbody></table></div>';
    html += '<div class="field" style="margin:16px 0 12px">' +
      '<label for="reportSearch">কাস্টমার খুঁজুন — নাম, ইউজারনেম বা মোবাইল লিখুন</label>' +
      '<input id="reportSearch" type="text" placeholder="যেমন: Karim বা 017…"></div>';
    html += '<div id="reportList"></div><div id="reportDetail" style="margin-top:20px"></div>';
    wrap.innerHTML = html;
    renderReportList("");
    renderCompletions();
    if (!repListenersBound) {
      repListenersBound = true;
      wrap.addEventListener("input", function (ev) {
        if (ev.target && ev.target.id === "reportSearch") renderReportList(ev.target.value);
      });
      wrap.addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t.getAttribute || !t.getAttribute("data-report")) return;
        openReport(t.getAttribute("data-report"));
      });
    }
  }

  function renderReportList(filter) {
    var box = $("reportList");
    if (!box) return;
    var f = String(filter || "").replace(/^\s+|\s+$/g, "").toLowerCase();
    var list = repProfiles.filter(function (p) {
      if (!f) return true;
      var hay = ((p.name || "") + " " + (p.username || "") + " " + (p.mobile || "")).toLowerCase();
      return hay.indexOf(f) !== -1;
    });
    if (!list.length) {
      box.innerHTML = '<p class="empty-note">কোনো কাস্টমার পাওয়া যায়নি।</p>';
      return;
    }
    var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>নাম</th><th>ইউজারনেম</th><th>মোবাইল</th><th>Role</th><th></th>' +
      '</tr></thead><tbody>';
    html += list.map(function (p) {
      return '<tr><td>' + escapeHtml(p.name) + '</td>' +
        '<td class="en">' + escapeHtml(p.username) + '</td>' +
        '<td class="en">' + escapeHtml(p.mobile) + '</td>' +
        '<td>' + roleBadge(p.role) + '</td>' +
        '<td class="row-actions"><button class="btn sm" type="button" data-report="' + escapeHtml(p.id) + '">রিপোর্ট দেখুন</button></td></tr>';
    }).join("");
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  function openReport(id) {
    var box = $("reportDetail");
    if (!box) return;
    var p = null;
    for (var i = 0; i < repProfiles.length; i++) {
      if (String(repProfiles[i].id) === String(id)) { p = repProfiles[i]; break; }
    }
    if (!p) { repOpenId = null; return; }
    repOpenId = id;
    var orders = repOrdersInRange().filter(function (o) { return String(o.user_id) === String(id); });
    var enrolls = repEnrollmentsInRange().filter(function (e) { return String(e.user_id) === String(id); });
    var results = repResultsInRange().filter(function (r) {
      return String(r.user_id) === String(id) ||
        (r.user_id == null && p.username && r.username === p.username);
    });

    var html = '<h3 style="margin:0 0 10px">' + escapeHtml(p.name || p.username || "") + ' — পূর্ণ রিপোর্ট</h3>';
    html += '<div class="table-scroll"><table class="admin-table"><tbody>' +
      '<tr><th>নাম</th><td>' + escapeHtml(p.name) + '</td>' +
      '<th>ইউজারনেম</th><td class="en">' + escapeHtml(p.username) + '</td></tr>' +
      '<tr><th>মোবাইল</th><td class="en">' + escapeHtml(p.mobile) + '</td>' +
      '<th>Role</th><td>' + roleBadge(p.role) + '</td></tr>' +
      (p.created_at ? '<tr><th>অ্যাকাউন্ট খোলা</th><td colspan="3">' + fmtDate(p.created_at) + '</td></tr>' : '') +
      '</tbody></table></div>';

    html += '<h3 style="margin:20px 0 10px">অর্ডার (' + orders.length + ')</h3>';
    if (!orders.length) {
      html += '<p class="empty-note">এই কাস্টমারের কোনো অর্ডার নেই।</p>';
    } else {
      html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
        '<th>তারিখ</th><th>পণ্য</th><th>মোট</th><th>TrxID</th><th>স্ট্যাটাস</th>' +
        '</tr></thead><tbody>';
      html += orders.map(function (o) {
        var titles = (o.items || []).map(function (it) {
          return escapeHtml(it.title || it.slug || "");
        }).join(", ");
        return '<tr><td>' + fmtDate(o.created_at) + '</td>' +
          '<td>' + titles + '</td>' +
          '<td class="en">৳' + escapeHtml(o.total) + '</td>' +
          '<td class="en">' + escapeHtml(o.trxid) + '</td>' +
          '<td>' + statusTag(o.status) + '</td></tr>';
      }).join("");
      html += '</tbody></table></div>';
    }

    html += '<h3 style="margin:20px 0 10px">কোর্স — ভর্তি (' + enrolls.length + ')</h3>';
    if (!enrolls.length) {
      html += '<p class="empty-note">এই কাস্টমার এখনো কোনো কোর্সে ভর্তি হননি।</p>';
    } else {
      html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
        '<th>কোর্স</th><th>তারিখ</th><th>সম্পন্ন লেসন</th>' +
        '</tr></thead><tbody>';
      html += enrolls.map(function (e) {
        var done = 0;
        repProgress.forEach(function (pr) {
          if (String(pr.user_id) === String(id) && repLessonSlug[pr.lesson_id] === e.course_slug) done++;
        });
        var total = repLessonCount[e.course_slug];
        var progressCell = (typeof total === "number")
          ? '<span class="en">' + done + ' / ' + total + '</span>'
          : '<span class="en">' + done + '</span>';
        return '<tr><td class="en">' + escapeHtml(courseTitle(e.course_slug)) + '</td>' +
          '<td>' + fmtDate(e.created_at) + '</td>' +
          '<td>' + progressCell + '</td></tr>';
      }).join("");
      html += '</tbody></table></div>';
    }

    html += '<h3 style="margin:20px 0 10px">কুইজের ফলাফল (' + results.length + ')</h3>';
    if (!results.length) {
      html += '<p class="empty-note">এই কাস্টমার এখনো কোনো কুইজ দেননি।</p>';
    } else {
      html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
        '<th>কুইজ</th><th>স্কোর</th><th>তারিখ</th>' +
        '</tr></thead><tbody>';
      html += results.map(function (r) {
        var q = repQuizMap[r.quiz_id];
        return '<tr><td>' + escapeHtml(q ? q.title : ("কুইজ #" + r.quiz_id)) + '</td>' +
          '<td class="en">' + escapeHtml(r.score) + ' / ' + escapeHtml(r.total) + '</td>' +
          '<td>' + fmtDate(r.created_at) + '</td></tr>';
      }).join("");
      html += '</tbody></table></div>';
    }

    box.innerHTML = html;
    if (box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
  }

  /* ---- (f) sales & revenue: approved orders only ---- */
  function isApprovedOrder(o) { return o.status === "approved" || o.status === "completed"; }

  /* Push each approved sale to the Founder's Google Sheet (Sales tab)
     through the Google Bridge — once per order: sent order ids are
     remembered in localStorage "ssa_sheet_sales". The bridge URL lives
     in nowshin.js as window.SSA_SHEET_URL (loaded before admin.js).
     Best-effort and fully guarded: it must never break the tab. */
  function syncApprovedSales(approvedOrders) {
    var msg = $("sheetSyncMsg");
    function say(text) { if (msg) msg.textContent = text; }
    var url = "";
    try { url = window.SSA_SHEET_URL || ""; } catch (e) { url = ""; }
    if (!url) { say("Google Sheet এখনো যুক্ত হয়নি — CEO-কে বলুন।"); return; }
    var sentIds = [];
    try { sentIds = JSON.parse(localStorage.getItem("ssa_sheet_sales") || "[]"); } catch (e) { sentIds = []; }
    if (!Array.isArray(sentIds)) sentIds = [];
    var already = {};
    sentIds.forEach(function (id) { already[String(id)] = true; });
    var queue = (approvedOrders || []).filter(function (o) {
      return o && o.id != null && !already[String(o.id)];
    });
    if (!queue.length) {
      say("নতুন পাঠানোর মতো সেলস নেই — সব অনুমোদিত সেলস আগেই পাঠানো হয়েছে।");
      return;
    }
    say("পাঠানো হচ্ছে… (" + queue.length + "টি সেলস)");
    var idx = 0;
    function finish() {
      try { localStorage.setItem("ssa_sheet_sales", JSON.stringify(sentIds)); } catch (e) {}
      say(queue.length + "টি সেলস Google Sheet-এ পাঠানো হয়েছে।");
    }
    function step() {
      if (idx >= queue.length) { finish(); return; }
      var o = queue[idx++];
      var titles = (o.items || []).map(function (it) {
        return (it && (it.title || it.slug)) || "";
      }).filter(function (s) { return s; }).join(", ");
      var advanced = false;
      function advance() {
        if (advanced) return;
        advanced = true;
        sentIds.push(o.id);
        setTimeout(step, 150);
      }
      try {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            type: "sale",
            t: o.created_at || new Date().toISOString(),
            name: o.name || "",
            mobile: o.mobile || "",
            item: titles,
            amount: o.total || "",
            trxid: o.trxid || "",
            status: "approved"
          })
        }).then(advance, advance);
      } catch (e) { advance(); }
      /* A hung request must never stall the rest of the queue. */
      setTimeout(advance, 4000);
    }
    step();
  }

  var revCacheOrders = null;

  function loadRevenue() {
    var wrap = $("revenueWrap");
    wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    window.SSA_DB.from("orders").select("*").order("created_at", { ascending: false })
      .then(function (r) {
        if (r.error) {
          wrap.innerHTML = '<p class="empty-note">আয়ের হিসাব লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।</p>';
          return;
        }
        revCacheOrders = r.data || [];
        renderRevenue();
      }, function () {
        wrap.innerHTML = '<p class="empty-note">আয়ের হিসাব লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>';
      });
  }

  function renderRevenue() {
        var wrap = $("revenueWrap");
        var all = revCacheOrders || [];
        var st = reportFilters.revenue;
        function inRange(o) { return dateInRange(o.created_at, st); }
        var approvedAll = all.filter(isApprovedOrder);
        var approved = approvedAll.filter(inRange);
        var pending = all.filter(function (o) { return o.status === "pending"; }).filter(inRange);
        var scoped = all.filter(inRange);
        var now = new Date();
        function sumTotal(list) {
          return list.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
        }
        function sameDay(d) {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        }
        function sameMonth(d) {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        /* আজকের / এই মাসের আয় stay as quick reference figures over all
           approved sales; the নির্বাচিত সময়ের figures follow the filter. */
        var today = approvedAll.filter(function (o) {
          var d = new Date(o.created_at);
          return !isNaN(d.getTime()) && sameDay(d);
        });
        var month = approvedAll.filter(function (o) {
          var d = new Date(o.created_at);
          return !isNaN(d.getTime()) && sameMonth(d);
        });
        setFilterCount("revenue", "সময়কাল: " + periodText(st) +
          " — এই সময়ে অনুমোদিত বিক্রি " + approved.length + "টি, মোট আয় ৳" + sumTotal(approved));

        var html = '<div style="margin-bottom:16px">' +
          '<button type="button" class="btn sm" id="sheetSyncBtn">📤 অনুমোদিত সেলস Google Sheet-এ পাঠান</button> ' +
          '<span id="sheetSyncMsg" style="color:var(--muted);font-size:14.5px"></span></div>' +
          '<div class="table-scroll"><table class="admin-table"><tbody><tr>' +
          '<th>নির্বাচিত সময়ের আয়</th><td class="en">৳' + sumTotal(approved) + '</td>' +
          '<th>আজকের আয়</th><td class="en">৳' + sumTotal(today) + '</td>' +
          '<th>এই মাসের আয়</th><td class="en">৳' + sumTotal(month) + '</td>' +
          '</tr><tr>' +
          '<th>মোট অর্ডার</th><td class="en">' + scoped.length + '</td>' +
          '<th>অনুমোদিত অর্ডার</th><td class="en">' + approved.length + '</td>' +
          '<th>অপেক্ষমাণ অর্ডার</th><td class="en">' + pending.length + '</td>' +
          '</tr></tbody></table></div>';

        /* per-item sales, from the items of approved orders */
        var itemMap = {};
        approved.forEach(function (o) {
          (o.items || []).forEach(function (it) {
            if (!it) return;
            var key = it.title || it.slug || "—";
            if (!itemMap[key]) itemMap[key] = { count: 0, sum: 0 };
            itemMap[key].count += 1;
            var price = (typeof it.price === "number") ? it.price : 0;
            if (!price && it.slug && typeof ssaFindItem === "function") {
              var found = ssaFindItem(it.slug);
              if (found) price = found.price || 0;
            }
            itemMap[key].sum += price;
          });
        });
        var itemKeys = Object.keys(itemMap).sort(function (a, b) { return itemMap[b].sum - itemMap[a].sum; });
        html += '<h3 style="margin:20px 0 10px">পণ্য অনুযায়ী বিক্রি</h3>';
        if (!itemKeys.length) {
          html += '<p class="empty-note">এখনো কোনো অনুমোদিত বিক্রি নেই।</p>';
        } else {
          html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
            '<th>পণ্যের নাম</th><th>বিক্রি</th><th>আয়</th>' +
            '</tr></thead><tbody>';
          html += itemKeys.map(function (k) {
            return '<tr><td>' + escapeHtml(k) + '</td>' +
              '<td class="en">' + itemMap[k].count + '</td>' +
              '<td class="en">৳' + itemMap[k].sum + '</td></tr>';
          }).join("");
          html += '</tbody></table></div>';
        }

        html += '<h3 style="margin:20px 0 10px">সাম্প্রতিক বিক্রি</h3>';
        var recent = approved.slice(0, 20);
        if (!recent.length) {
          html += '<p class="empty-note">এখনো কোনো অনুমোদিত বিক্রি নেই।</p>';
        } else {
          html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
            '<th>তারিখ</th><th>কাস্টমার</th><th>পণ্য</th><th>টাকা</th>' +
            '</tr></thead><tbody>';
          html += recent.map(function (o) {
            var titles = (o.items || []).map(function (it) {
              return escapeHtml(it.title || it.slug || "");
            }).join(", ");
            return '<tr><td>' + fmtDate(o.created_at) + '</td>' +
              '<td>' + escapeHtml(o.name) + '</td>' +
              '<td>' + titles + '</td>' +
              '<td class="en">৳' + escapeHtml(o.total) + '</td></tr>';
          }).join("");
          html += '</tbody></table></div>';
        }

        html += '<p style="margin-top:14px;color:var(--muted)">শুধু অনুমোদিত (approved) অর্ডারের টাকাই আয়ে ধরা হয়েছে।</p>';
        wrap.innerHTML = html;
        var syncBtn = $("sheetSyncBtn");
        if (syncBtn) {
          /* The Sheet sync always covers every approved sale (unchanged
             behaviour) — the date filter only scopes what is displayed. */
          syncBtn.addEventListener("click", function () { syncApprovedSales(approvedAll); });
        }
  }

  /* ================= Phase 10: report date filter + PDF download =====
     Founder order 2026-10-22: every Super Admin report (অর্ডার, রিপোর্ট,
     বিক্রয় ও আয়, কুইজের ফলাফল) gets (1) a date-range search — From →
     To, with আজ / এই মাস / এই বছর / সব quick periods — and (2) a PDF
     download of the currently filtered records, so he can keep manual
     records. Filtering compares the LOCAL calendar day of each record's
     created_at against the chosen From/To days. The PDF is produced by
     printing a purpose-built document area (#ssaPrintArea) with a print
     stylesheet — fully client-side, no external service. */

  var reportFilters = {
    orders: { from: "", to: "" },
    results: { from: "", to: "" },
    reports: { from: "", to: "" },
    revenue: { from: "", to: "" },
    finance: { from: "", to: "" },
    reviews: { from: "", to: "" },
    nowshin: { from: "", to: "" }
  };
  var REPORT_SCOPES = ["orders", "results", "reports", "revenue", "finance", "reviews", "nowshin"];

  function dateKeyOf(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function dateInRange(iso, st) {
    if (!st || (!st.from && !st.to)) return true;
    if (!iso) return false;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    var k = dateKeyOf(d);
    if (st.from && k < st.from) return false;
    if (st.to && k > st.to) return false;
    return true;
  }
  function periodText(st) {
    if (!st || (!st.from && !st.to)) return "সব সময়";
    return (st.from || "শুরু") + " থেকে " + (st.to || "শেষ") + " পর্যন্ত";
  }
  function setFilterCount(scope, text) {
    var el = $("fCount-" + scope);
    if (el) el.textContent = text;
  }
  function rerenderScope(scope) {
    if (scope === "orders") renderOrders();
    else if (scope === "results") renderResults();
    else if (scope === "revenue") { if (revCacheOrders) renderRevenue(); }
    else if (scope === "finance") { if (finLoaded || finSetupPending) renderFinance(); }
    else if (scope === "reviews") { if (revLoaded || revSetupPending) renderReviews(); }
    else if (scope === "nowshin") { if (nwLoaded || nwSetupPending) renderNowshinInsights(); }
    else if (scope === "reports") {
      if (!repLoaded) return;
      renderReportsShell();
      if (repOpenId) openReport(repOpenId);
    }
  }
  function setReportFilter(scope, from, to) {
    reportFilters[scope] = { from: from || "", to: to || "" };
    var fi = $("fFrom-" + scope), ti = $("fTo-" + scope);
    if (fi) fi.value = reportFilters[scope].from;
    if (ti) ti.value = reportFilters[scope].to;
    rerenderScope(scope);
  }
  function applyQuickPeriod(scope, kind) {
    var now = new Date();
    if (kind === "today") {
      var t = dateKeyOf(now);
      setReportFilter(scope, t, t);
    } else if (kind === "month") {
      setReportFilter(scope,
        dateKeyOf(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateKeyOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (kind === "year") {
      setReportFilter(scope,
        dateKeyOf(new Date(now.getFullYear(), 0, 1)),
        dateKeyOf(new Date(now.getFullYear(), 11, 31)));
    } else {
      setReportFilter(scope, "", "");
    }
  }

  var reportToolsBound = false;
  function bindReportTools() {
    if (reportToolsBound) return;
    reportToolsBound = true;
    REPORT_SCOPES.forEach(function (scope) {
      var fi = $("fFrom-" + scope), ti = $("fTo-" + scope);
      if (fi) fi.addEventListener("change", function () {
        reportFilters[scope].from = fi.value;
        rerenderScope(scope);
      });
      if (ti) ti.addEventListener("change", function () {
        reportFilters[scope].to = ti.value;
        rerenderScope(scope);
      });
    });
    appEl.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var q = t.getAttribute("data-quick");
      if (q) { applyQuickPeriod(t.getAttribute("data-scope"), q); return; }
      var pdf = t.getAttribute("data-pdf");
      if (pdf) printReport(pdf);
    });
  }

  /* ---------- PDF (print) document ---------- */
  function plainStatus(st) {
    if (st === "pending") return "অনুমোদনের অপেক্ষায়";
    if (st === "approved" || st === "completed") return "অনুমোদিত";
    if (st === "rejected" || st === "cancelled" || st === "canceled") return "বাতিল";
    return st || "—";
  }
  function orderTitlesText(o) {
    return (o.items || []).map(function (it) {
      return (it && (it.title || it.slug)) || "";
    }).filter(function (s) { return s; }).join(", ");
  }
  function pTableHtml(head, bodyRowsHtml, footRowsHtml) {
    var html = '<table class="p-table"><thead><tr>' +
      head.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join("") +
      '</tr></thead><tbody>' + bodyRowsHtml + '</tbody>';
    if (footRowsHtml) html += '<tfoot>' + footRowsHtml + '</tfoot>';
    return html + '</table>';
  }
  function pEmptyRow(cols) {
    return '<tr><td colspan="' + cols + '">এই সময়ে কোনো রেকর্ড নেই।</td></tr>';
  }

  function printReport(scope) {
    var st = reportFilters[scope];
    var title = "", body = "", landscape = false;

    if (scope === "orders") {
      title = "অর্ডার রিপোর্ট";
      landscape = true;
      var rows = ordersCache.filter(function (o) { return dateInRange(o.created_at, st); });
      var sum = 0;
      var bodyHtml = rows.map(function (o) {
        sum += Number(o.total) || 0;
        return '<tr><td>' + escapeHtml(fmtDate(o.created_at)) + '</td>' +
          '<td>' + escapeHtml(o.name) + '</td>' +
          '<td>' + escapeHtml(o.mobile) + '</td>' +
          '<td>' + escapeHtml(o.username) + '</td>' +
          '<td>' + escapeHtml(orderTitlesText(o)) + '</td>' +
          '<td>৳' + escapeHtml(o.total) + '</td>' +
          '<td>' + escapeHtml(o.bkash_sender) + '</td>' +
          '<td>' + escapeHtml(o.trxid) + '</td>' +
          '<td>' + escapeHtml(plainStatus(o.status)) + '</td></tr>';
      }).join("");
      if (!rows.length) bodyHtml = pEmptyRow(9);
      body = pTableHtml(
        ["তারিখ", "নাম", "মোবাইল", "ইউজারনেম", "পণ্য", "মোট", "বিকাশ নম্বর", "TrxID", "স্ট্যাটাস"],
        bodyHtml,
        '<tr><td colspan="5">সর্বমোট (' + rows.length + 'টি অর্ডার)</td><td colspan="4">৳' + sum + '</td></tr>');
    }

    else if (scope === "results") {
      title = "কুইজের ফলাফল রিপোর্ট";
      var rrows = resCacheRows.filter(function (r) { return dateInRange(r.created_at, st); });
      var rBody = rrows.map(function (row) {
        var q = resQuizMap[row.quiz_id];
        var cSlug = q ? q.course_slug : "";
        var c = cSlug ? pmCourseBySlug(cSlug) : null;
        return '<tr><td>' + escapeHtml(row.username) + '</td>' +
          '<td>' + escapeHtml(q ? q.title : ("কুইজ #" + row.quiz_id)) + '</td>' +
          '<td>' + escapeHtml(c ? c.title : courseTitle(cSlug)) + '</td>' +
          '<td>' + escapeHtml(row.score) + ' / ' + escapeHtml(row.total) + '</td>' +
          '<td>' + escapeHtml(fmtDate(row.created_at)) + '</td></tr>';
      }).join("");
      if (!rrows.length) rBody = pEmptyRow(5);
      body = pTableHtml(["ছাত্র", "কুইজ", "কোর্স", "স্কোর", "তারিখ"], rBody,
        '<tr><td colspan="5">মোট ফলাফল: ' + rrows.length + 'টি</td></tr>');
    }

    else if (scope === "revenue") {
      title = "বিক্রয় ও আয় রিপোর্ট";
      var all = revCacheOrders || [];
      var approved = all.filter(isApprovedOrder).filter(function (o) { return dateInRange(o.created_at, st); });
      var scopedAll = all.filter(function (o) { return dateInRange(o.created_at, st); });
      var pendCount = scopedAll.filter(function (o) { return o.status === "pending"; }).length;
      var totalSum = approved.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
      body = '<table class="p-table"><tbody>' +
        '<tr><th>নির্বাচিত সময়ের আয়</th><td>৳' + totalSum + '</td>' +
        '<th>অনুমোদিত অর্ডার</th><td>' + approved.length + 'টি</td></tr>' +
        '<tr><th>মোট অর্ডার (সময়ে)</th><td>' + scopedAll.length + 'টি</td>' +
        '<th>অপেক্ষমাণ অর্ডার (সময়ে)</th><td>' + pendCount + 'টি</td></tr>' +
        '</tbody></table>';

      var itemMap = {};
      approved.forEach(function (o) {
        (o.items || []).forEach(function (it) {
          if (!it) return;
          var key = it.title || it.slug || "—";
          if (!itemMap[key]) itemMap[key] = { count: 0, sum: 0 };
          itemMap[key].count += 1;
          var price = (typeof it.price === "number") ? it.price : 0;
          if (!price && it.slug && typeof ssaFindItem === "function") {
            var found = ssaFindItem(it.slug);
            if (found) price = found.price || 0;
          }
          itemMap[key].sum += price;
        });
      });
      var itemKeys = Object.keys(itemMap).sort(function (a, b) { return itemMap[b].sum - itemMap[a].sum; });
      var iBody = itemKeys.map(function (k) {
        return '<tr><td>' + escapeHtml(k) + '</td><td>' + itemMap[k].count + '</td><td>৳' + itemMap[k].sum + '</td></tr>';
      }).join("");
      if (!itemKeys.length) iBody = pEmptyRow(3);
      body += '<div class="p-sec">পণ্য অনুযায়ী বিক্রি</div>' +
        pTableHtml(["পণ্যের নাম", "বিক্রি", "আয়"], iBody,
          '<tr><td>সর্বমোট</td><td>' + approved.length + 'টি</td><td>৳' + totalSum + '</td></tr>');

      var sBody = approved.map(function (o) {
        return '<tr><td>' + escapeHtml(fmtDate(o.created_at)) + '</td>' +
          '<td>' + escapeHtml(o.name) + '</td>' +
          '<td>' + escapeHtml(orderTitlesText(o)) + '</td>' +
          '<td>৳' + escapeHtml(o.total) + '</td></tr>';
      }).join("");
      if (!approved.length) sBody = pEmptyRow(4);
      body += '<div class="p-sec">বিক্রির তালিকা</div>' +
        pTableHtml(["তারিখ", "কাস্টমার", "পণ্য", "টাকা"], sBody,
          '<tr><td colspan="3">সর্বমোট</td><td>৳' + totalSum + '</td></tr>');
    }

    else if (scope === "finance") {
      title = "আয়-ব্যয় রিপোর্ট";
      var fm = finMergedRows(st);
      var fBody = fm.rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.date) + '</td>' +
          '<td>' + (row.type === "income" ? "আয়" : "ব্যয়") + '</td>' +
          '<td>' + escapeHtml(row.title) +
            (row.note ? '<br>' + escapeHtml(row.note) : "") + '</td>' +
          '<td>৳' + escapeHtml(row.amount) + '</td></tr>';
      }).join("");
      if (!fm.rows.length) fBody = pEmptyRow(4);
      body = '<table class="p-table"><tbody><tr>' +
        '<th>মোট আয় (সময়ে)</th><td>৳' + fm.income + '</td>' +
        '<th>মোট ব্যয় (সময়ে)</th><td>৳' + fm.expense + '</td>' +
        '<th>ব্যালেন্স (আয় − ব্যয়)</th><td>৳' + (fm.income - fm.expense) + '</td>' +
        '</tr></tbody></table>' +
        '<div class="p-sec">এন্ট্রির তালিকা</div>' +
        pTableHtml(["তারিখ", "ধরন", "বিবরণ", "টাকা"], fBody,
          '<tr><td colspan="3">মোট আয়</td><td>৳' + fm.income + '</td></tr>' +
          '<tr><td colspan="3">মোট ব্যয়</td><td>৳' + fm.expense + '</td></tr>' +
          '<tr><td colspan="3">ব্যালেন্স</td><td>৳' + (fm.income - fm.expense) + '</td></tr>');
    }

    else if (scope === "reports") {
      title = "কাস্টমার রিপোর্ট";
      var fOrders = repOrdersInRange(), fEnrolls = repEnrollmentsInRange(), fResults = repResultsInRange();
      body = '<table class="p-table"><tbody><tr>' +
        '<th>মোট কাস্টমার</th><td>' + repProfiles.length + '</td>' +
        '<th>মোট অর্ডার (সময়ে)</th><td>' + fOrders.length + '</td>' +
        '<th>মোট ভর্তি (সময়ে)</th><td>' + fEnrolls.length + '</td>' +
        '<th>মোট কুইজ ফলাফল (সময়ে)</th><td>' + fResults.length + '</td>' +
        '</tr></tbody></table>';
      var cBody = repProfiles.map(function (p) {
        var oc = fOrders.filter(function (o) { return String(o.user_id) === String(p.id); }).length;
        var ec = fEnrolls.filter(function (e) { return String(e.user_id) === String(p.id); }).length;
        var rc = fResults.filter(function (r) {
          return String(r.user_id) === String(p.id) ||
            (r.user_id == null && p.username && r.username === p.username);
        }).length;
        return '<tr><td>' + escapeHtml(p.name) + '</td>' +
          '<td>' + escapeHtml(p.username) + '</td>' +
          '<td>' + escapeHtml(p.mobile) + '</td>' +
          '<td>' + oc + '</td><td>' + ec + '</td><td>' + rc + '</td></tr>';
      }).join("");
      if (!repProfiles.length) cBody = pEmptyRow(6);
      body += '<div class="p-sec">কাস্টমার অনুযায়ী হিসাব (নির্বাচিত সময়ে)</div>' +
        pTableHtml(["নাম", "ইউজারনেম", "মোবাইল", "অর্ডার", "ভর্তি", "কুইজ ফলাফল"], cBody,
          '<tr><td colspan="3">সর্বমোট</td><td>' + fOrders.length + '</td><td>' + fEnrolls.length + '</td><td>' + fResults.length + '</td></tr>');

      var compRowsP = completionRows();
      var compBody = compRowsP.map(function (r) {
        return '<tr><td>' + escapeHtml(r.name) + '</td>' +
          '<td>' + escapeHtml(r.course) + '</td>' +
          '<td>' + r.done + ' / ' + r.total + '</td>' +
          '<td>' + r.pct + '%</td>' +
          '<td>' + (r.completed ? "সম্পন্ন" : "চলমান") + '</td></tr>';
      }).join("");
      if (!compRowsP.length) compBody = pEmptyRow(5);
      var compDoneP = compRowsP.filter(function (r) { return r.completed; }).length;
      body += '<div class="p-sec">কোর্স সম্পন্নকারী (' + compDoneP + ' জন পূর্ণ সম্পন্ন)</div>' +
        pTableHtml(["ছাত্র", "কোর্স", "লেসন", "অগ্রগতি", "স্ট্যাটাস"], compBody, "");

      if (repOpenId) {
        var p = null;
        for (var i = 0; i < repProfiles.length; i++) {
          if (String(repProfiles[i].id) === String(repOpenId)) { p = repProfiles[i]; break; }
        }
        if (p) {
          var dOrders = fOrders.filter(function (o) { return String(o.user_id) === String(p.id); });
          var dEnrolls = fEnrolls.filter(function (e) { return String(e.user_id) === String(p.id); });
          var dResults = fResults.filter(function (r) {
            return String(r.user_id) === String(p.id) ||
              (r.user_id == null && p.username && r.username === p.username);
          });
          body += '<div class="p-sec">' + escapeHtml(p.name || p.username || "") + ' — পূর্ণ রিপোর্ট</div>';
          var doBody = dOrders.map(function (o) {
            return '<tr><td>' + escapeHtml(fmtDate(o.created_at)) + '</td>' +
              '<td>' + escapeHtml(orderTitlesText(o)) + '</td>' +
              '<td>৳' + escapeHtml(o.total) + '</td>' +
              '<td>' + escapeHtml(o.trxid) + '</td>' +
              '<td>' + escapeHtml(plainStatus(o.status)) + '</td></tr>';
          }).join("");
          if (!dOrders.length) doBody = pEmptyRow(5);
          body += '<div class="p-sub">অর্ডার (' + dOrders.length + ')</div>' +
            pTableHtml(["তারিখ", "পণ্য", "মোট", "TrxID", "স্ট্যাটাস"], doBody, "");
          var deBody = dEnrolls.map(function (e) {
            return '<tr><td>' + escapeHtml(courseTitle(e.course_slug)) + '</td>' +
              '<td>' + escapeHtml(fmtDate(e.created_at)) + '</td></tr>';
          }).join("");
          if (!dEnrolls.length) deBody = pEmptyRow(2);
          body += '<div class="p-sub">কোর্স — ভর্তি (' + dEnrolls.length + ')</div>' +
            pTableHtml(["কোর্স", "তারিখ"], deBody, "");
          var drBody = dResults.map(function (r) {
            var q = repQuizMap[r.quiz_id];
            return '<tr><td>' + escapeHtml(q ? q.title : ("কুইজ #" + r.quiz_id)) + '</td>' +
              '<td>' + escapeHtml(r.score) + ' / ' + escapeHtml(r.total) + '</td>' +
              '<td>' + escapeHtml(fmtDate(r.created_at)) + '</td></tr>';
          }).join("");
          if (!dResults.length) drBody = pEmptyRow(3);
          body += '<div class="p-sub">কুইজের ফলাফল (' + dResults.length + ')</div>' +
            pTableHtml(["কুইজ", "স্কোর", "তারিখ"], drBody, "");
        }
      }
    }

    else if (scope === "reviews") {
      title = "ছাত্রদের রিভিউ রিপোর্ট";
      var rvRows = revRows.filter(function (r) { return dateInRange(r.created_at, st); });
      var rvSum = 0;
      rvRows.forEach(function (r) { rvSum += Number(r.rating) || 0; });
      var rvAvg = rvRows.length ? Math.round(rvSum * 10 / rvRows.length) / 10 : 0;
      var rvBody = rvRows.map(function (r) {
        return '<tr><td>' + escapeHtml(revStudentName(r)) + '</td>' +
          '<td>' + escapeHtml(courseTitle(r.course_slug)) + '</td>' +
          '<td>' + starsText(r.rating) + ' (' + escapeHtml(r.rating) + '/5)</td>' +
          '<td>' + escapeHtml(r.review_text || "") + '</td>' +
          '<td>' + escapeHtml(fmtDate(r.created_at)) + '</td></tr>';
      }).join("");
      if (!rvRows.length) rvBody = pEmptyRow(5);
      body = '<table class="p-table"><tbody><tr>' +
        '<th>মোট রিভিউ (সময়ে)</th><td>' + rvRows.length + 'টি</td>' +
        '<th>গড় রেটিং</th><td>' + (rvRows.length ? rvAvg + ' / 5' : '—') + '</td>' +
        '</tr></tbody></table>' +
        '<div class="p-sec">রিভিউয়ের তালিকা</div>' +
        pTableHtml(["ছাত্র", "কোর্স", "রেটিং", "মতামত", "তারিখ"], rvBody,
          '<tr><td colspan="5">মোট রিভিউ: ' + rvRows.length + 'টি · গড় রেটিং: ' +
          (rvRows.length ? rvAvg + ' / 5' : '—') + '</td></tr>');
    }

    else if (scope === "nowshin") {
      title = "Nowshin ফিডব্যাক রিপোর্ট";
      var nwRows = nwRowsCache.filter(function (r) { return dateInRange(r.created_at, st); });
      var nwUp = nwRows.filter(function (r) { return r.vote === "up"; }).length;
      var nwDown = nwRows.length - nwUp;
      var nwHappy = nwRows.length ? Math.round(nwUp * 100 / nwRows.length) : null;
      body = '<table class="p-table"><tbody><tr>' +
        '<th>মোট ভোট (সময়ে)</th><td>' + nwRows.length + 'টি</td>' +
        '<th>👍 খুশি</th><td>' + nwUp + 'টি</td>' +
        '<th>👎 খুশি নয়</th><td>' + nwDown + 'টি</td>' +
        '<th>খুশির হার</th><td>' + (nwHappy == null ? '—' : nwHappy + '%') + '</td>' +
        '</tr></tbody></table>';
      var tq = topQuestions(nwRows, 10);
      var tqBody = tq.map(function (t) {
        return '<tr><td>' + escapeHtml(t.q) + '</td><td>' + t.count + ' বার</td></tr>';
      }).join("");
      if (!tq.length) tqBody = pEmptyRow(2);
      body += '<div class="p-sec">সবচেয়ে বেশি জিজ্ঞেস করা প্রশ্ন</div>' +
        pTableHtml(["প্রশ্ন", "কতবার"], tqBody, "");
      var dnBody = nwRows.filter(function (r) { return r.vote === "down"; }).map(function (r) {
        return '<tr><td>' + escapeHtml(r.question || "") + '</td>' +
          '<td>' + escapeHtml(r.answer || "") + '</td>' +
          '<td>' + escapeHtml(fmtDate(r.created_at)) + '</td></tr>';
      }).join("");
      if (!nwDown) dnBody = pEmptyRow(3);
      body += '<div class="p-sec">👎 পাওয়া উত্তর — যা ঠিক করা দরকার</div>' +
        pTableHtml(["প্রশ্ন", "Nowshin-এর উত্তর", "তারিখ"], dnBody, "");
    }

    if (!title) return;
    var area = $("ssaPrintArea");
    if (!area) {
      area = document.createElement("div");
      area.id = "ssaPrintArea";
      document.body.appendChild(area);
    }
    area.className = landscape ? "p-land" : "";
    area.innerHTML =
      '<div class="p-head"><img class="p-logo" src="assets/logo-mark.png" alt="Self Scale Academy logo"><div><div class="p-brand">Self Scale Academy</div><div class="p-tag">Explore Yourself</div></div></div>' +
      '<div class="p-title">' + escapeHtml(title) + '</div>' +
      '<div class="p-meta">সময়কাল: ' + escapeHtml(periodText(st)) + '</div>' +
      '<div class="p-meta">তৈরির তারিখ: ' + escapeHtml(fmtDate(new Date().toISOString())) + '</div>' +
      body +
      '<div class="p-foot">Self Scale Academy — Explore Yourself • Super Admin রিপোর্ট • ssa-lms-app.vercel.app</div>';
    document.body.classList.add("ssa-printing");
    setTimeout(function () {
      try { window.print(); } catch (e) {}
      setTimeout(function () { document.body.classList.remove("ssa-printing"); }, 800);
    }, 40);
  }
  window.addEventListener("afterprint", function () {
    document.body.classList.remove("ssa-printing");
  });

  /* ================= Phase 11: income & expense (আয়-ব্যয়) =============
     Founder order 2026-10-22: full income–expense management in Super
     Admin — "Will u add for any expense income management" (approved
     ❤️), saved "in drive through google sheet with high security" and
     "if mistake there will be editable".
     Design: Supabase is the PRIMARY store (table finance_entries,
     admin-only RLS — see supabase/finance_entries.sql); every manual
     entry can be Edited or Deleted here, so mistakes are correctable.
     The Google Sheet (his own Drive, his account only) is his readable
     copy — entries upsert to the "আয়-ব্যয়" tab through the same
     bridge as sales (window.SSA_SHEET_URL), keyed by EntryID so an
     edit re-sync updates the same Sheet row instead of duplicating.
     APPROVED sales count as income automatically: merged LIVE from
     orders (same source as the Revenue tab), clearly labelled, never
     written into finance_entries and never editable here — so a sale
     can never be double-counted. Period totals + balance follow the
     Phase 10 date filter; the PDF uses the same print machinery.
     Until the finance_entries SQL runs (deploy batch), the tab shows
     a clean setup-pending message instead of breaking. */

  var finEntries = [];        /* manual rows from finance_entries */
  var finOrders = [];         /* orders — approved ones become sales income */
  var finLoaded = false;      /* entries query has succeeded */
  var finSetupPending = false;
  var finEditingId = null;

  function finSheetUrl() {
    try { return window.SSA_SHEET_URL || ""; } catch (e) { return ""; }
  }
  function fmtMoney(n) {
    n = Number(n) || 0;
    return String(Math.round(n * 100) / 100);
  }

  /* One merged view: manual entries + approved-sales income, scoped
     to the date filter. Manual entry dates are plain YYYY-MM-DD, so a
     string compare is exact; sales go through the shared dateInRange
     on their order created_at. Returns rows (newest date first) plus
     income / expense totals for the period. */
  function finMergedRows(st) {
    st = st || reportFilters.finance;
    var rows = [];
    finEntries.forEach(function (e) {
      if (st.from && e.entry_date < st.from) return;
      if (st.to && e.entry_date > st.to) return;
      rows.push({
        id: e.id, sales: false, date: e.entry_date || "",
        type: e.type, title: e.title || "", note: e.note || "",
        amount: Number(e.amount) || 0
      });
    });
    finOrders.filter(isApprovedOrder).forEach(function (o) {
      if (!dateInRange(o.created_at, st)) return;
      var d = new Date(o.created_at);
      rows.push({
        id: "sale-" + o.id, sales: true,
        date: isNaN(d.getTime()) ? "" : dateKeyOf(d),
        type: "income",
        title: "বিক্রয় আয় — " + (orderTitlesText(o) || "অর্ডার"),
        note: "অনুমোদিত অর্ডার" + (o.name ? " · " + o.name : ""),
        amount: Number(o.total) || 0
      });
    });
    rows.sort(function (a, b) {
      if (a.date === b.date) return 0;
      return a.date < b.date ? 1 : -1;
    });
    var income = 0, expense = 0;
    rows.forEach(function (r) {
      if (r.type === "income") income += r.amount; else expense += r.amount;
    });
    return { rows: rows, income: income, expense: expense };
  }

  function renderFinSetupPending() {
    var sum = $("finSummary"), wrap = $("finWrap");
    if (sum) sum.innerHTML = "";
    setFilterCount("finance", "");
    var sBtn = $("finSheetSyncBtn");
    if (sBtn) sBtn.style.display = "none";
    if (wrap) {
      wrap.innerHTML = '<p class="empty-note">সেটআপ বাকি আছে — আয়-ব্যয়ের ডাটাবেস টেবিলটি ' +
        '(finance_entries) এখনো তৈরি হয়নি। ডিপ্লয়ের সময় CEO SQL চালিয়ে দিলেই এই ট্যাবটি ' +
        'পুরোপুরি চালু হয়ে যাবে। ততক্ষণ বাকি সব ট্যাব আগের মতোই চলছে।</p>';
    }
  }

  function renderFinance() {
    if (finSetupPending) { renderFinSetupPending(); return; }
    var wrap = $("finWrap"), sum = $("finSummary");
    var st = reportFilters.finance;
    var m = finMergedRows(st);
    setFilterCount("finance", "সময়কাল: " + periodText(st) +
      " — মোট " + m.rows.length + "টি এন্ট্রি দেখানো হচ্ছে");
    sum.innerHTML = '<div class="fin-stats">' +
      '<div class="fin-stat in"><span>মোট আয়</span><b>৳' + fmtMoney(m.income) + '</b></div>' +
      '<div class="fin-stat out"><span>মোট ব্যয়</span><b>৳' + fmtMoney(m.expense) + '</b></div>' +
      '<div class="fin-stat bal"><span>ব্যালেন্স (আয় − ব্যয়)</span><b>৳' + fmtMoney(m.income - m.expense) + '</b></div>' +
      '</div>';
    var sBtn = $("finSheetSyncBtn");
    if (sBtn) sBtn.style.display = finSheetUrl() ? "" : "none";
    if (!m.rows.length) {
      wrap.innerHTML = finEntries.length
        ? '<p class="empty-note">এই সময়ে কোনো এন্ট্রি নেই। অন্য সময়কাল বেছে দেখুন।</p>'
        : '<p class="empty-note">এখনো কোনো এন্ট্রি নেই। ওপরের ফর্ম দিয়ে প্রথম আয় বা ব্যয় যোগ করুন।</p>';
      return;
    }
    var html = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>তারিখ</th><th>ধরন</th><th>শিরোনাম / বিবরণ</th><th>টাকা</th><th></th>' +
      '</tr></thead><tbody>';
    html += m.rows.map(function (row) {
      var tag = row.type === "income"
        ? '<span class="tag tag-ok">আয়</span>'
        : '<span class="tag tag-exp">ব্যয়</span>';
      var actions;
      if (row.sales) {
        actions = '<span style="color:var(--muted);font-size:13px">বিক্রয় — শুধু দেখার জন্য</span>';
      } else {
        actions = '<button class="btn sm" type="button" data-fin-edit="' + row.id + '">Edit</button>' +
          (IS_SUPER ? ' <button class="btn sm neutral" type="button" data-fin-del="' + row.id + '">মুছুন</button>' : '');
      }
      return '<tr><td class="en">' + escapeHtml(row.date) + '</td>' +
        '<td>' + tag + (row.sales ? ' <span class="tag tag-pend">বিক্রয়</span>' : '') + '</td>' +
        '<td>' + escapeHtml(row.title) +
          (row.note ? '<br><span style="color:var(--muted)">' + escapeHtml(row.note) + '</span>' : '') + '</td>' +
        '<td class="en">৳' + escapeHtml(fmtMoney(row.amount)) + '</td>' +
        '<td class="row-actions">' + actions + '</td></tr>';
    }).join("");
    html += '</tbody></table></div>' +
      '<p style="margin-top:12px;color:var(--muted);font-size:14px">বিক্রয় আয় অনুমোদিত অর্ডার থেকে ' +
      'নিজে নিজে এসেছে — তা বদলাতে হলে অর্ডার ট্যাব থেকে করুন। বাকি সব এন্ট্রি এখানেই Edit করে ' +
      'ঠিক করা যায়, ভুল হলে মুছেও ফেলা যায়।</p>';
    wrap.innerHTML = html;
  }

  function loadFinance() {
    var wrap = $("finWrap");
    if (!finLoaded && !finSetupPending) {
      wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    }
    function guard(p) {
      return p.then(function (r) { return r; }, function () { return { error: true }; });
    }
    var entriesQ = guard(window.SSA_DB.from("finance_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }));
    var ordersQ = guard(window.SSA_DB.from("orders").select("*")
      .order("created_at", { ascending: false }));
    Promise.all([entriesQ, ordersQ]).then(function (res) {
      finOrders = (!res[1].error && res[1].data) ? res[1].data : [];
      if (res[0].error) {
        /* Table missing (SQL not run yet) or not permitted: clean
           setup-pending state, never a broken tab. */
        finSetupPending = true;
        finLoaded = false;
        renderFinSetupPending();
        return;
      }
      finSetupPending = false;
      finLoaded = true;
      finEntries = res[0].data || [];
      renderFinance();
    });
  }

  function finResetForm() {
    finEditingId = null;
    var f = $("finForm");
    if (f) f.reset();
    var dEl = $("finDate");
    if (dEl) dEl.value = dateKeyOf(new Date());
    $("finFormTitle").textContent = "নতুন এন্ট্রি যোগ করুন";
    $("finSave").textContent = "এন্ট্রি সেভ করুন";
    $("finCancelEdit").style.display = "none";
  }

  function finFillForm(e) {
    finEditingId = e.id;
    $("finType").value = e.type === "expense" ? "expense" : "income";
    $("finDate").value = e.entry_date || "";
    $("finTitle").value = e.title || "";
    $("finAmount").value = e.amount;
    $("finNote").value = e.note || "";
    $("finFormTitle").textContent = "এন্ট্রি সম্পাদনা করুন";
    $("finSave").textContent = "বদল সেভ করুন";
    $("finCancelEdit").style.display = "";
    if ($("finForm").scrollIntoView) $("finForm").scrollIntoView({ block: "nearest" });
  }

  function saveFinanceEntry(ev) {
    ev.preventDefault();
    var msg = $("finMsg");
    var type = $("finType").value === "expense" ? "expense" : "income";
    var date = $("finDate").value;
    var title = $("finTitle").value.trim();
    var amount = parseFloat($("finAmount").value);
    var note = $("finNote").value.trim();
    if (!date) { showMsg(msg, "তারিখ দিন।", false); return; }
    if (!title) { showMsg(msg, "শিরোনাম / ক্যাটাগরি লিখুন।", false); return; }
    if (isNaN(amount) || amount <= 0) {
      showMsg(msg, "সঠিক টাকার পরিমাণ দিন — ০-এর বেশি হতে হবে।", false);
      return;
    }
    if (finSetupPending) {
      showMsg(msg, "সেটআপ এখনো বাকি — টেবিল তৈরি হলে এন্ট্রি সেভ হবে।", false);
      return;
    }
    var wasEdit = !!finEditingId;
    var row = {
      entry_date: date, type: type, title: title,
      amount: amount, note: note || null,
      updated_at: new Date().toISOString()
    };
    var btn = $("finSave");
    btn.disabled = true;
    if (!wasEdit) row.created_by = MY_ID;
    var q = wasEdit
      ? window.SSA_DB.from("finance_entries").update(row).eq("id", finEditingId)
      : window.SSA_DB.from("finance_entries").insert(row).select().single();
    q.then(function (r) {
      btn.disabled = false;
      if (r.error) {
        finSetupPending = true;
        renderFinSetupPending();
        showMsg(msg, "এন্ট্রি সেভ করা যায়নি — সম্ভবত সেটআপ (টেবিল) এখনো বাকি। CEO-কে বলুন।", false);
        return;
      }
      var saved = (r.data && r.data.id) ? r.data
        : { id: finEditingId, entry_date: date, type: type, title: title, amount: amount, note: note };
      showMsg(msg, wasEdit ? "এন্ট্রি ঠিক করা হয়েছে।" : "এন্ট্রি যোগ হয়েছে।", true);
      finResetForm();
      loadFinance();
      finSheetSyncEntry(saved, "upsert");
    }, function () {
      btn.disabled = false;
      showMsg(msg, "এন্ট্রি সেভ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।", false);
    });
  }

  function deleteFinanceEntry(id) {
    var e = null;
    finEntries.forEach(function (x) { if (String(x.id) === String(id)) e = x; });
    if (!e) return;
    if (!window.confirm("আপনি কি নিশ্চিত? এই এন্ট্রিটি মুছে যাবে: " + (e.title || ""))) return;
    window.SSA_DB.from("finance_entries").delete().eq("id", e.id)
      .then(function (r) {
        if (r.error) {
          showMsg($("finMsg"), "এন্ট্রি মোছা যায়নি। আবার চেষ্টা করুন।", false);
          return;
        }
        if (String(finEditingId) === String(e.id)) finResetForm();
        showMsg($("finMsg"), "এন্ট্রি মোছা হয়েছে।", true);
        loadFinance();
        finSheetSyncEntry(e, "delete");
      }, function () {
        showMsg($("finMsg"), "এন্ট্রি মোছা যায়নি। ইন্টারনেট সংযোগ দেখুন।", false);
      });
  }

  /* ---- Google Sheet copy (his Drive — bridge, EntryID-keyed) ---- */
  function finSheetSyncEntry(entry, action) {
    var url = finSheetUrl();
    if (!url || !entry || entry.id == null) return;
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          type: "finance",
          action: action || "upsert",
          id: entry.id,
          entry_date: entry.entry_date || "",
          ftype: entry.type || "",
          title: entry.title || "",
          amount: entry.amount || "",
          note: entry.note || "",
          t: new Date().toISOString()
        })
      }).then(function () {}, function () {});
    } catch (e) {}
  }

  function syncAllFinance() {
    var msg = $("finSheetMsg");
    function say(t) { if (msg) msg.textContent = t; }
    if (!finSheetUrl()) { say("Google Sheet এখনো যুক্ত হয়নি — CEO-কে বলুন।"); return; }
    if (finSetupPending) { say("সেটআপ বাকি — টেবিল তৈরি হলে পাঠানো যাবে।"); return; }
    if (!finEntries.length) { say("পাঠানোর মতো এন্ট্রি নেই।"); return; }
    say("পাঠানো হচ্ছে… (" + finEntries.length + "টি এন্ট্রি)");
    var idx = 0, total = finEntries.length;
    function step() {
      if (idx >= total) { say(total + "টি এন্ট্রি Google Sheet-এ পাঠানো হয়েছে।"); return; }
      finSheetSyncEntry(finEntries[idx++], "upsert");
      setTimeout(step, 150);
    }
    step();
  }

  /* ================= Phase 12: completions + reviews + Nowshin
     insights + AI Analyst ==========================================
     Founder orders 2026-10-22: (A) "Who completed Full Courses can
     we check or get data?" (B) "Can we read their feedback and
     analyse them, through their Review?" (C) "Add AI Analyst who
     help me all Report instantly — Only Super Admin." (D) "What
     people ask to Nowshin — are they happy with the answer or not?"
     Completions reuse the Reports data (enrollments + lesson_progress
     + lessons + quiz_results, already loaded by loadReports) and the
     Reports date filter + PDF. Reviews and Nowshin feedback read the
     tables from supabase/reviews.sql — until that SQL runs, both tabs
     show a clean setup-pending note, never a broken page. */

  /* ---- (A) completions: one row per student × enrolled course ---- */
  function completionRows() {
    var profMap = {};
    repProfiles.forEach(function (p) { profMap[String(p.id)] = p; });
    var quizByUC = {};
    repResults.forEach(function (r) {
      var q = repQuizMap[r.quiz_id];
      if (!q || !q.course_slug || r.user_id == null) return;
      var total = Number(r.total) || 0;
      if (!total) return;
      var key = String(r.user_id) + "|" + q.course_slug;
      if (!quizByUC[key]) quizByUC[key] = { sum: 0, n: 0 };
      quizByUC[key].sum += (Number(r.score) || 0) * 100 / total;
      quizByUC[key].n++;
    });
    var rows = repEnrollmentsInRange().map(function (e) {
      var done = 0;
      repProgress.forEach(function (pr) {
        if (String(pr.user_id) === String(e.user_id) &&
            repLessonSlug[pr.lesson_id] === e.course_slug) done++;
      });
      var total = repLessonCount[e.course_slug];
      if (typeof total !== "number") total = 0;
      if (done > total) done = total;
      var p = profMap[String(e.user_id)];
      var qa = quizByUC[String(e.user_id) + "|" + e.course_slug];
      return {
        user_id: e.user_id,
        name: (p && (p.name || p.username)) || e.username || "—",
        course_slug: e.course_slug,
        course: courseTitle(e.course_slug),
        done: done, total: total,
        pct: total > 0 ? Math.round(done * 100 / total) : 0,
        completed: total > 0 && done >= total,
        quizAvg: qa ? Math.round(qa.sum / qa.n) : null,
        enrolled_at: e.created_at || ""
      };
    });
    rows.sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      return b.pct - a.pct;
    });
    return rows;
  }

  function renderCompletions() {
    var wrap = $("completionsWrap");
    if (!wrap || !repLoaded) return;
    var rows = completionRows();
    var doneCount = rows.filter(function (r) { return r.completed; }).length;
    if (!rows.length) {
      wrap.innerHTML = '<p class="empty-note">এই সময়ে কোনো ভর্তি নেই।</p>';
      return;
    }
    var html = '<p style="margin:0 0 10px">মোট ভর্তি (সময়ে): <b>' + rows.length +
      '</b> · পূর্ণ কোর্স সম্পন্ন: <b>' + doneCount + ' জন</b></p>';
    html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>ছাত্র</th><th>কোর্স</th><th>লেসন</th><th>অগ্রগতি</th><th>কুইজ গড়</th>' +
      '<th>স্ট্যাটাস</th><th>সার্টিফিকেট</th>' +
      '</tr></thead><tbody>';
    html += rows.map(function (r) {
      return '<tr><td>' + escapeHtml(r.name) + '</td>' +
        '<td class="en">' + escapeHtml(r.course) + '</td>' +
        '<td class="en">' + r.done + ' / ' + r.total + '</td>' +
        '<td><span class="en">' + r.pct + '%</span>' +
          '<span class="prog-mini"><span style="width:' + r.pct + '%"></span></span></td>' +
        '<td class="en">' + (r.quizAvg == null ? "—" : r.quizAvg + "%") + '</td>' +
        '<td>' + (r.completed
          ? '<span class="tag tag-ok">সম্পন্ন ✅</span>'
          : '<span class="tag tag-pend">চলমান</span>') + '</td>' +
        '<td>' + (r.completed ? '<span class="tag tag-ok">যোগ্য 🎓</span>' : '—') + '</td></tr>';
    }).join("");
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  /* ---- (B) student reviews ---- */
  var revRows = [];
  var revProfileMap = {};
  var revLoaded = false;
  var revSetupPending = false;

  function revStudentName(r) {
    var p = revProfileMap[String(r.user_id)];
    return (p && (p.name || p.username)) || "ছাত্র";
  }
  function starsText(n) {
    n = Math.max(0, Math.min(5, Number(n) || 0));
    var s = "";
    for (var i = 0; i < 5; i++) s += (i < n ? "★" : "☆");
    return s;
  }

  function loadReviews() {
    var wrap = $("reviewsWrap");
    if (!revLoaded && !revSetupPending) {
      wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    }
    function guard(p) {
      return p.then(function (r) { return r; }, function () { return { error: true }; });
    }
    Promise.all([
      guard(window.SSA_DB.from("reviews").select("*")
        .order("created_at", { ascending: false }).limit(300)),
      guard(window.SSA_DB.from("profiles").select("id, name, username")),
      fetchAllCourses(false)
    ]).then(function (res) {
      revProfileMap = {};
      if (!res[1].error && res[1].data) {
        res[1].data.forEach(function (p) { revProfileMap[String(p.id)] = p; });
      }
      if (res[0].error) {
        /* Table missing (SQL not run yet): clean setup-pending state. */
        revSetupPending = true;
        revLoaded = false;
        renderReviews();
        return;
      }
      revSetupPending = false;
      revLoaded = true;
      revRows = res[0].data || [];
      renderReviews();
    });
  }

  function renderReviews() {
    var wrap = $("reviewsWrap"), sum = $("reviewsSummary");
    if (revSetupPending) {
      if (sum) sum.innerHTML = "";
      setFilterCount("reviews", "");
      wrap.innerHTML = '<p class="empty-note">সেটআপ বাকি আছে — রিভিউয়ের ডাটাবেস টেবিলটি ' +
        '(reviews) এখনো তৈরি হয়নি। ডিপ্লয়ের সময় CEO SQL চালিয়ে দিলেই ছাত্ররা ড্যাশবোর্ড ' +
        'থেকে রিভিউ দিতে পারবে আর রিভিউগুলো এখানে দেখা যাবে।</p>';
      return;
    }
    var st = reportFilters.reviews;
    var rows = revRows.filter(function (r) { return dateInRange(r.created_at, st); });
    setFilterCount("reviews", "সময়কাল: " + periodText(st) +
      " — মোট " + rows.length + "টি রিভিউ দেখানো হচ্ছে (সবমোট " + revRows.length + "টি)");
    var totalRating = 0;
    var byCourse = {};
    rows.forEach(function (r) {
      totalRating += Number(r.rating) || 0;
      if (!byCourse[r.course_slug]) byCourse[r.course_slug] = { sum: 0, n: 0 };
      byCourse[r.course_slug].sum += Number(r.rating) || 0;
      byCourse[r.course_slug].n++;
    });
    var avg = rows.length ? Math.round(totalRating * 10 / rows.length) / 10 : 0;
    sum.innerHTML = '<div class="fin-stats">' +
      '<div class="fin-stat in"><span>মোট রিভিউ (সময়ে)</span><b>' + rows.length + 'টি</b></div>' +
      '<div class="fin-stat bal"><span>গড় রেটিং</span><b>' +
        (rows.length ? avg + ' / 5' : '—') + '</b></div>' +
      '</div>';
    if (!rows.length) {
      wrap.innerHTML = revRows.length
        ? '<p class="empty-note">এই সময়ে কোনো রিভিউ নেই। অন্য সময়কাল বেছে দেখুন।</p>'
        : '<p class="empty-note">এখনো কোনো ছাত্র রিভিউ দেয়নি। ছাত্ররা তাদের ড্যাশবোর্ডের "আমার রিভিউ" অংশ থেকে রিভিউ দিতে পারবে।</p>';
      return;
    }
    var courseKeys = Object.keys(byCourse).sort(function (a, b) {
      return byCourse[b].n - byCourse[a].n;
    });
    var html = '<h3 style="margin:4px 0 10px">কোর্স অনুযায়ী গড় রেটিং</h3>' +
      '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>কোর্স</th><th>রিভিউ</th><th>গড় রেটিং</th></tr></thead><tbody>';
    html += courseKeys.map(function (slug) {
      var c = byCourse[slug];
      var cavg = Math.round(c.sum * 10 / c.n) / 10;
      return '<tr><td class="en">' + escapeHtml(courseTitle(slug)) + '</td>' +
        '<td class="en">' + c.n + 'টি</td>' +
        '<td><span class="stars">' + starsText(Math.round(cavg)) + '</span> ' +
        '<span class="en">' + cavg + ' / 5</span></td></tr>';
    }).join("");
    html += '</tbody></table></div>';
    html += '<h3 style="margin:20px 0 10px">সব রিভিউ</h3>' +
      '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>ছাত্র</th><th>কোর্স</th><th>রেটিং</th><th>মতামত</th><th>তারিখ</th>' +
      '</tr></thead><tbody>';
    html += rows.map(function (r) {
      return '<tr><td>' + escapeHtml(revStudentName(r)) + '</td>' +
        '<td class="en">' + escapeHtml(courseTitle(r.course_slug)) + '</td>' +
        '<td><span class="stars">' + starsText(r.rating) + '</span> ' +
          '<span class="en">' + escapeHtml(r.rating) + '/5</span></td>' +
        '<td>' + escapeHtml(r.review_text || "—") + '</td>' +
        '<td>' + fmtDate(r.created_at) + '</td></tr>';
    }).join("");
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  /* ---- (D) Nowshin insights: what people ask + happy or not ---- */
  var nwRowsCache = [];
  var nwLoaded = false;
  var nwSetupPending = false;

  function normalizeQuestion(q) {
    return String(q || "").toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[\s?？।.!…]+$/, "")
      .replace(/^\s+|\s+$/g, "");
  }
  function topQuestions(rows, n) {
    var map = {}, keys = [];
    rows.forEach(function (r) {
      var k = normalizeQuestion(r.question);
      if (!k) return;
      if (!map[k]) { map[k] = { q: r.question, count: 0 }; keys.push(k); }
      map[k].count++;
    });
    return keys.map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, n || 10);
  }

  function loadNowshinInsights() {
    var wrap = $("nowshinWrap");
    if (!nwLoaded && !nwSetupPending) {
      wrap.innerHTML = '<p class="empty-note">লোড হচ্ছে…</p>';
    }
    function guard(p) {
      return p.then(function (r) { return r; }, function () { return { error: true }; });
    }
    guard(window.SSA_DB.from("nowshin_feedback").select("*")
      .order("created_at", { ascending: false }).limit(500))
      .then(function (r) {
        if (r.error) {
          nwSetupPending = true;
          nwLoaded = false;
          renderNowshinInsights();
          return;
        }
        nwSetupPending = false;
        nwLoaded = true;
        nwRowsCache = r.data || [];
        renderNowshinInsights();
      });
  }

  function renderNowshinInsights() {
    var wrap = $("nowshinWrap"), sum = $("nowshinSummary");
    if (nwSetupPending) {
      if (sum) sum.innerHTML = "";
      setFilterCount("nowshin", "");
      wrap.innerHTML = '<p class="empty-note">সেটআপ বাকি আছে — Nowshin ফিডব্যাকের ডাটাবেস ' +
        'টেবিলটি (nowshin_feedback) এখনো তৈরি হয়নি। ডিপ্লয়ের সময় CEO SQL চালিয়ে দিলেই ' +
        'ভোটের হিসাব এখানে দেখা যাবে। ততদিন সব চ্যাট ও ভোট আপনার Google Sheet-এর ' +
        '"Chats" ও "Nowshin Feedback" ট্যাবে জমা হচ্ছে।</p>';
      return;
    }
    var st = reportFilters.nowshin;
    var rows = nwRowsCache.filter(function (r) { return dateInRange(r.created_at, st); });
    setFilterCount("nowshin", "সময়কাল: " + periodText(st) +
      " — মোট " + rows.length + "টি ভোট দেখানো হচ্ছে (সবমোট " + nwRowsCache.length + "টি)");
    var up = rows.filter(function (r) { return r.vote === "up"; }).length;
    var down = rows.length - up;
    var happy = rows.length ? Math.round(up * 100 / rows.length) : null;
    sum.innerHTML = '<div class="fin-stats">' +
      '<div class="fin-stat"><span>মোট ভোট (সময়ে)</span><b>' + rows.length + 'টি</b></div>' +
      '<div class="fin-stat in"><span>👍 খুশি</span><b>' + up + 'টি</b></div>' +
      '<div class="fin-stat out"><span>👎 খুশি নয়</span><b>' + down + 'টি</b></div>' +
      '<div class="fin-stat bal"><span>খুশির হার</span><b>' +
        (happy == null ? '—' : happy + '%') + '</b></div>' +
      '</div>' +
      '<p style="margin:0 0 14px;color:var(--muted)">প্রতিটি চ্যাটের পুরো রেকর্ড আপনার নিজের ' +
      'Google Sheet-এর <b>Chats</b> ট্যাবে আর সব ভোটের কপি <b>Nowshin Feedback</b> ট্যাবেও জমা হয় — ' +
      'এই পেজের হিসাব (খুশির হার, বেশি জিজ্ঞেস করা প্রশ্ন, 👎 পাওয়া উত্তর) ডাটাবেসের ভোট থেকে তৈরি।</p>';
    if (!rows.length) {
      wrap.innerHTML = nwRowsCache.length
        ? '<p class="empty-note">এই সময়ে কোনো ভোট নেই। অন্য সময়কাল বেছে দেখুন।</p>'
        : '<p class="empty-note">এখনো কেউ Nowshin-এর উত্তরে 👍/👎 দেয়নি। চ্যাটে Nowshin উত্তর দিলেই তার নিচে ভোটের বোতাম আসবে।</p>';
      return;
    }
    var tq = topQuestions(rows, 10);
    var html = '<h3 style="margin:4px 0 10px">সবচেয়ে বেশি জিজ্ঞেস করা প্রশ্ন</h3>' +
      '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>প্রশ্ন</th><th>কতবার</th></tr></thead><tbody>';
    html += tq.length ? tq.map(function (t) {
      return '<tr><td>' + escapeHtml(t.q) + '</td><td class="en">' + t.count + ' বার</td></tr>';
    }).join("") : '<tr><td colspan="2">কোনো প্রশ্ন পাওয়া যায়নি।</td></tr>';
    html += '</tbody></table></div>';
    var downs = rows.filter(function (r) { return r.vote === "down"; });
    html += '<h3 style="margin:20px 0 10px">👎 পাওয়া উত্তর — যা ঠিক করা দরকার (' + downs.length + ')</h3>';
    if (!downs.length) {
      html += '<p class="empty-note">এই সময়ে কোনো 👎 নেই — সবাই উত্তরে খুশি। 🎉</p>';
    } else {
      html += '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
        '<th>প্রশ্ন</th><th>Nowshin-এর উত্তর</th><th>তারিখ</th>' +
        '</tr></thead><tbody>';
      html += downs.map(function (r) {
        var ans = String(r.answer || "");
        var short = ans.length > 300 ? ans.slice(0, 300) + "…" : ans;
        return '<tr><td>' + escapeHtml(r.question || "") + '</td>' +
          '<td title="' + escapeHtml(ans) + '">' + escapeHtml(short) + '</td>' +
          '<td>' + fmtDate(r.created_at) + '</td></tr>';
      }).join("");
      html += '</tbody></table></div>';
    }
    wrap.innerHTML = html;
  }

  /* ---- (C) AI Analyst — Super Admin only ---- */
  var ANALYST_API = "https://nowshin-api.vercel.app/api/analyst";
  var analystBusy = false;

  function aGuard(p) {
    return p.then(function (r) { return r; }, function () { return { error: true, data: null }; });
  }

  /* Compile the DATA PACK: aggregates exact, lists capped. Everything
     is read with the signed-in admin's own session — RLS decides what
     comes back, and every source is guarded so one missing table can
     never sink the whole pack. */
  function buildDataPack() {
    return Promise.all([
      aGuard(window.SSA_DB.from("orders").select("*")
        .order("created_at", { ascending: false }).limit(500)),
      aGuard(window.SSA_DB.from("finance_entries").select("*").limit(500)),
      aGuard(window.SSA_DB.from("enrollments").select("*").limit(500)),
      aGuard(window.SSA_DB.from("profiles").select("id, name, username, role")),
      aGuard(window.SSA_DB.from("lesson_progress").select("user_id, lesson_id")),
      aGuard(window.SSA_DB.from("lessons").select("id, course_slug")),
      aGuard(window.SSA_DB.from("quiz_results").select("*")
        .order("created_at", { ascending: false }).limit(300)),
      aGuard(window.SSA_DB.from("quizzes").select("id, title, course_slug")),
      aGuard(window.SSA_DB.from("reviews").select("*")
        .order("created_at", { ascending: false }).limit(100)),
      aGuard(window.SSA_DB.from("nowshin_feedback").select("*")
        .order("created_at", { ascending: false }).limit(300))
    ]).then(function (res) {
      function rows(i) { return (!res[i].error && res[i].data) ? res[i].data : []; }
      var orders = rows(0), fin = rows(1), enrolls = rows(2), profiles = rows(3);
      var progress = rows(4), lessons = rows(5), results = rows(6), quizzes = rows(7);
      var reviews = rows(8), feedback = rows(9);

      var monthKey = dateKeyOf(new Date()).slice(0, 7);
      function inThisMonth(iso) {
        var d = new Date(iso);
        return !isNaN(d.getTime()) && dateKeyOf(d).slice(0, 7) === monthKey;
      }
      var approved = orders.filter(isApprovedOrder);
      function sumTotal(list) {
        return list.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
      }
      var itemMap = {};
      approved.forEach(function (o) {
        (o.items || []).forEach(function (it) {
          if (!it) return;
          var key = it.title || it.slug || "—";
          if (!itemMap[key]) itemMap[key] = { count: 0, sum: 0 };
          itemMap[key].count++;
          var price = (typeof it.price === "number") ? it.price : 0;
          if (!price && it.slug && typeof ssaFindItem === "function") {
            var f = ssaFindItem(it.slug);
            if (f) price = f.price || 0;
          }
          itemMap[key].sum += price;
        });
      });
      var topItems = Object.keys(itemMap).map(function (k) {
        return { title: k, sold: itemMap[k].count, revenue: itemMap[k].sum };
      }).sort(function (a, b) { return b.sold - a.sold || b.revenue - a.revenue; }).slice(0, 5);

      var finIncome = 0, finExpense = 0, finIncomeMonth = 0, finExpenseMonth = 0;
      fin.forEach(function (e) {
        var amt = Number(e.amount) || 0;
        var thisMonth = String(e.entry_date || "").slice(0, 7) === monthKey;
        if (e.type === "income") { finIncome += amt; if (thisMonth) finIncomeMonth += amt; }
        else { finExpense += amt; if (thisMonth) finExpenseMonth += amt; }
      });
      var revenueTotal = sumTotal(approved);
      var revenueMonth = sumTotal(approved.filter(function (o) { return inThisMonth(o.created_at); }));

      var profMap = {};
      profiles.forEach(function (p) { profMap[String(p.id)] = p; });
      var lessonSlug = {}, lessonCount = {};
      lessons.forEach(function (l) {
        lessonSlug[l.id] = l.course_slug;
        lessonCount[l.course_slug] = (lessonCount[l.course_slug] || 0) + 1;
      });
      var doneByUC = {};
      progress.forEach(function (pr) {
        var slug = lessonSlug[pr.lesson_id];
        if (!slug) return;
        var key = String(pr.user_id) + "|" + slug;
        doneByUC[key] = (doneByUC[key] || 0) + 1;
      });
      var completions = enrolls.map(function (e) {
        var total = lessonCount[e.course_slug] || 0;
        var done = Math.min(doneByUC[String(e.user_id) + "|" + e.course_slug] || 0, total);
        var p = profMap[String(e.user_id)];
        return {
          student: (p && (p.name || p.username)) || e.username || "—",
          course: courseTitle(e.course_slug),
          lessons_done: done, lessons_total: total,
          completed: total > 0 && done >= total
        };
      });
      var completedList = completions.filter(function (c) { return c.completed; })
        .map(function (c) { return { student: c.student, course: c.course }; });

      var quizById = {};
      quizzes.forEach(function (q) { quizById[q.id] = q; });
      var quizPctSum = 0, quizPctN = 0;
      results.forEach(function (r) {
        var t = Number(r.total) || 0;
        if (!t) return;
        quizPctSum += (Number(r.score) || 0) * 100 / t;
        quizPctN++;
      });

      var revSum = 0, revByCourse = {};
      reviews.forEach(function (r) {
        revSum += Number(r.rating) || 0;
        var t = courseTitle(r.course_slug);
        if (!revByCourse[t]) revByCourse[t] = { sum: 0, n: 0 };
        revByCourse[t].sum += Number(r.rating) || 0;
        revByCourse[t].n++;
      });
      var revCourseList = Object.keys(revByCourse).map(function (k) {
        return { course: k, reviews: revByCourse[k].n,
                 average: Math.round(revByCourse[k].sum * 10 / revByCourse[k].n) / 10 };
      });

      var fbUp = feedback.filter(function (f) { return f.vote === "up"; }).length;

      var pack = {
        generated_at: new Date().toISOString(),
        reports_date_filter: periodText(reportFilters.reports),
        sales: {
          total_orders: orders.length,
          approved_orders: approved.length,
          pending_orders: orders.filter(function (o) { return o.status === "pending"; }).length,
          revenue_total_taka: revenueTotal,
          revenue_this_month_taka: revenueMonth,
          top_items_by_sales: topItems
        },
        finance_manual_entries: {
          income_total_taka: finIncome,
          expense_total_taka: finExpense,
          income_this_month_taka: finIncomeMonth,
          expense_this_month_taka: finExpenseMonth,
          balance_including_sales_taka: finIncome + revenueTotal - finExpense
        },
        students: {
          total_accounts: profiles.length,
          total_enrollments: enrolls.length,
          full_course_completions: completedList.length,
          completers: completedList.slice(0, 50),
          in_progress: completions.filter(function (c) { return !c.completed; }).slice(0, 30)
        },
        quizzes: {
          attempts: results.length,
          average_score_percent: quizPctN ? Math.round(quizPctSum / quizPctN) : null
        },
        reviews: {
          count: reviews.length,
          average_rating: reviews.length ? Math.round(revSum * 10 / reviews.length) / 10 : null,
          by_course: revCourseList,
          latest: reviews.slice(0, 10).map(function (r) {
            var p = profMap[String(r.user_id)];
            return {
              student: (p && (p.name || p.username)) || "ছাত্র",
              course: courseTitle(r.course_slug),
              rating: r.rating,
              text: String(r.review_text || "").slice(0, 200),
              date: r.created_at
            };
          })
        },
        nowshin_feedback: {
          total_votes: feedback.length,
          happy_votes: fbUp,
          unhappy_votes: feedback.length - fbUp,
          happy_percent: feedback.length ? Math.round(fbUp * 100 / feedback.length) : null,
          top_questions: topQuestions(feedback, 8).map(function (t) {
            return { question: t.q, times: t.count };
          }),
          recent_unhappy: feedback.filter(function (f) { return f.vote === "down"; })
            .slice(0, 5).map(function (f) {
              return { question: f.question || "",
                       answer: String(f.answer || "").slice(0, 200) };
            })
        }
      };
      return { pack: pack, summary: buildFallbackSummary(pack) };
    });
  }

  /* The no-AI fallback: the same pack rendered as plain Bangla lines,
     so a failed AI call still hands the Founder the real numbers. */
  function buildFallbackSummary(pack) {
    var s = pack.sales, f = pack.finance_manual_entries, st = pack.students;
    var q = pack.quizzes, rv = pack.reviews, nw = pack.nowshin_feedback;
    var lines = [];
    lines.push("মোট আয় (অনুমোদিত বিক্রয়): ৳" + s.revenue_total_taka +
      " · এই মাসে: ৳" + s.revenue_this_month_taka +
      " · মোট অর্ডার: " + s.total_orders + "টি (অনুমোদিত " + s.approved_orders +
      "টি, অপেক্ষমাণ " + s.pending_orders + "টি)");
    if (s.top_items_by_sales.length) {
      var t = s.top_items_by_sales[0];
      lines.push("সবচেয়ে বেশি বিক্রি: " + t.title + " — " + t.sold + " বার, ৳" + t.revenue);
    }
    lines.push("আয়-ব্যয় (ম্যানুয়াল এন্ট্রি): আয় ৳" + f.income_total_taka +
      ", ব্যয় ৳" + f.expense_total_taka +
      " · বিক্রয়সহ ব্যালেন্স: ৳" + f.balance_including_sales_taka);
    lines.push("ছাত্র: মোট অ্যাকাউন্ট " + st.total_accounts + "টি · মোট ভর্তি " +
      st.total_enrollments + "টি · পূর্ণ কোর্স সম্পন্ন করেছে " +
      st.full_course_completions + " জন");
    if (st.completers.length) {
      lines.push("সম্পন্নকারীরা: " + st.completers.map(function (c) {
        return c.student + " (" + c.course + ")";
      }).join(", "));
    }
    lines.push("কুইজ: মোট " + q.attempts + " বার দেওয়া হয়েছে" +
      (q.average_score_percent == null ? "" : " · গড় স্কোর " + q.average_score_percent + "%"));
    lines.push("রিভিউ: " + rv.count + "টি" +
      (rv.average_rating == null ? "" : " · গড় রেটিং " + rv.average_rating + " / 5"));
    if (rv.latest.length) {
      lines.push("সর্বশেষ রিভিউ: " + rv.latest.slice(0, 3).map(function (r) {
        return r.student + " — " + r.rating + "/5" +
          (r.text ? " — “" + r.text + "”" : "");
      }).join(" · "));
    }
    lines.push("Nowshin ফিডব্যাক: " + nw.total_votes + "টি ভোট" +
      (nw.happy_percent == null ? "" :
        " · খুশি " + nw.happy_percent + "% (👍 " + nw.happy_votes +
        " · 👎 " + nw.unhappy_votes + ")"));
    if (nw.top_questions.length) {
      lines.push("Nowshin-কে সবচেয়ে বেশি জিজ্ঞেস করা হয়: " +
        nw.top_questions.slice(0, 3).map(function (t) {
          return "“" + t.question + "” (" + t.times + " বার)";
        }).join(", "));
    }
    return lines.join("\n");
  }

  function askAnalyst(question) {
    var log = $("analystLog");
    if (!log) return;
    if (!IS_SUPER) {
      showMsg($("analystMsg"), "AI Analyst শুধুমাত্র Super Admin-এর জন্য।", false);
      return;
    }
    question = String(question || "").replace(/^\s+|\s+$/g, "");
    if (!question || analystBusy) return;
    analystBusy = true;
    var sendBtn = $("analystSend");
    if (sendBtn) sendBtn.disabled = true;
    var qDiv = document.createElement("div");
    qDiv.className = "analyst-q";
    qDiv.textContent = question;
    log.appendChild(qDiv);
    var aDiv = document.createElement("div");
    aDiv.className = "analyst-a";
    aDiv.textContent = "বিশ্লেষণ করা হচ্ছে…";
    log.appendChild(aDiv);
    log.scrollTop = log.scrollHeight;

    var builtCache = null;
    function finish() {
      analystBusy = false;
      if (sendBtn) sendBtn.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
    function showFallback(note) {
      aDiv.textContent = (note || "AI সার্ভার থেকে এই মুহূর্তে উত্তর আসেনি।") +
        "\n\nসরাসরি হিসাব থেকে তৈরি সারসংক্ষেপ:\n" +
        (builtCache ? builtCache.summary : "দুঃখিত, হিসাবও তৈরি করা যায়নি — কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
    buildDataPack().then(function (built) {
      builtCache = built;
      return window.SSA_DB.auth.getSession();
    }).then(function (sr) {
      var token = (sr && sr.data && sr.data.session) ? sr.data.session.access_token : "";
      if (!token) { showFallback("লগইন সেশন পাওয়া যায়নি।"); finish(); return null; }
      return fetch(ANALYST_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ question: question, data: builtCache.pack })
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, j: j }; },
          function () { return { ok: false, j: null }; });
      }, function () { return { ok: false, j: null }; })
      .then(function (out) {
        if (out && out.ok && out.j && out.j.answer) {
          aDiv.textContent = String(out.j.answer);
        } else {
          showFallback();
        }
        finish();
        return null;
      });
    }).then(function () { finish(); }, function () {
      showFallback("সংযোগে সমস্যা হয়েছে।");
      finish();
    });
  }

  /* ---------------- phase 4 wiring ---------------- */
  function initPhase4() {
    if (p4Inited) return;
    p4Inited = true;

    var tabs = document.querySelectorAll(".admin-tab");
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener("click", function () { showTab(tab.getAttribute("data-tab")); });
      })(tabs[i]);
    }

    /* Phase 10: report date-filter inputs + quick periods + PDF buttons. */
    bindReportTools();

    /* Phase 11: income & expense — add/edit form, list actions, Sheet sync. */
    var finFormEl = $("finForm");
    if (finFormEl) {
      finFormEl.addEventListener("submit", saveFinanceEntry);
      var finDateEl = $("finDate");
      if (finDateEl && !finDateEl.value) finDateEl.value = dateKeyOf(new Date());
      $("finCancelEdit").addEventListener("click", function () {
        finResetForm();
        showMsg($("finMsg"), "সম্পাদনা বাতিল হয়েছে।", true);
      });
      $("finWrap").addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t.getAttribute) return;
        var ed = t.getAttribute("data-fin-edit");
        var del = t.getAttribute("data-fin-del");
        if (ed) {
          for (var i = 0; i < finEntries.length; i++) {
            if (String(finEntries[i].id) === String(ed)) { finFillForm(finEntries[i]); break; }
          }
        } else if (del) {
          deleteFinanceEntry(del);
        }
      });
      var finSyncBtn = $("finSheetSyncBtn");
      if (finSyncBtn) finSyncBtn.addEventListener("click", syncAllFinance);
    }

    /* Phase 12: AI Analyst — question form + quick-question chips. */
    var analystFormEl = $("analystForm");
    if (analystFormEl) {
      analystFormEl.addEventListener("submit", function (ev) {
        ev.preventDefault();
        askAnalyst($("analystQ").value);
      });
      var askChips = analystFormEl.parentNode.querySelectorAll("[data-ask]");
      for (var aci = 0; aci < askChips.length; aci++) {
        (function (chip) {
          chip.addEventListener("click", function () {
            var q = chip.getAttribute("data-ask");
            var input = $("analystQ");
            if (input) input.value = q;
            askAnalyst(q);
          });
        })(askChips[aci]);
      }
    }

    /* courses */
    $("pmCoursesWrap").addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var editSlug = t.getAttribute("data-edit-c");
      var delSlug = t.getAttribute("data-del-c");
      if (editSlug) {
        var c = pmCourseBySlug(editSlug);
        if (c) fillPmCourseForm(c);
      } else if (delSlug) {
        if (!window.confirm("আপনি কি নিশ্চিত? এই কোর্সটি মুছে যাবে।")) return;
        t.disabled = true;
        window.SSA_DB.from("courses").delete().eq("slug", delSlug).then(function (r) {
          if (r.error) {
            if (window.ssaToast) ssaToast("কোর্সটি মোছা যায়নি। এই কোর্সে লেসন থাকলে আগে সেগুলো মুছুন।");
            t.disabled = false;
            return;
          }
          if (window.ssaToast) ssaToast("কোর্সটি মুছে ফেলা হয়েছে।");
          if (pmEditingSlug === delSlug) resetPmCourseForm();
          loadPmCourses();
        }, function () {
          if (window.ssaToast) ssaToast("কোর্সটি মোছা যায়নি। আপনার সংযোগ দেখে আবার চেষ্টা করুন।");
          t.disabled = false;
        });
      }
    });
    $("courseForm").addEventListener("submit", function (ev) { ev.preventDefault(); savePmCourse(); });
    $("pmCourseNew").addEventListener("click", function () { resetPmCourseForm(); });

    /* lessons */
    $("lmCourseSel").addEventListener("change", function () {
      lmLessons = [];
      resetLmForm();
      loadLmLessons();
    });
    $("lmLessonsWrap").addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var editId = t.getAttribute("data-edit-l");
      var delId = t.getAttribute("data-del-l");
      if (editId) {
        var l = lmLessonById(editId);
        if (l) fillLmForm(l);
      } else if (delId) {
        if (!window.confirm("আপনি কি নিশ্চিত? এই লেসনটি মুছে যাবে।")) return;
        t.disabled = true;
        window.SSA_DB.from("lesson_content").delete().eq("lesson_id", delId).then(function () {
          return window.SSA_DB.from("lessons").delete().eq("id", delId);
        }).then(function (r) {
          if (r.error) {
            if (window.ssaToast) ssaToast("লেসনটি মোছা যায়নি। আবার চেষ্টা করুন।");
            t.disabled = false;
            return;
          }
          if (window.ssaToast) ssaToast("লেসনটি মুছে ফেলা হয়েছে।");
          if (String(lmEditingId) === String(delId)) resetLmForm();
          loadLmLessons();
        }, function () {
          if (window.ssaToast) ssaToast("লেসনটি মোছা যায়নি। আপনার সংযোগ দেখে আবার চেষ্টা করুন।");
          t.disabled = false;
        });
      }
    });
    $("lessonForm").addEventListener("submit", function (ev) { ev.preventDefault(); saveLmLesson(); });
    $("lmNew").addEventListener("click", function () { resetLmForm(); });

    /* quizzes */
    $("qzCourseSel").addEventListener("change", function () {
      resetQzForm();
      fillQzLessons(null);
      loadQzList();
    });
    $("qzListWrap").addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var editId = t.getAttribute("data-edit-q");
      var delId = t.getAttribute("data-del-q");
      if (editId) {
        for (var i = 0; i < qzQuizzes.length; i++) {
          if (String(qzQuizzes[i].id) === String(editId)) { fillQzForm(qzQuizzes[i]); break; }
        }
      } else if (delId) {
        if (!window.confirm("আপনি কি নিশ্চিত? এই কুইজটি মুছে যাবে।")) return;
        t.disabled = true;
        window.SSA_DB.from("quiz_questions").delete().eq("quiz_id", delId).then(function () {
          return window.SSA_DB.from("quizzes").delete().eq("id", delId);
        }).then(function (r) {
          if (r.error) {
            if (window.ssaToast) ssaToast("কুইজটি মোছা যায়নি। আবার চেষ্টা করুন।");
            t.disabled = false;
            return;
          }
          if (window.ssaToast) ssaToast("কুইজটি মুছে ফেলা হয়েছে।");
          if (String(qzEditingId) === String(delId)) resetQzForm();
          loadQzList();
        }, function () {
          if (window.ssaToast) ssaToast("কুইজটি মোছা যায়নি। আপনার সংযোগ দেখে আবার চেষ্টা করুন।");
          t.disabled = false;
        });
      }
    });
    $("qzAddQ").addEventListener("click", function () { addQzQuestion(null); });
    $("quizForm").addEventListener("submit", function (ev) { ev.preventDefault(); saveQzQuiz(); });
    $("qzNew").addEventListener("click", function () { resetQzForm(); });
  }

  /* ---------------- gate ---------------- */
  if (!window.SSA_AUTH) {
    gateMessage("পেজটি লোড করা যায়নি। আবার চেষ্টা করুন।");
    return;
  }
  window.SSA_AUTH.ready.then(function () {
    var user = window.SSA_AUTH.getUser();
    if (!user) {
      gateMessage('Admin login required — অনুগ্রহ করে প্রথমে <a href="login.html">লগইন</a> করুন।');
      return;
    }
    if (!window.SSA_DB) {
      gateMessage("ডাটাবেসে সংযোগ করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।");
      return;
    }
    window.SSA_DB.from("profiles").select("*").eq("id", user.id).single()
      .then(function (r) {
        if (r.error || !r.data || (r.data.role !== "admin" && r.data.role !== "staff")) {
          gateMessage("এই পেজটি শুধুমাত্র Super Admin-এর জন্য।");
          return;
        }
        MY_ID = user.id;
        IS_SUPER = r.data.role === "admin";
        gateEl.style.display = "none";
        appEl.style.display = "";
        var roleBadge = document.createElement("p");
        roleBadge.style.margin = "18px 0 0";
        roleBadge.innerHTML = IS_SUPER
          ? '<span class="tag tag-ok">Super Admin</span>'
          : '<span class="tag tag-pend">Assigned (Staff) — মুছে ফেলার ক্ষমতা নেই</span>';
        appEl.insertBefore(roleBadge, appEl.firstChild);
        /* Phase 12: the AI Analyst is Super Admin ONLY — staff never
           even see the tab (the endpoint also verifies role=admin). */
        if (!IS_SUPER) {
          var analystBtn = $("analystTabBtn");
          if (analystBtn) analystBtn.style.display = "none";
          var partnersBtn = $("partnersTabBtn");
          if (partnersBtn) partnersBtn.style.display = "none";
        }
        initPhase4();
        loadCourseSlugs().then(function () {
          loadOrders();
          loadCustomers();
          loadAccess();
        });
      }, function () {
        gateMessage("আপনার তথ্য যাচাই করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।");
      });
  });
  /* ================= Phase 9: products / support / settings =================
     Founder order 2026-10-22: complete LMS — products deliver real files,
     professional student support, and EVERYTHING editable quickly from
     this panel (products, prices, bKash/WhatsApp numbers, announcement). */

  /* ---------- products manager ---------- */
  var pdRows = [];
  var pdCurrentFile = "";

  function loadProducts() {
    var wrap = $("productsWrap");
    if (!wrap) return;
    window.SSA_DB.from("products").select("*").order("sort", { ascending: true })
      .then(function (r) {
        if (r.error) {
          wrap.innerHTML = '<p class="empty-note">প্রোডাক্ট লোড করা যায়নি — ডাটাবেসে products টেবিল আছে কিনা দেখুন।</p>';
          return;
        }
        pdRows = r.data || [];
        if (!pdRows.length) {
          wrap.innerHTML = '<p class="empty-note">এখনো কোনো প্রোডাক্ট নেই।</p>';
          return;
        }
        wrap.innerHTML = '<div class="table-scroll"><table class="admin-table"><thead><tr>' +
          '<th>প্রোডাক্ট</th><th>Slug</th><th>দাম</th><th>ফাইল</th><th>অবস্থা</th><th></th></tr></thead><tbody>' +
          pdRows.map(function (p) {
            return '<tr><td><span class="en">' + escapeHtml(p.title) + '</span>' +
              (p.title_bn ? '<br><span style="color:var(--muted)">' + escapeHtml(p.title_bn) + '</span>' : '') + '</td>' +
              '<td class="en">' + escapeHtml(p.slug) + '</td>' +
              '<td class="en">৳' + escapeHtml(p.price) + '</td>' +
              '<td>' + (p.file_name ? escapeHtml(p.file_name) : '<span class="tag tag-pend">ফাইল নেই</span>') + '</td>' +
              '<td>' + (p.published ? '<span class="tag tag-ok">Published</span>' : '<span class="tag tag-bad">Unpublished</span>') + '</td>' +
              '<td class="row-actions"><button class="btn sm" type="button" data-edit-p="' + escapeHtml(p.slug) + '">Edit</button></td></tr>';
          }).join("") + '</tbody></table></div>';
        var btns = wrap.querySelectorAll("[data-edit-p]");
        for (var i = 0; i < btns.length; i++) {
          btns[i].addEventListener("click", function () { fillProductForm(this.getAttribute("data-edit-p")); });
        }
        if (pdRows.length && !$("pdSlug").value) fillProductForm(pdRows[0].slug);
      }, function () {
        wrap.innerHTML = '<p class="empty-note">প্রোডাক্ট লোড করা যায়নি। ইন্টারনেট সংযোগ দেখুন।</p>';
      });
  }

  function fillProductForm(slug) {
    var p = null;
    for (var i = 0; i < pdRows.length; i++) if (pdRows[i].slug === slug) { p = pdRows[i]; break; }
    if (!p) return;
    $("pdSlug").value = p.slug;
    $("pdTitle").value = p.title || "";
    $("pdTitleBn").value = p.title_bn || "";
    $("pdPrice").value = p.price;
    $("pdRegular").value = p.regular || 0;
    $("pdPublished").value = p.published ? "true" : "false";
    $("pdDescr").value = p.descr || "";
    pdCurrentFile = p.file_path || "";
    $("pdFileNow").textContent = "বর্তমান ফাইল: " + (p.file_name || "নেই");
    $("productFormTitle").textContent = "প্রোডাক্ট সম্পাদনা — " + p.title;
    $("pdFile").value = "";
  }

  var productFormEl = $("productForm");
  if (productFormEl) productFormEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var slug = $("pdSlug").value;
    if (!slug) { showMsg($("productsMsg"), "আগে তালিকা থেকে একটি প্রোডাক্ট Edit করুন।", false); return; }
    var saveBtn = $("pdSave");
    saveBtn.disabled = true;
    var fileInput = $("pdFile");
    var doSave = function (filePath, fileName) {
      var row = {
        title: $("pdTitle").value.trim(),
        title_bn: $("pdTitleBn").value.trim(),
        price: parseInt($("pdPrice").value, 10) || 0,
        regular: parseInt($("pdRegular").value, 10) || 0,
        published: $("pdPublished").value === "true",
        descr: $("pdDescr").value.trim(),
        updated_at: new Date().toISOString()
      };
      if (filePath) { row.file_path = filePath; row.file_name = fileName; }
      window.SSA_DB.from("products").update(row).eq("slug", slug).then(function (r) {
        saveBtn.disabled = false;
        if (r.error) { showMsg($("productsMsg"), "সেভ করা যায়নি। আবার চেষ্টা করুন।", false); return; }
        showMsg($("productsMsg"), "সেভ হয়েছে — সাইটে এখনই নতুন তথ্য দেখাবে।", true);
        loadProducts();
      }, function () {
        saveBtn.disabled = false;
        showMsg($("productsMsg"), "সেভ করা যায়নি। ইন্টারনেট সংযোগ দেখুন।", false);
      });
    };
    if (fileInput.files && fileInput.files.length) {
      var f = fileInput.files[0];
      var safeName = f.name.replace(/[^A-Za-z0-9._-]/g, "_");
      var path = slug + "/" + safeName;
      showMsg($("productsMsg"), "ফাইল আপলোড হচ্ছে…", true);
      window.SSA_DB.storage.from("course-files").upload(path, f, { upsert: true, contentType: f.type || "application/pdf" })
        .then(function (ur) {
          if (ur.error) {
            saveBtn.disabled = false;
            showMsg($("productsMsg"), "ফাইল আপলোড করা যায়নি: " + (ur.error.message || "") , false);
            return;
          }
          doSave(path, f.name);
        }, function () {
          saveBtn.disabled = false;
          showMsg($("productsMsg"), "ফাইল আপলোড করা যায়নি। ইন্টারনেট সংযোগ দেখুন।", false);
        });
    } else {
      doSave(null, null);
    }
  });

  /* ---------- support manager ---------- */
  var SUPPORT_SUBJECTS = {
    course: "কোর্স / লেসন সংক্রান্ত", payment: "পেমেন্ট সংক্রান্ত",
    access: "অ্যাক্সেস পাইনি", download: "ডাউনলোড সমস্যা", other: "অন্যান্য"
  };

  function loadSupport() {
    var wrap = $("supportWrap");
    if (!wrap) return;
    window.SSA_DB.from("support_tickets").select("*")
      .order("created_at", { ascending: false }).limit(100)
      .then(function (r) {
        if (r.error) {
          wrap.innerHTML = '<p class="empty-note">সাপোর্ট বার্তা লোড করা যায়নি — ডাটাবেসে support_tickets টেবিল আছে কিনা দেখুন।</p>';
          return;
        }
        var rows = r.data || [];
        if (!rows.length) {
          wrap.innerHTML = '<p class="empty-note">এখনো কোনো সাপোর্ট বার্তা আসেনি।</p>';
          return;
        }
        wrap.innerHTML = rows.map(function (t) {
          var tag = t.status === "answered" ? '<span class="tag tag-ok">উত্তর দেওয়া হয়েছে</span>'
            : t.status === "closed" ? '<span class="tag">বন্ধ</span>'
            : '<span class="tag tag-pend">উত্তর বাকি</span>';
          var html = '<div class="order-card"><div class="o-top"><b>' +
            escapeHtml(SUPPORT_SUBJECTS[t.subject] || t.subject) + '</b>' + tag + '</div>' +
            '<div class="o-items">' + escapeHtml(t.name || "") +
            (t.username ? ' (<span class="en">' + escapeHtml(t.username) + '</span>)' : '') +
            ' · <span class="en">' + escapeHtml(t.mobile || "") + '</span>' +
            (t.course_slug ? ' · কোর্স: <span class="en">' + escapeHtml(t.course_slug) + '</span>' : '') +
            '<br>' + escapeHtml(t.message) + '</div>';
          if (t.reply) {
            html += '<div class="o-items" style="margin-top:6px"><b>উত্তর:</b> ' + escapeHtml(t.reply) + '</div>';
          }
          html += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
            '<input type="text" placeholder="উত্তর লিখুন…" id="reply-' + t.id + '" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid #F3C6DD;border-radius:10px;font-family:inherit">' +
            '<button class="btn sm" type="button" data-reply="' + t.id + '">উত্তর পাঠান</button>' +
            (t.status !== "closed" ? '<button class="btn sm neutral" type="button" data-close-t="' + t.id + '">বন্ধ করুন</button>' : '') +
            '</div></div>';
          return html;
        }).join("");
        var rb = wrap.querySelectorAll("[data-reply]");
        for (var i = 0; i < rb.length; i++) rb[i].addEventListener("click", function () { replyTicket(this.getAttribute("data-reply")); });
        var cb = wrap.querySelectorAll("[data-close-t]");
        for (var j = 0; j < cb.length; j++) cb[j].addEventListener("click", function () { closeTicket(this.getAttribute("data-close-t")); });
      }, function () {
        wrap.innerHTML = '<p class="empty-note">সাপোর্ট বার্তা লোড করা যায়নি। ইন্টারনেট সংযোগ দেখুন।</p>';
      });
  }

  function replyTicket(id) {
    var input = $("reply-" + id);
    var text = input ? input.value.trim() : "";
    if (!text) { showMsg($("supportMsg"), "আগে উত্তর লিখুন।", false); return; }
    window.SSA_DB.from("support_tickets")
      .update({ reply: text, status: "answered", replied_at: new Date().toISOString() })
      .eq("id", id)
      .then(function (r) {
        if (r.error) { showMsg($("supportMsg"), "উত্তর পাঠানো যায়নি।", false); return; }
        showMsg($("supportMsg"), "উত্তর পাঠানো হয়েছে — ছাত্র তার সাপোর্ট পেজে দেখতে পাবে।", true);
        loadSupport();
      }, function () { showMsg($("supportMsg"), "উত্তর পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখুন।", false); });
  }

  function closeTicket(id) {
    window.SSA_DB.from("support_tickets").update({ status: "closed" }).eq("id", id)
      .then(function (r) {
        if (r.error) { showMsg($("supportMsg"), "বন্ধ করা যায়নি।", false); return; }
        loadSupport();
      }, function () { showMsg($("supportMsg"), "বন্ধ করা যায়নি। ইন্টারনেট সংযোগ দেখুন।", false); });
  }

  /* ---------- site settings ---------- */
  function loadSettings() {
    window.SSA_DB.from("site_settings").select("key, value").then(function (r) {
      if (r.error || !r.data) return;
      var s = {};
      r.data.forEach(function (row) { s[row.key] = row.value; });
      if (s.bkash_number != null) $("stBkash").value = s.bkash_number;
      if (s.whatsapp_number != null) $("stWhatsapp").value = s.whatsapp_number;
      if (s.announcement != null) $("stAnnouncement").value = s.announcement;
    }, function () {});
  }

  var settingsFormEl = $("settingsForm");
  if (settingsFormEl) settingsFormEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var rows = [
      { key: "bkash_number", value: $("stBkash").value.trim(), updated_at: new Date().toISOString() },
      { key: "whatsapp_number", value: $("stWhatsapp").value.trim(), updated_at: new Date().toISOString() },
      { key: "announcement", value: $("stAnnouncement").value.trim(), updated_at: new Date().toISOString() }
    ];
    window.SSA_DB.from("site_settings").upsert(rows, { onConflict: "key" }).then(function (r) {
      if (r.error) { showMsg($("settingsMsg"), "সেভ করা যায়নি। আবার চেষ্টা করুন।", false); return; }
      showMsg($("settingsMsg"), "সেটিংস সেভ হয়েছে — পুরো সাইটে এখনই কার্যকর হবে।", true);
    }, function () { showMsg($("settingsMsg"), "সেভ করা যায়নি। ইন্টারনেট সংযোগ দেখুন।", false); });
  });

})();

/* ---- Partners: applications, approvals, promo codes, payouts, CSV export (Founder order 2026-10-22) ---- */
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function msg(t, ok) { var m = $("partnersMsg"); if (!m) return; m.textContent = t; m.style.display = ""; m.style.color = ok ? "#14703D" : "#B90E59"; }
  function statusTag(st) { if (st === "approved") return '<span class="tag tag-ok">অনুমোদিত</span>'; if (st === "rejected") return '<span class="tag tag-pend">বাতিল</span>'; return '<span class="tag tag-pend">অপেক্ষমাণ</span>'; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("en-GB"); } catch (e) { return ""; } }
  function makeCode(name) { var base = String(name || "SSA").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "SSA"; return "SSA-" + base + Math.floor(100 + Math.random() * 900); }
  var lastRows = { teacher: [], affiliate: [], payouts: [] };
  function toCsv(rows, cols) {
    function cell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    return cols.join(",") + "\n" + rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(","); }).join("\n");
  }
  function downloadCsv(name, text) {
    var blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function appRow(r, kind) {
    var detail = kind === "teacher" ? ((r.subject || "") + (r.experience ? " • " + r.experience : "")) : ((r.platform || "") + (r.audience ? " • " + r.audience : ""));
    var btns = "";
    if (r.status === "pending") btns = '<button class="btn sm green" type="button" data-pact="approve" data-kind="' + kind + '" data-id="' + r.id + '">✅ অনুমোদন</button> <button class="btn sm neutral" type="button" data-pact="reject" data-kind="' + kind + '" data-id="' + r.id + '">বাতিল</button>';
    return "<tr><td><b>" + esc(r.full_name) + "</b><br><span class='en'>" + esc(r.mobile || "") + "</span>" + (r.email ? "<br>" + esc(r.email) : "") + "</td>" +
      "<td>" + esc(detail) + (r.message ? "<br><i>" + esc(r.message) + "</i>" : "") + "</td>" +
      "<td>" + (r.agreed ? "✓ সম্মত" : "✗ সম্মত নয়") + (r.promo_code ? "<br><b class='en'>" + esc(r.promo_code) + "</b>" : "") + "<br>" + fmtDate(r.created_at) + "</td>" +
      "<td>" + statusTag(r.status) + "</td><td class='row-actions'>" + btns + "</td></tr>";
  }
  function tableHtml(rows, kind, emptyText) {
    if (!rows || !rows.length) return '<p class="empty-note">' + emptyText + "</p>";
    return '<div class="table-scroll"><table class="admin-table"><thead><tr><th>নাম ও যোগাযোগ</th><th>বিবরণ</th><th>চুক্তি / কোড / তারিখ</th><th>অবস্থা</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) { return appRow(r, kind); }).join("") + "</tbody></table></div>";
  }
  function loadPartners() {
    if (!window.SSA_DB || typeof window.SSA_DB.from !== "function") return;
    window.SSA_DB.from("teacher_applications").select("*").order("created_at", { ascending: false }).then(function (r) {
      lastRows.teacher = r.data || [];
      var el = $("teacherApps"); if (el) el.innerHTML = tableHtml(lastRows.teacher, "teacher", "এখনো কোনো শিক্ষক আবেদন আসেনি।");
    }, function () {});
    window.SSA_DB.from("affiliate_applications").select("*").order("created_at", { ascending: false }).then(function (r) {
      lastRows.affiliate = r.data || [];
      var el = $("affiliateApps"); if (el) el.innerHTML = tableHtml(lastRows.affiliate, "affiliate", "এখনো কোনো অ্যাফিলিয়েট আবেদন আসেনি।");
    }, function () {});
    window.SSA_DB.from("partner_payouts").select("*").order("created_at", { ascending: false }).then(function (r) {
      var el = $("payoutList"); if (!el) return;
      var rows = r.data || []; lastRows.payouts = rows;
      if (!rows.length) { el.innerHTML = '<p class="empty-note">এখনো কোনো পেআউট যোগ করা হয়নি।</p>'; return; }
      el.innerHTML = '<div class="table-scroll"><table class="admin-table"><thead><tr><th>পার্টনার</th><th>ধরন</th><th>পরিমাণ</th><th>নোট</th><th>অবস্থা</th><th></th></tr></thead><tbody>' +
        rows.map(function (p) {
          return "<tr><td><b>" + esc(p.partner_name) + "</b><br>" + fmtDate(p.created_at) + "</td><td>" + (p.partner_type === "teacher" ? "শিক্ষক আয়-ভাগ" : "অ্যাফিলিয়েট কমিশন") + "</td><td><b>৳" + esc(p.amount) + "</b></td><td>" + esc(p.note || "") + "</td><td>" + (p.status === "paid" ? '<span class="tag tag-ok">Paid ✓</span>' : '<span class="tag tag-pend">বাকি</span>') + '</td><td class="row-actions">' + (p.status !== "paid" ? '<button class="btn sm green" type="button" data-pact="paid" data-id="' + p.id + '">💰 Paid করুন</button>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }, function () {});
  }
  window.SSA_loadPartners = loadPartners;
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-pact]") : null;
    if (!b || !window.SSA_DB) return;
    var act = b.getAttribute("data-pact"), id = b.getAttribute("data-id");
    if (act === "paid") {
      window.SSA_DB.from("partner_payouts").select("*").eq("id", id).single().then(function (pr) {
        var p = pr.data || {};
        window.SSA_DB.from("partner_payouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id).then(function (r) {
          if (r.error) { msg("পেআউট আপডেট হয়নি — আবার চেষ্টা করুন।", false); return; }
          var today = new Date().toISOString().slice(0, 10);
          window.SSA_DB.from("finance_entries").insert({
            type: "expense",
            title: "পার্টনার পেআউট — " + (p.partner_name || ""),
            note: (p.partner_type === "teacher" ? "শিক্ষক আয়-ভাগ" : "অ্যাফিলিয়েট কমিশন") + (p.note ? " • " + p.note : ""),
            amount: p.amount || 0, entry_date: today
          }).then(function () {}, function () {});
          msg("পেআউট Paid ✓ আয়-ব্যয় হিসাবেও খরচ হিসেবে যোগ হয়েছে।", true); loadPartners();
        });
      });
      return;
    }
    var kind = b.getAttribute("data-kind");
    var table = kind === "teacher" ? "teacher_applications" : "affiliate_applications";
    if (act === "approve") {
      window.SSA_DB.from(table).select("full_name,promo_code").eq("id", id).single().then(function (r) {
        var upd = { status: "approved" };
        if (r.data && !r.data.promo_code) upd.promo_code = makeCode(r.data.full_name);
        window.SSA_DB.from(table).update(upd).eq("id", id).then(function (r2) {
          if (r2.error) { msg("অনুমোদন হয়নি — আবার চেষ্টা করুন।", false); return; }
          msg("অনুমোদিত ✓" + (upd.promo_code ? " প্রোমো কোড: " + upd.promo_code + " — কোডটি পার্টনারকে পাঠিয়ে দিন।" : ""), true); loadPartners();
        });
      });
    } else if (act === "reject") {
      window.SSA_DB.from(table).update({ status: "rejected" }).eq("id", id).then(function (r) {
        if (r.error) { msg("বাতিল হয়নি — আবার চেষ্টা করুন।", false); return; }
        msg("আবেদন বাতিল করা হয়েছে।", true); loadPartners();
      });
    }
  });
  document.addEventListener("DOMContentLoaded", function () {
    var expT = $("expTeacher"), expA = $("expAffiliate"), expP = $("expPayouts");
    if (expT) expT.addEventListener("click", function () { downloadCsv("teacher-applications.csv", toCsv(lastRows.teacher, ["id", "full_name", "mobile", "email", "subject", "experience", "message", "agreed", "promo_code", "status", "created_at"])); });
    if (expA) expA.addEventListener("click", function () { downloadCsv("affiliate-applications.csv", toCsv(lastRows.affiliate, ["id", "full_name", "mobile", "email", "platform", "audience", "message", "agreed", "promo_code", "status", "created_at"])); });
    if (expP) expP.addEventListener("click", function () { downloadCsv("partner-payouts.csv", toCsv(lastRows.payouts, ["id", "partner_name", "partner_type", "amount", "note", "status", "created_at", "paid_at"])); });
    var add = $("poAddBtn");
    if (add) add.addEventListener("click", function () {
      var name = $("poName").value.trim(), amt = parseFloat($("poAmount").value);
      if (!name || !amt || amt <= 0) { msg("নাম ও সঠিক পরিমাণ দিন।", false); return; }
      window.SSA_DB.from("partner_payouts").insert({ partner_name: name, partner_type: $("poType").value, amount: amt, note: $("poNote").value.trim() || null, status: "due" }).then(function (r) {
        if (r.error) { msg("পেআউট যোগ হয়নি — আবার চেষ্টা করুন।", false); return; }
        $("poName").value = ""; $("poAmount").value = ""; $("poNote").value = "";
        msg("পেআউট যোগ হয়েছে ✓ টাকা পাঠিয়ে Paid করুন।", true); loadPartners();
      });
    });
  });
})();

/* ---- Site notices manager (Founder order 2026-10-22): Settings tab ---- */
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function msg(t, ok) { var m = $("noticeMsg"); if (!m) return; m.textContent = t; m.style.display = ""; m.style.color = ok ? "#14703D" : "#B90E59"; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("en-GB"); } catch (e) { return ""; } }
  function loadNotices() {
    if (!window.SSA_DB || typeof window.SSA_DB.from !== "function") return;
    window.SSA_DB.from("site_notices").select("*").order("created_at", { ascending: false }).then(function (r) {
      var el = $("noticeList"); if (!el) return;
      var rows = r.data || [];
      if (!rows.length) { el.innerHTML = '<p class="empty-note">এখনো কোনো নোটিশ প্রকাশ হয়নি।</p>'; return; }
      el.innerHTML = '<div class="table-scroll"><table class="admin-table"><thead><tr><th>নোটিশ</th><th>তারিখ</th><th>অবস্থা</th><th></th></tr></thead><tbody>' +
        rows.map(function (n) {
          return "<tr><td><b>" + esc(n.title) + "</b>" + (n.detail ? "<br>" + esc(n.detail) : "") + "</td><td>" + fmtDate(n.created_at) + "</td><td>" +
            (n.is_active ? '<span class="tag tag-ok">সক্রিয় — সাইটে দেখাচ্ছে</span>' : '<span class="tag tag-pend">বন্ধ</span>') +
            '</td><td class="row-actions"><button class="btn sm neutral" type="button" data-nact="toggle" data-id="' + n.id + '" data-on="' + (n.is_active ? "1" : "0") + '">' + (n.is_active ? "বন্ধ করুন" : "চালু করুন") + '</button> <button class="btn sm neutral" type="button" data-nact="del" data-id="' + n.id + '">🗑 মুছুন</button></td></tr>';
        }).join("") + "</tbody></table></div>";
    }, function () {});
  }
  window.SSA_loadNotices = loadNotices;
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-nact]") : null;
    if (!b || !window.SSA_DB) return;
    var id = b.getAttribute("data-id"), act = b.getAttribute("data-nact");
    if (act === "toggle") {
      var on = b.getAttribute("data-on") === "1";
      window.SSA_DB.from("site_notices").update({ is_active: !on }).eq("id", id).then(function (r) {
        if (r.error) { msg("বদলানো যায়নি — আবার চেষ্টা করুন।", false); return; }
        msg(on ? "নোটিশ বন্ধ করা হয়েছে।" : "নোটিশ চালু — এখন সাইটে দেখাচ্ছে ✓", true); loadNotices();
      });
    } else if (act === "del") {
      window.SSA_DB.from("site_notices").delete().eq("id", id).then(function (r) {
        if (r.error) { msg("মোছা যায়নি — আবার চেষ্টা করুন।", false); return; }
        msg("নোটিশ মোছা হয়েছে।", true); loadNotices();
      });
    }
  });
  document.addEventListener("DOMContentLoaded", function () {
    var add = $("ntAddBtn");
    if (add) add.addEventListener("click", function () {
      var title = $("ntTitle").value.trim();
      if (!title) { msg("শিরোনাম আবশ্যক।", false); return; }
      window.SSA_DB.from("site_notices").insert({ title: title, detail: $("ntDetail").value.trim() || null, is_active: true }).then(function (r) {
        if (r.error) { msg("প্রকাশ হয়নি — আবার চেষ্টা করুন।", false); return; }
        $("ntTitle").value = ""; $("ntDetail").value = "";
        msg("নোটিশ প্রকাশিত ✓ এখন সব পেজের Footer-এ দেখা যাচ্ছে।", true); loadNotices();
      });
    });
  });
})();
