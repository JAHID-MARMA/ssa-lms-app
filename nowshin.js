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
    '<button class="n-speak" type="button" aria-label="Voice replies on or off">🔇</button>' +
    '<button class="n-close" type="button" aria-label="Close">×</button></div>' +
    '<div class="n-msgs"></div>' +
    '<form class="n-input"><input type="text" placeholder="আপনার প্রশ্ন লিখুন…" autocomplete="off">' +
    '<button class="n-lang" type="button" aria-label="Voice language">বাং</button>' +
    '<button class="n-mic" type="button" aria-label="Speak your question">🎤</button>' +
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
    pill.classList.add("keep");
    if (!greeted) {
      greeted = true;
      addMsg(GREETING, "bot");
      speak(GREETING);
      history.push({ role: "bot", text: GREETING });
      /* First visit on this device: ask for name + mobile (lead). */
      if (!getLead()) { showLeadForm(); return; }
    }
    input.focus();
  }
  pill.addEventListener("click", function () {
    if (box.classList.contains("open")) { box.classList.remove("open"); pill.classList.remove("keep"); } else openBox();
  });
  box.querySelector(".n-close").addEventListener("click", function () {
    box.classList.remove("open");
    pill.classList.remove("keep");
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (typeof stopListening === "function" && listening) stopListening();
  });

  /* Ask Nowshin pill: hidden while scrolling mid-page, fixed at the
     bottom-right only near the footer — same rule as the notice button,
     so it never sits in front of the customer. Stays while chat is open. */
  (function watchPillFooter() {
    var footer = document.querySelector(".site-footer");
    if (!footer || !("IntersectionObserver" in window)) { pill.classList.add("show"); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) pill.classList.add("show");
        else if (!box.classList.contains("open")) pill.classList.remove("show");
      });
    }, { threshold: 0.35 });
    obs.observe(footer);
  })();

  /* Footer / strip "Ask Nowshin" triggers */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute("data-nowshin")) { ev.preventDefault(); openBox(); return; }
      t = t.parentNode;
    }
  });

  /* ── Voice (Founder order 2026-10-24): talk to Nowshin directly from
     her icon — the browser's own speech (Chrome Web Speech API), so it
     costs nothing at any student count. Mic = speech recognition
     (bn-BD / en-US toggle); speaker = Nowshin's replies read aloud.
     Everything is capability-guarded: on a browser without these APIs
     the buttons simply never appear and the chat stays text-only. */
  var micBtn = box.querySelector(".n-mic");
  var langBtn = box.querySelector(".n-lang");
  var speakBtn = box.querySelector(".n-speak");
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var voiceLang = "bn-BD";
  var speakOn = false;
  try {
    voiceLang = localStorage.getItem("ssa_nowshin_vlang") || "bn-BD";
    speakOn = localStorage.getItem("ssa_nowshin_speak") === "1";
  } catch (e) {}
  function paintVoiceBtns() {
    langBtn.textContent = voiceLang === "bn-BD" ? "বাং" : "EN";
    speakBtn.textContent = speakOn ? "🔊" : "🔇";
    speakBtn.classList.toggle("on", !!speakOn);
  }
  if (!SR) { micBtn.style.display = "none"; langBtn.style.display = "none"; }
  if (!("speechSynthesis" in window)) { speakBtn.style.display = "none"; }
  paintVoiceBtns();

  langBtn.addEventListener("click", function () {
    voiceLang = voiceLang === "bn-BD" ? "en-US" : "bn-BD";
    try { localStorage.setItem("ssa_nowshin_vlang", voiceLang); } catch (e) {}
    paintVoiceBtns();
    if (!listening) input.placeholder = voiceLang === "bn-BD" ? "আপনার প্রশ্ন লিখুন…" : "Write your question here…";
    input.focus();
  });
  speakBtn.addEventListener("click", function () {
    speakOn = !speakOn;
    try { localStorage.setItem("ssa_nowshin_speak", speakOn ? "1" : "0"); } catch (e) {}
    if (!speakOn && "speechSynthesis" in window) speechSynthesis.cancel();
    paintVoiceBtns();
    if (speakOn) speak(voiceLang === "bn-BD" ? "ভয়েস চালু হয়েছে। বলুন, আমি শুনছি।" : "Voice is on. Ask me anything.");
  });

  var recog = null;
  var listening = false;
  var voiceUsed = false;
  /* Voice text must carry sentence punctuation, or it is hard to read:
     Bangla ends with dari (।), English with a full stop; a question
     word makes it a question mark. Mid-sentence commas are left out —
     a wrong comma hurts understanding more than a missing one. */
  function punctuate(text, bn) {
    var t = String(text).trim();
    if (!t || /[।?!.…:]$/.test(t)) return t;
    if (bn) {
      var q = ["কি", "কী", "কেন", "কখন", "কোথায়", "কবে", "কত", "কিভাবে", "কীভাবে", "কেমন", "কার", "কোন"];
      var words = t.split(/\s+/);
      for (var i = 0; i < words.length; i++) {
        if (q.indexOf(words[i].replace(/[।?!,.:;]+$/, "")) >= 0) return t + "?";
      }
      return t + "।";
    }
    if (/^(what|why|when|where|who|whom|whose|which|how|is|are|was|were|do|does|did|can|could|will|would|should|may|might)\b/i.test(t)) return t + "?";
    return t + ".";
  }
  function stopListening() {
    listening = false;
    micBtn.classList.remove("listening");
    input.placeholder = voiceLang === "bn-BD" ? "আপনার প্রশ্ন লিখুন…" : "Write your question here…";
    if (voiceUsed && input.value) input.value = punctuate(input.value, voiceLang === "bn-BD");
    if (recog) { try { recog.stop(); } catch (e) {} }
  }
  micBtn.addEventListener("click", function () {
    if (!SR) return;
    if (listening) { stopListening(); return; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    recog = new SR();
    recog.lang = voiceLang;
    recog.interimResults = true;
    recog.continuous = true;
    listening = true;
    voiceUsed = false;
    micBtn.classList.add("listening");
    input.placeholder = voiceLang === "bn-BD" ? "শুনছি… শেষ হলে mic-এ আবার চাপুন" : "Listening… tap mic again when done";
    /* A breath pause must never send the message: words only fill the
       box, and he presses Send himself when he is really finished. */
    var voiceBase = "";
    /* If nothing is heard within 4s of tapping, say so plainly instead
       of leaving him wondering whether it understood anything. */
    var heardTimer = setTimeout(function () {
      if (listening && !input.value) {
        input.placeholder = voiceLang === "bn-BD" ? "শোনা যাচ্ছে না — আবার বলুন (ভাষা বাং/EN মিলিয়ে নিন)" : "Cannot hear you — speak again (check বাং/EN)";
      }
    }, 4000);
    recog.onresult = function (ev) {
      clearTimeout(heardTimer);
      var interim = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          voiceUsed = true;
          voiceBase = (voiceBase ? voiceBase + " " : "") + punctuate(ev.results[i][0].transcript.trim(), voiceLang === "bn-BD");
        }
        else interim += ev.results[i][0].transcript;
      }
      input.value = (voiceBase + (interim ? " " + interim : "")).trim();
    };
    recog.onend = function () {
      if (listening) { try { recog.start(); } catch (e) { stopListening(); } }
    };
    recog.onerror = function (ev) {
      if (!listening) return;
      var err = ev && ev.error;
      stopListening();
      /* Never fail silently: the box itself must say why it stopped. */
      if (err === "not-allowed" || err === "service-not-allowed") {
        input.placeholder = voiceLang === "bn-BD" ? "Mic বন্ধ আছে — address bar-এর mic icon থেকে Allow করুন" : "Mic is blocked — Allow it from the mic icon in the address bar";
      } else if (err === "audio-capture") {
        input.placeholder = voiceLang === "bn-BD" ? "Mic পাওয়া যাচ্ছে না — laptop-এর mic চেক করুন" : "No microphone found — check your laptop mic";
      } else if (err === "network") {
        input.placeholder = voiceLang === "bn-BD" ? "Network সমস্যা — আবার mic চাপুন" : "Network problem — tap mic again";
      } else {
        input.placeholder = voiceLang === "bn-BD" ? "শোনা যাচ্ছে না — আবার বলুন (ভাষা বাং/EN মিলিয়ে নিন)" : "Cannot hear you — speak again (check বাং/EN)";
      }
    };
    try { recog.start(); } catch (e) {
      stopListening();
      input.placeholder = voiceLang === "bn-BD" ? "Mic চালু হয়নি — address bar থেকে Allow করুন" : "Mic did not start — Allow it from the address bar";
    }
  });

  function speak(text) {
    if (!speakOn || !("speechSynthesis" in window) || !text) return;
    try {
      /* Strip markdown, symbols, emojis and links so the voice never reads
         "star", "comma" or other sign names — punctuation becomes pauses. */
      var clean = String(text)
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[*_#`>~|\\]/g, "")
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
        .replace(/\s+/g, " ").trim();
      if (!clean) return;
      /* Split into sentences, then into short chunks: one long utterance is
         cut off by the browser, so speak piece by piece until the end. */
      var parts = [], re = /[^।.!?]+[।.!?]?/g, m;
      while ((m = re.exec(clean)) !== null) { var s = m[0].trim(); if (s) parts.push(s); }
      if (!parts.length) parts = [clean];
      var rawChunks = [];
      for (var p = 0; p < parts.length; p++) {
        var sentence = parts[p];
        while (sentence.length > 200) {
          var cut = sentence.lastIndexOf(" ", 200);
          if (cut < 60) cut = 200;
          rawChunks.push(sentence.slice(0, cut).trim());
          sentence = sentence.slice(cut).trim();
        }
        if (sentence) rawChunks.push(sentence);
      }
      /* Split each piece further by script: a Bangla run is spoken by the
         Bangla voice, an English run by the English voice — so no Bangla
         part ever pops up in the middle of an English reply, or reverse. */
      var chunks = [];
      for (var q = 0; q < rawChunks.length; q++) {
        var piece = rawChunks[q], runs = [], cur = "", curBn = null;
        for (var c = 0; c < piece.length; c++) {
          var ch = piece.charAt(c);
          var isB = /[\u0980-\u09FF]/.test(ch);
          if (curBn === null) { curBn = isB; cur = ch; }
          else if (isB === curBn) { cur += ch; }
          else { runs.push(cur); cur = ch; curBn = isB; }
        }
        if (cur) runs.push(cur);
        for (var r = 0; r < runs.length; r++) {
          var run = runs[r].trim();
          if (!run) continue;
          if (run.length < 4 && chunks.length) chunks[chunks.length - 1] += " " + run;
          else chunks.push(run);
        }
      }
      /* Each chunk gets its own language's female-preferred voice, so the
         voice never flips to male in the middle of a reply. */
      /* STRICT RULE: only a female voice, ever. A male voice is never
         used — not even as a fallback. Chrome's Google voices are female. */
      var FEMALE_RE = /female|woman|zira|aria|samantha|natasha|heera|ananya|priya|tania|taniya|sunita|mona|sonia|farida|nusrat|nabanita|google বাংলা|^google /;
      function isFemaleVoice(v) {
        return v && FEMALE_RE.test((v.name || "").toLowerCase());
      }
      function pickVoice(isBn) {
        var voices = speechSynthesis.getVoices() || [];
        var want = isBn ? "bn" : "en";
        for (var i = 0; i < voices.length; i++) {
          var vl = (voices[i].lang || "").toLowerCase();
          if (vl.indexOf(want) === 0 && isFemaleVoice(voices[i])) return voices[i];
        }
        return null;
      }
      function anyFemaleVoice() {
        var voices = speechSynthesis.getVoices() || [];
        for (var i = 0; i < voices.length; i++) {
          if (isFemaleVoice(voices[i])) return voices[i];
        }
        return null;
      }
      var qi = 0, fastErr = 0, fellBack = false;
      function sayNext() {
        if (qi >= chunks.length) return;
        var txt = chunks[qi++];
        var isBn = /[\u0980-\u09FF]/.test(txt);
        var u = new SpeechSynthesisUtterance(txt);
        u.lang = isBn ? "bn-BD" : "en-US";
        /* Female voice of this chunk's language, else any female voice —
           never a male voice. If none exists, skip speech, text stays. */
        var v = pickVoice(isBn) || anyFemaleVoice();
        if (!v) { sayNext(); return; }
        u.voice = v;
        u.pitch = 1.0;
        u.rate = 1.0;
        var t0 = Date.now();
        u.onend = function () { fastErr = 0; sayNext(); };
        u.onerror = function () {
          /* Chrome sometimes kills a fresh chain instantly after cancel():
             if two chunks die in under 150ms, fall back to one plain
             utterance of the whole reply so something is always heard. */
          if (!fellBack && Date.now() - t0 < 150 && ++fastErr >= 2) {
            fellBack = true;
            try { speechSynthesis.speak(new SpeechSynthesisUtterance(clean)); } catch (e2) {}
            return;
          }
          sayNext();
        };
        speechSynthesis.speak(u);
      }
      /* Stop any old speech, then start a beat later: speaking in the same
         tick as cancel() is what makes Chrome drop the new voice. The
         voice list loads late on some machines, so wait up to 1.5s for a
         female voice to appear; if none ever appears, stay silent. */
      speechSynthesis.cancel();
      var voiceTries = 0;
      function startChain() {
        var firstBn = chunks.length && /[\u0980-\u09FF]/.test(chunks[0]);
        if (pickVoice(firstBn) || anyFemaleVoice()) { sayNext(); return; }
        if (voiceTries++ < 15) { setTimeout(startChain, 100); return; }
      }
      setTimeout(startChain, 80);
    } catch (e) { /* voice is an extra — never break the chat */ }
  }
  if ("speechSynthesis" in window) {
    /* Warm the voice list up front so the first reply is never voiceless. */
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = function () { speechSynthesis.getVoices(); };
    }
  }

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
      speak(reply);
      addVoteRow(text, reply);
      history.push({ role: "bot", text: reply });
      logExchange(text, reply, answered ? "" : "NEEDS-CEO");
      busy = false;
    }).catch(function () {
      typing.parentNode && typing.parentNode.removeChild(typing);
      addMsg(FALLBACK, "bot");
      speak(FALLBACK);
      addVoteRow(text, FALLBACK);
      logExchange(text, FALLBACK, "NEEDS-CEO");
      busy = false;
    });
  });
})();
