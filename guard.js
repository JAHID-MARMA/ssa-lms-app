/* Self Scale Academy — Visitor Guard (Founder order 2026-10-22).
   If a visitor disturbs the site (repeated failed logins, chat spam), a
   SUSPENSION popup asks for their identity:
   - Registered students prove it by logging in (verified by Supabase Auth).
   - Others submit name + mobile — the report goes to the Super Admin, who
     checks it against the legal (registered) users list.
   - No identity -> the suspension popup stays; the visitor is stuck.
   Real protection remains the database lock (RLS) + manual order approval;
   this is the visible warning layer on top. */
(function () {
  var LS_FAIL = "ssa_sec_fails", LS_SUSP = "ssa_suspended", LS_REP = "ssa_reported_at";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function recentlyReported() {
    var t = parseInt(lsGet(LS_REP) || "0", 10);
    return t && (Date.now() - t < 24 * 60 * 60 * 1000);
  }
  function waitDb(cb, n) {
    if (window.SSA_DB && typeof window.SSA_DB.from === "function") { cb(); return; }
    if ((n || 0) < 40) setTimeout(function () { waitDb(cb, (n || 0) + 1); }, 250);
  }

  /* ---------- warm, clear warning signals BEFORE any suspension ---------- */
  function toast(text) {
    var t = document.createElement("div");
    t.className = "sec-toast"; t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 30);
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 5200);
  }
  function readFails() {
    var now = Date.now(), data = { login: 0, chat: 0, ts: now };
    try { var raw = JSON.parse(lsGet(LS_FAIL) || "null"); if (raw && now - raw.ts < 10 * 60 * 1000) data = raw; } catch (e) {}
    return data;
  }
  function paintWarn(data) {
    var left = 3 - (data.login || 0);
    document.querySelectorAll("[data-sec-warn]").forEach(function (el) {
      if (data.login > 0 && left > 0) {
        el.style.display = "";
        el.textContent = "⚠️ সতর্কবার্তা: ভুল চেষ্টা " + data.login + "/৩ — আর মাত্র " + left + " বার চেষ্টা বাকি। ৩ বার ভুল হলে আপনার নিরাপত্তার জন্য পরিচয় যাচাই করতে হবে।";
      }
    });
  }
  window.SSA_secCount = function () { return readFails(); };

  /* ---------- failure counter (called by login page + Nowshin) ---------- */
  window.SSA_secFail = function (kind) {
    if (lsGet(LS_SUSP) || recentlyReported()) return;
    var data = readFails();
    data[kind] = (data[kind] || 0) + 1; data.ts = Date.now();
    lsSet(LS_FAIL, JSON.stringify(data));
    if (kind === "login") {
      paintWarn(data);
      if (data.login === 1) toast("⚠️ ভুল ইমেইল বা পাসওয়ার্ড — আর মাত্র ২ বার চেষ্টা বাকি।");
      else if (data.login === 2) toast("⚠️ আবার ভুল হয়েছে — আর মাত্র ১ বার চেষ্টা বাকি। এরপর নিরাপত্তা যাচাই লাগবে।");
    }
    if (kind === "chat" && data.chat === 8) toast("💚 ধীরে লিখুন — খুব দ্রুত অনেক মেসেজ পাঠালে নিরাপত্তা যাচাই চালু হতে পারে।");
    if (data.login >= 3) suspend("বারবার ভুল লগইন চেষ্টা");
    else if (data.chat >= 12) suspend("অতিরিক্ত চ্যাট স্প্যাম");
  };

  /* ---------- clear on successful login (called from auth flow) ---------- */
  window.SSA_secClear = function () { lsDel(LS_SUSP); lsDel(LS_FAIL); hideOverlay(); };

  /* ---------- suspension overlay ---------- */
  var overlay = null;
  function hideOverlay() { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; document.documentElement.style.overflow = ""; }
  function suspend(reason) {
    lsSet(LS_SUSP, reason || "সন্দেহজনক কার্যকলাপ");
    if (overlay) return;
    document.documentElement.style.overflow = "hidden";
    overlay = document.createElement("div");
    overlay.className = "sec-overlay";
    overlay.innerHTML =
      '<div class="sec-card" role="alertdialog" aria-modal="true">' +
        '<div class="sec-icon">🛡️</div>' +
        '<h2>নিরাপত্তা যাচাই — সাময়িকভাবে স্থগিত</h2>' +
        '<p class="sec-why">আমাদের সাইটে অস্বাভাবিক কার্যকলাপ ধরা পড়েছে (' + esc(reason || "") + '), তাই আপনার ব্যবহার সাময়িকভাবে স্থগিত করা হয়েছে। এগিয়ে যেতে আপনার পরিচয় নিশ্চিত করুন।</p>' +
        '<div class="sec-box">' +
          '<h3>✅ নিবন্ধিত শিক্ষার্থী? লগইন করে প্রমাণ করুন</h3>' +
          '<input type="email" id="secEmail" placeholder="আপনার ইমেইল" autocomplete="username">' +
          '<input type="password" id="secPass" placeholder="পাসওয়ার্ড" autocomplete="current-password">' +
          '<button type="button" class="sec-btn pink" id="secLoginBtn">লগইন করে যাচাই করুন</button>' +
          '<p class="sec-msg" id="secLoginMsg"></p>' +
        '</div>' +
        '<div class="sec-box">' +
          '<h3>📝 নিবন্ধিত নন? পরিচয় জমা দিন</h3>' +
          '<input type="text" id="secName" placeholder="আপনার নাম *">' +
          '<input type="tel" id="secMobile" placeholder="মোবাইল নম্বর (01…) *">' +
          '<button type="button" class="sec-btn navy" id="secReportBtn">পরিচয় জমা দিন</button>' +
          '<p class="sec-msg" id="secReportMsg"></p>' +
        '</div>' +
        '<p class="sec-note">আপনার তথ্য Self Scale Academy-র Super Admin যাচাই করবেন। পরিচয় ছাড়া এই পেজ থেকে এগোনো যাবে না।</p>' +
      '</div>';
    document.body.appendChild(overlay);
    var loginBtn = overlay.querySelector("#secLoginBtn");
    loginBtn.addEventListener("click", function () {
      var email = overlay.querySelector("#secEmail").value.trim();
      var pass = overlay.querySelector("#secPass").value;
      var m = overlay.querySelector("#secLoginMsg");
      if (!email || !pass) { m.textContent = "ইমেইল ও পাসওয়ার্ড দিন।"; m.style.color = "#B90E59"; return; }
      m.textContent = "যাচাই হচ্ছে…"; m.style.color = "#555";
      waitDb(function () {
        if (!window.SSA_DB) { m.textContent = "এখন যাচাই করা যাচ্ছে না — কিছুক্ষণ পর চেষ্টা করুন।"; return; }
        window.SSA_DB.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
          if (r.error) { m.textContent = "ইমেইল বা পাসওয়ার্ড মিলছে না। আবার চেষ্টা করুন।"; m.style.color = "#B90E59"; return; }
          m.textContent = "✅ পরিচয় নিশ্চিত! স্বাগতম।"; m.style.color = "#14703D";
          window.SSA_secClear();
          setTimeout(function () { location.reload(); }, 700);
        }, function () { m.textContent = "যাচাই ব্যর্থ — আবার চেষ্টা করুন।"; });
      });
    });
    overlay.querySelector("#secReportBtn").addEventListener("click", function () {
      var name = overlay.querySelector("#secName").value.trim();
      var mobile = overlay.querySelector("#secMobile").value.replace(/[^0-9]/g, "");
      if (mobile.indexOf("880") === 0) mobile = "0" + mobile.slice(3);
      var m = overlay.querySelector("#secReportMsg");
      if (name.length < 3) { m.textContent = "সঠিক নাম লিখুন।"; m.style.color = "#B90E59"; return; }
      if (!/^01[0-9]{9}$/.test(mobile)) { m.textContent = "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।"; m.style.color = "#B90E59"; return; }
      m.textContent = "জমা হচ্ছে…"; m.style.color = "#555";
      waitDb(function () {
        if (!window.SSA_DB) { m.textContent = "এখন জমা নেওয়া যাচ্ছে না।"; return; }
        window.SSA_DB.from("security_reports").insert({
          name: name, mobile: mobile, reason: lsGet(LS_SUSP) || "সন্দেহজনক কার্যকলাপ",
          user_agent: (navigator.userAgent || "").slice(0, 300), page: location.pathname
        }).then(function (r) {
          if (r.error) { m.textContent = "জমা হয়নি — আবার চেষ্টা করুন।"; m.style.color = "#B90E59"; return; }
          lsSet(LS_REP, String(Date.now())); lsDel(LS_SUSP); lsDel(LS_FAIL);
          m.textContent = "✅ আপনার পরিচয় Super Admin-এর কাছে পাঠানো হয়েছে। যাচাই সাপেক্ষে আপনি এগিয়ে যেতে পারছেন।";
          m.style.color = "#14703D";
          setTimeout(hideOverlay, 1600);
        }, function () { m.textContent = "জমা হয়নি — আবার চেষ্টা করুন।"; });
      });
    });
  }

  /* ---------- on load: stay stuck if suspended ---------- */
  function init() {
    paintWarn(readFails());
    if (lsGet(LS_SUSP) && !recentlyReported()) suspend(lsGet(LS_SUSP));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
