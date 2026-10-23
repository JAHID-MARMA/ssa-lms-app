/* Self Scale Academy — shared auth state (Phase 2, Supabase).
   - Header: a visitor sees "Login"; a signed-in student sees a "Dashboard"
     button plus their name (both link to dashboard.html).
   - Course pages: if the signed-in student is enrolled in that course,
     lessons 2-10 open up (Lesson 1 is a free preview for everyone).
   - window.SSA_AUTH.ready resolves once the first session check is done;
     cart / dashboard / auth pages wait on it before deciding anything. */
(function () {
  "use strict";
  var state = { user: null, profile: null };
  var resolveReady;
  var ready = new Promise(function (res) { resolveReady = res; });
  var readyDone = false;
  function finish() { if (!readyDone) { readyDone = true; resolveReady(state); } }

  /* Header door fix (Founder, 2026-10-23): until the session check ends,
     hide every auth control, so a signed-in visitor never sees (or taps) a
     "Login" button that would only bounce to the dashboard, and a signed-out
     visitor never sees a Dashboard door that bounces back to login.
     setHeader() reveals exactly the right door for the visitor's state. */
  var AUTH_IDS = ["ssaLoginLink", "ssaDashLink", "ssaUserChip", "ssaAdminLink", "ssaAdminBtn"];
  function authEls() {
    var out = [];
    for (var i = 0; i < AUTH_IDS.length; i++) {
      var el = document.getElementById(AUTH_IDS[i]);
      if (el) out.push(el);
    }
    return out;
  }
  authEls().forEach(function (el) { el.style.visibility = "hidden"; });

  function displayName() {
    if (state.profile && state.profile.name) return state.profile.name;
    if (state.profile && state.profile.username) return state.profile.username;
    if (state.user && state.user.email) return state.user.email.split("@")[0];
    return "আমার অ্যাকাউন্ট";
  }

  function setHeader() {
    var login = document.getElementById("ssaLoginLink");
    var dash = document.getElementById("ssaDashLink");
    var chip = document.getElementById("ssaUserChip");
    var adminLink = document.getElementById("ssaAdminLink");
    var adminBtn = document.getElementById("ssaAdminBtn");
    /* Phase 5: the Admin link/button shows for the Super Admin (role
       "admin") AND for the Founder's Assigned person (role "staff").
       The panel itself re-checks the role, and the database decides
       what each role may actually do. */
    var isAdmin = !!(state.user && state.profile && (state.profile.role === "admin" || state.profile.role === "staff"));
    if (adminLink) adminLink.style.display = isAdmin ? "" : "none";
    if (adminBtn) adminBtn.style.display = isAdmin ? "" : "none";
    if (state.user) {
      if (login) login.style.display = "none";
      if (dash) dash.style.display = "";
      if (chip) {
        chip.style.display = "";
        chip.textContent = displayName();
        chip.title = displayName();
      }
    } else {
      if (login) login.style.display = "";
      if (dash) dash.style.display = "none";
      if (chip) { chip.style.display = "none"; chip.textContent = ""; }
    }
    authEls().forEach(function (el) { el.style.visibility = ""; });
  }

  /* Load the student's profile row. If signup finished before the row could
     be saved (e.g. the email-confirmation step came first), the details were
     kept in localStorage as "ssa_pending_profile" — save the row now. */
  function ensureProfile(user) {
    return window.SSA_DB.from("profiles")
      .select("id,name,mobile,username,role,email,occupation,institution,avatar_url,authenticity_score,created_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(function (r) {
        state.profile = (r && r.data) ? r.data : null;
        if (state.profile) return null;
        var raw = null, p = null;
        try { raw = localStorage.getItem("ssa_pending_profile"); } catch (e) {}
        if (raw) { try { p = JSON.parse(raw); } catch (e) { p = null; } }
        if (!p || p.id !== user.id) return null;
        return window.SSA_DB.from("profiles")
          .insert({ id: user.id, name: p.name, mobile: p.mobile, username: p.username, email: p.email || user.email || null })
          .then(function (ir) {
            if (!ir.error) {
              state.profile = { id: user.id, name: p.name, mobile: p.mobile, username: p.username, email: p.email || user.email || null };
              try { localStorage.removeItem("ssa_pending_profile"); } catch (e) {}
            }
            return null;
          });
      })
      .then(function () { return null; }, function () { return null; });
  }

  /* Founder order 2026-10-22: once the student has bought anything, the
     Dashboard button turns light-green, glassy and premium. */
  function markPurchased(user) {
    if (!user || !window.SSA_DB) return;
    window.SSA_DB.from("enrollments").select("course_slug").eq("user_id", user.id).limit(1)
      .then(function (r) {
        if (r && r.data && r.data.length) {
          var dash = document.getElementById("ssaDashLink");
          if (dash) dash.classList.add("has-purchase");
        }
      }, function () {});
  }

  function markAllLessonsOpen(noteText) {
    var list = document.getElementById("lessonList");
    if (!list) return;
    for (var i = 1; i < list.children.length; i++) {
      var li = list.children[i];
      li.className = "open";
      var tag = li.querySelector(".tag");
      if (tag) { tag.className = "tag tag-open"; tag.textContent = "✓ খোলা আছে"; }
    }
    var note = document.getElementById("lessonNote");
    if (note && noteText) note.textContent = noteText;
  }

  function unlockCourse(user) {
    var hero = document.getElementById("courseHero");
    if (!hero || !user) return;
    /* Admin/Staff (Founder, 2026-10-23): entering as admin, every course is
       open — the lesson list must show that, not locks. The database already
       serves lesson content to the admin; this makes the list match. */
    var prof = state.profile;
    if (prof && (prof.role === "admin" || prof.role === "staff")) {
      markAllLessonsOpen("আপনি Admin — এই কোর্সের সব লেসন আপনার জন্য খোলা আছে।");
      return;
    }
    var slug = hero.getAttribute("data-course");
    window.SSA_DB.from("enrollments")
      .select("course_slug")
      .eq("user_id", user.id)
      .eq("course_slug", slug)
      .maybeSingle()
      .then(function (r) {
        if (!r || !r.data) return;
        markAllLessonsOpen("আপনি এই কোর্সে ভর্তি আছেন — সব লেসন আপনার জন্য খোলা আছে। শুভ শিক্ষা!");
      }, function () {});
  }

  function applyUser(user) {
    state.user = user || null;
    if (!state.user) {
      state.profile = null;
      setHeader();
      finish();
      return;
    }
    ensureProfile(state.user).then(function () {
      if (window.SSA_secClear) window.SSA_secClear();
      setHeader();
      markPurchased(state.user);
      unlockCourse(state.user);
      finish();
    });
  }

  window.SSA_AUTH = {
    ready: ready,
    getUser: function () { return state.user; },
    getProfile: function () { return state.profile; },
    displayName: displayName,
    signOut: function () {
      if (!window.SSA_DB) return Promise.resolve();
      return window.SSA_DB.auth.signOut();
    }
  };

  if (!window.SSA_DB) { setHeader(); finish(); return; }

  window.SSA_DB.auth.getSession().then(function (res) {
    var session = (res && res.data) ? res.data.session : null;
    applyUser(session ? session.user : null);
  }, function () { setHeader(); finish(); });

  window.SSA_DB.auth.onAuthStateChange(function (_event, session) {
    var user = session ? session.user : null;
    if ((user && state.user && user.id === state.user.id) || (!user && !state.user)) {
      setHeader();
      return;
    }
    applyUser(user);
  });
})();
