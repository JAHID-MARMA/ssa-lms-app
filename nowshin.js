/* Ask Nowshin — chat widget.
   POSTs {message, history} to the live Nowshin API on Vercel and renders the reply.
   If the API is unreachable, a static fallback line is shown (no WhatsApp number in it). */
(function () {
  "use strict";
  var API = "https://nowshin-api.vercel.app/api/nowshin";
  /* Google Bridge (Phase 5): CEO pastes the Founder's Google Sheet
     web-app URL here (see README-PC.md, Phase 5). One bridge, three
     Sheet tabs — Chats (every finished exchange; ones Nowshin could
     not answer are flagged NEEDS-CEO), Leads (name + mobile a visitor
     gives Nowshin), Sales (orders). Empty = the bridge is off.
     Other pages (cart checkout, admin revenue sync) read the same URL
     via window.SSA_SHEET_URL — it is set in this ONE place only. */
  var LOG_URL = "https://script.google.com/macros/s/AKfycby_dqAkiiSl5-t5pBRDb4Mh8aYrewWbhc-5PA2qm2RGW_Ift2R0O9N9nHCHbZXgHzXtjw/exec";
  window.SSA_SHEET_URL = LOG_URL;
  var FALLBACK = "দুঃখিত, এই মুহূর্তে আমি উত্তর দিতে পারছি না। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন। কোর্স, ফি ও ভর্তির তথ্য এই পেজেই পেয়ে যাবেন।";
  var GREETING = "আসসালামু আলাইকুম! আমি Nowshin — Self Scale Academy-এর Customer Manager। কোর্স, ফি বা ভর্তি নিয়ে আপনার যেকোনো প্রশ্ন করুন, আমি সাহায্য করছি।";
  var LEAD_ASK = "আসসালামু আলাইকুম! আমি Nowshin, Self Scale Academy-র কাস্টমার ম্যানেজার। আপনাকে ঠিকমতো সাহায্য করতে আপনার নাম ও মোবাইল নম্বরটি দিন — প্রয়োজনে আমরা যোগাযোগ করতে পারব।";

  var pill = document.createElement("button");
  pill.className = "nowshin-pill";
  pill.type = "button";
  pill.innerHTML = '<span class="pill-face"><img src="assets/nowshin-avatar.webp" alt="Nowshin Jannat"><span class="online-dot"></span></span> Ask Nowshin';
  pill.setAttribute("aria-label", "Ask Nowshin — chat");

  var box = document.createElement("div");
  box.className = "nowshin-box";
  box.innerHTML =
    '<div class="n-head"><span class="n-avatar"><img src="assets/nowshin-avatar.webp" alt="Nowshin Jannat"><span class="online-dot"></span></span>' +
    '<span><b>Nowshin Jannat</b><small>Customer Manager — অনলাইনে আছেন</small></span>' +
    '<button class="n-close" type="button" aria-label="Close">×</button></div>' +
    '<div class="n-msgs"></div>' +
    '<form class="n-input"><input type="text" placeholder="আপনার প্রশ্ন লিখুন…" autocomplete="off">' +
    '<button type="submit">পাঠান</button></form>';

  document.body.appendChild(pill);
  document.body.appendChild(box);

  var msgs = box.querySelector(".n-msgs");
  var form = box.querySelector(".n-input");
  var input = box.querySelector(".n-input input");
  var history = [];
  var greeted = false;
  var busy = false;

  /* Fire-and-forget POST to the Google Bridge. Fully guarded: it must
     never delay, block or break the chat. The bridge routes by "type"
     into the Sheet's Chats / Leads / Sales tabs. */
  function sheetPost(payload) {
    if (!LOG_URL) return;
    try {
      if (!payload.t) payload.t = new Date().toISOString();
      fetch(LOG_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      }).catch(function () { /* the bridge is best-effort only */ });
    } catch (e) { /* the bridge must never break the chat */ }
  }

  /* The visitor's name + mobile, once given, live in localStorage so
     Nowshin never has to ask twice on the same device. */
  function getLead() {
    try {
      var s = localStorage.getItem("ssa_lead");
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function setLead(v) {
    try { localStorage.setItem("ssa_lead", JSON.stringify(v)); } catch (e) {}
  }

  /* Copy of one finished exchange to the Sheet's Chats tab, carrying
     the visitor's name + mobile when they gave them. */
  function logExchange(userText, botText, flag) {
    var lead = getLead();
    sheetPost({
      type: "chat",
      page: location.pathname,
      name: (lead && lead.name) || "",
      mobile: (lead && lead.mobile) || "",
      user: userText,
      bot: botText,
      flag: flag || ""
    });
  }

  /* 👍/👎 feedback (Phase 12, Founder order 2026-10-22: "What people
     ask to Nowshin — are they happy with the answer or not?"). Every
     Nowshin answer gets a small vote row under it; one tap per answer.
     The vote goes to BOTH sinks, each fully guarded so a failure is
     never visible: (1) the Google Bridge → the Sheet's "Nowshin
     Feedback" tab, and (2) Supabase nowshin_feedback, where the
     Super Admin computes the happy-% and reads the 👎 answers. */
  function postFeedback(question, answer, vote) {
    var lead = getLead();
    sheetPost({
      type: "feedback",
      page: location.pathname,
      name: (lead && lead.name) || "",
      mobile: (lead && lead.mobile) || "",
      question: String(question || "").slice(0, 500),
      answer: String(answer || "").slice(0, 1000),
      vote: vote
    });
    try {
      if (window.SSA_DB) {
        window.SSA_DB.from("nowshin_feedback").insert({
          question: String(question || "").slice(0, 500),
          answer: String(answer || "").slice(0, 1000),
          vote: vote,
          page: location.pathname
        }).then(function () {}, function () {});
      }
    } catch (e) { /* feedback is best-effort only */ }
  }

  function addVoteRow(question, answer) {
    var row = document.createElement("div");
    row.className = "n-vote";
    var label = document.createElement("span");
    label.className = "n-vote-label";
    label.textContent = "উত্তরটি কেমন লাগলো?";
    var up = document.createElement("button");
    up.type = "button";
    up.className = "n-vote-btn";
    up.textContent = "👍";
    up.setAttribute("aria-label", "উত্তরটি ভালো লেগেছে");
    var down = document.createElement("button");
    down.type = "button";
    down.className = "n-vote-btn";
    down.textContent = "👎";
    down.setAttribute("aria-label", "উত্তরটি ভালো লাগেনি");
    row.appendChild(label);
    row.appendChild(up);
    row.appendChild(down);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    var voted = false;
    function vote(v) {
      if (voted) return;
      voted = true;
      postFeedback(question, answer, v);
      row.innerHTML = "";
      var done = document.createElement("span");
      done.className = "n-vote-done";
      done.textContent = "ধন্যবাদ! আপনার মতামত আমাদের আরও ভালো হতে সাহায্য করবে।";
      row.appendChild(done);
      msgs.scrollTop = msgs.scrollHeight;
    }
    up.addEventListener("click", function () { vote("up"); });
    down.addEventListener("click", function () { vote("down"); });
  }

  /* Lead capture, shown inside the chat on the very first open when
     the visitor has not given (or skipped) their details yet. The
     normal message input stays enabled the whole time — skipping can
     never trap the visitor. */
  function showLeadForm() {
    addMsg(LEAD_ASK, "bot");
    history.push({ role: "bot", text: LEAD_ASK });

    var wrap = document.createElement("div");
    wrap.setAttribute("style", "align-self:stretch;background:#fff;border:1px solid var(--line);border-radius:14px;border-bottom-left-radius:4px;padding:11px;display:flex;flex-direction:column;gap:8px;");

    var inStyle = "padding:9px 12px;border:1.5px solid #E3D5DE;border-radius:10px;font-size:14.5px;font-family:'Hind Siliguri',sans-serif;width:100%;box-sizing:border-box;background:#fff;";
    var nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.placeholder = "আপনার নাম";
    nameIn.setAttribute("autocomplete", "name");
    nameIn.setAttribute("style", inStyle);
    var mobileIn = document.createElement("input");
    mobileIn.type = "tel";
    mobileIn.placeholder = "মোবাইল নম্বর (01XXXXXXXXX)";
    mobileIn.setAttribute("autocomplete", "tel");
    mobileIn.setAttribute("inputmode", "tel");
    mobileIn.setAttribute("style", inStyle);

    var errLine = document.createElement("div");
    errLine.setAttribute("style", "display:none;color:var(--pink-dark);font-size:13.5px;line-height:1.45;");

    var startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.textContent = "শুরু করুন";
    startBtn.setAttribute("style", "background:var(--pink);color:#fff;border:0;border-radius:999px;padding:9px 16px;font-weight:600;cursor:pointer;font-family:'Hind Siliguri',sans-serif;font-size:14.5px;");
    var skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "এড়িয়ে যান";
    skipBtn.setAttribute("style", "background:none;border:0;color:var(--muted);font-size:13.5px;cursor:pointer;font-family:'Hind Siliguri',sans-serif;text-decoration:underline;padding:2px;");

    function showLeadErr(text) {
      errLine.textContent = text;
      errLine.style.display = "block";
    }
    function removeForm() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    startBtn.addEventListener("click", function () {
      var nm = nameIn.value.replace(/^\s+|\s+$/g, "");
      function SSA_NORM_MOBILE(v){var m=String(v||"").replace(/[\s-]/g,"");if(m.indexOf("+880")===0)m="0"+m.slice(4);else if(m.indexOf("880")===0)m="0"+m.slice(3);return m;}
      var mb = SSA_NORM_MOBILE(mobileIn.value);
      if (!nm) { showLeadErr("অনুগ্রহ করে আপনার নামটি লিখুন।"); nameIn.focus(); return; }
      if (!/^01[3-9][0-9]{8}$/.test(mb)) {
        showLeadErr("সঠিক মোবাইল নম্বর দিন — 01… অথবা +8801…।");
        mobileIn.focus();
        return;
      }
      setLead({ name: nm, mobile: mb });
      sheetPost({ type: "lead", name: nm, mobile: mb, page: location.pathname });
      removeForm();
      var thanks = "ধন্যবাদ, " + nm + "! কীভাবে সাহায্য করতে পারি?";
      addMsg(thanks, "bot");
      history.push({ role: "bot", text: thanks });
      input.focus();
    });
    skipBtn.addEventListener("click", function () {
      setLead({ skipped: true });
      removeForm();
      addMsg("ঠিক আছে! আপনার কোনো প্রশ্ন থাকলে লিখুন — আমি সাহায্য করছি।", "bot");
      input.focus();
    });

    wrap.appendChild(nameIn);
    wrap.appendChild(mobileIn);
    wrap.appendChild(errLine);
    wrap.appendChild(startBtn);
    wrap.appendChild(skipBtn);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    nameIn.focus();
  }

  function addMsg(text, who) {
    var d = document.createElement("div");
    d.className = "n-msg " + who;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function openBox() {
    box.classList.add("open");
    if (!greeted) {
      greeted = true;
      addMsg(GREETING, "bot");
      history.push({ role: "bot", text: GREETING });
      /* First visit on this device: ask for name + mobile (lead). */
      if (!getLead()) { showLeadForm(); return; }
    }
    input.focus();
  }
  pill.addEventListener("click", function () {
    if (box.classList.contains("open")) box.classList.remove("open"); else openBox();
  });
  box.querySelector(".n-close").addEventListener("click", function () { box.classList.remove("open"); });

  /* Footer / strip "Ask Nowshin" triggers */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute("data-nowshin")) { ev.preventDefault(); openBox(); return; }
      t = t.parentNode;
    }
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var text = input.value.replace(/^\s+|\s+$/g, "");
    if (!text || busy) return;
    if (window.SSA_secFail) window.SSA_secFail("chat");
    input.value = "";
    addMsg(text, "me");
    history.push({ role: "user", text: text });
    if (history.length > 12) history = history.slice(history.length - 12);
    busy = true;
    var typing = addMsg("Nowshin লিখছেন…", "bot typing");

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(0, history.length - 1) })
    }).then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    }).then(function (data) {
      typing.parentNode && typing.parentNode.removeChild(typing);
      var answered = !!(data && data.reply);
      var reply = answered ? String(data.reply) : FALLBACK;
      addMsg(reply, "bot");
      addVoteRow(text, reply);
      history.push({ role: "bot", text: reply });
      logExchange(text, reply, answered ? "" : "NEEDS-CEO");
      busy = false;
    }).catch(function () {
      typing.parentNode && typing.parentNode.removeChild(typing);
      addMsg(FALLBACK, "bot");
      addVoteRow(text, FALLBACK);
      logExchange(text, FALLBACK, "NEEDS-CEO");
      busy = false;
    });
  });
})();
