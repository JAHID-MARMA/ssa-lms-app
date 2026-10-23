/* Self Scale Academy — authenticity score (Founder order 2026-10-23).
   Shared by signup (disposable-email refusal), the student dashboard
   (computes + stores the score) and the Super Admin (security health).
   Score = real data + real behaviour, out of 100:
     real (non-disposable) email 15 · email verified 15 · valid BD mobile 20
     occupation 10 · institution 10 · profile photo 15
     learning activity 10 · account age 7+ days 5.                      */
(function () {
  var DISPOSABLE = [
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com",
    "temp-mail.org", "tempmail.com", "temp-mail.com", "tmpmail.com", "tmpmail.net", "yopmail.com",
    "throwawaymail.com", "dispostable.com", "maildrop.cc", "getnada.com", "fakeinbox.com", "mailnesia.com",
    "trashmail.com", "trashmail.net", "spamgourmet.com", "mytemp.email", "tempinbox.com", "emailondeck.com",
    "mintemail.com", "mohmal.com", "burnermail.io", "mailcatch.com", "inboxalias.com", "33mail.com",
    "anonbox.net", "deadaddress.com", "mailinator.net", "safetymail.info", "spambox.us", "uggsrock.com",
    "wegwerfmail.de", "einrot.com", "kurzeposten.de", "objectmail.com", "proxymail.eu", "rcpt.at",
    "reallymymail.com", "schrottemail.de", "sneakemail.com", "tempemail.com", "tempmail.de", "trash-mail.com"
  ];
  function isDisposable(email) {
    var d = String(email || "").toLowerCase().split("@")[1] || "";
    return DISPOSABLE.indexOf(d) !== -1;
  }
  function validMobile(m) { return /^01[3-9][0-9]{8}$/.test(String(m || "")); }
  function compute(sig) {
    sig = sig || {};
    var parts = [
      { key: "email_real", label: "আসল ইমেইল (অস্থায়ী নয়)", max: 15, ok: !!sig.email && !isDisposable(sig.email) },
      { key: "email_verified", label: "ইমেইল নিশ্চিত করা", max: 15, ok: !!sig.emailVerified },
      { key: "mobile", label: "সঠিক মোবাইল নম্বর", max: 20, ok: validMobile(sig.mobile) },
      { key: "occupation", label: "পেশা দেওয়া আছে", max: 10, ok: !!(sig.occupation && String(sig.occupation).trim()) },
      { key: "institution", label: "স্কুল/কলেজ/বিশ্ববিদ্যালয় দেওয়া আছে", max: 10, ok: !!(sig.institution && String(sig.institution).trim()) },
      { key: "avatar", label: "প্রোফাইল ছবি আছে", max: 15, ok: !!sig.avatarUrl },
      { key: "activity", label: "শেখার কার্যকলাপ (লেসন সম্পন্ন)", max: 10, ok: !!sig.hasProgress },
      { key: "age", label: "অ্যাকাউন্টের বয়স ৭+ দিন", max: 5, ok: (sig.ageDays || 0) >= 7 }
    ];
    var total = 0;
    parts.forEach(function (p) { p.pts = p.ok ? p.max : 0; total += p.pts; });
    return { score: total, parts: parts };
  }
  function band(score) {
    if (score == null || isNaN(score)) return { label: "মাপা হয়নি", color: "#6B7280", bg: "#F3F4F6" };
    if (score >= 80) return { label: "✅ অত্যন্ত নির্ভরযোগ্য", color: "#14703D", bg: "#E9F9F0" };
    if (score >= 50) return { label: "আংশিক যাচাইকৃত", color: "#9A6B00", bg: "#FFF7E0" };
    return { label: "দুর্বল — তথ্য অসম্পূর্ণ", color: "#B90E59", bg: "#FFF0F5" };
  }
  window.SSA_SCORE = { isDisposable: isDisposable, validMobile: validMobile, compute: compute, band: band, DISPOSABLE: DISPOSABLE };
})();
