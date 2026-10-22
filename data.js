/* Self Scale Academy — central site data.
   Phase 1: all courses / products / prices / lessons live here so a later
   Supabase wiring only has to replace this file's source. */
var SSA_DATA = {
  brand: "Self Scale Academy",
  teacher: "Muhammad Jahid Hasan",
  teacherCaption: "Your English Language Teacher",
  bkashNumber: "01738601121",      /* payment number ONLY */
  whatsappNumber: "01782911601",   /* contact number ONLY — never for payment */
  whatsappLink: "https://wa.me/8801782911601",
  address: "Jamalpur Sadar, Jamalpur",

  courses: [
    {
      id: "spoken",
      type: "course",
      title: "Spoken English for Kids",
      titleBn: "বাচ্চাদের জন্য স্পোকেন ইংলিশ কোর্স",
      price: 499,
      regular: 5000,
      cover: "assets/cover-spoken.jpg",
      page: "course-spoken.html",
      cta: "ভর্তি হোন",
      ages: "বয়স ৫–১২ বছর",
      learn: [
        "আত্মবিশ্বাসের সঙ্গে ইংরেজিতে নিজের পরিচয় দেওয়া",
        "প্রতিদিনের কথোপকথনে ব্যবহৃত সহজ বাক্য সাবলীলভাবে বলা",
        "পরিবার, স্কুল, খাবার ও প্রাণী নিয়ে ইংরেজিতে কথা বলা",
        "সঠিক উচ্চারণে প্রশ্ন করা ও উত্তর দেওয়া",
        "ভদ্রভাবে কথা বলার শব্দ ও বাক্য (please, thank you, sorry)",
        "শোনা ও বলার নিয়মিত অনুশীলনে ভয় দূর করা"
      ],
      lessons: [
        { title: "Welcome — Speak English with Confidence", desc: "ইংরেজি বলার ভয় দূর করে আত্মবিশ্বাসের শুরু" },
        { title: "Greetings & Introducing Yourself", desc: "হ্যালো বলা ও নিজের পরিচয় দেওয়া" },
        { title: "My Family & About Myself", desc: "পরিবার ও নিজের সম্পর্কে বলা" },
        { title: "Numbers, Days, Months & Time", desc: "সংখ্যা, সপ্তাহের দিন, মাস ও সময় বলা" },
        { title: "My Daily Routine", desc: "প্রতিদিনের কাজের কথা ইংরেজিতে বলা" },
        { title: "Classroom English — At School", desc: "স্কুলে শিক্ষকের সঙ্গে ইংরেজিতে কথা বলা" },
        { title: "Asking Questions the Right Way", desc: "সঠিকভাবে প্রশ্ন করা শেখা" },
        { title: "Likes, Dislikes & Favourites", desc: "পছন্দ-অপছন্দ ও প্রিয় জিনিস নিয়ে কথা বলা" },
        { title: "Food Talk — At Home & Restaurant", desc: "খাবার নিয়ে ঘরে ও রেস্টুরেন্টে কথোপকথন" },
        { title: "Shopping — Prices & Bargaining (polite)", desc: "কেনাকাটা, দাম জানা ও ভদ্রভাবে দরদাম করা" },
        { title: "Asking for Directions", desc: "রাস্তা জিজ্ঞেস করা ও দিকনির্দেশনা বোঝা" },
        { title: "Weather & Seasons Talk", desc: "আবহাওয়া ও ঋতু নিয়ে কথা বলা" },
        { title: "At the Doctor — Health Talk", desc: "ডাক্তারের কাছে নিজের সমস্যা বলা" },
        { title: "Polite Requests & Phone English", desc: "ভদ্রভাবে অনুরোধ করা ও ফোনে কথা বলা" },
        { title: "Talking About Yesterday (Past Tense)", desc: "গতকালের ঘটনা বলা — অতীত কালের ব্যবহার" },
        { title: "My Future Plans", desc: "ভবিষ্যৎ পরিকল্পনা নিয়ে কথা বলা" },
        { title: "Describing People & Things", desc: "মানুষ ও জিনিসের বর্ণনা দেওয়া" },
        { title: "25 Daily Phrases — Set 1", desc: "প্রতিদিনের ২৫টি প্রয়োজনীয় বাক্য (প্রথম সেট)" },
        { title: "25 Daily Phrases — Set 2 + Small Talk", desc: "আরও ২৫টি বাক্য ও ছোটখাটো আলাপ করা" },
        { title: "Pronunciation Fix for Bengali Speakers", desc: "বাংলাভাষীদের সাধারণ উচ্চারণের ভুল ঠিক করা" },
        { title: "Listening & Shadowing Practice", desc: "শুনে শুনে হুবহু একইভাবে বলার অনুশীলন" },
        { title: "Final Review & Speaking Test", desc: "পুরো কোর্সের রিভিশন ও বলার পরীক্ষা" }
      ]
    },
    {
      id: "phonics",
      type: "course",
      title: "Phonics Course",
      titleBn: "শিশুদের ফনিক্স কোর্স — ধ্বনি শিখে পড়া",
      price: 499,
      regular: 5000,
      cover: "assets/cover-phonics.jpg",
      page: "course-phonics.html",
      cta: "ভর্তি হোন",
      ages: "বয়স ৪–১০ বছর",
      learn: [
        "প্রতিটি অক্ষরের সঠিক ধ্বনি (sound) শেখা",
        "ধ্বনি মিলিয়ে নিজে নিজে নতুন শব্দ পড়তে পারা",
        "CVC শব্দ ও ওয়ার্ড ফ্যামিলি পড়ার দক্ষতা",
        "ব্লেন্ড ও ডাইগ্রাফ যুক্ত কঠিন শব্দ পড়া",
        "সাইট ওয়ার্ড দেখেই চিনে ফেলা",
        "ছোট বাক্য সাবলীলভাবে পড়ার অভ্যাস গড়া"
      ],
      lessons: [
        { title: "What Is Phonics? Sounds: s a t", desc: "ফনিক্স কী — s, a, t ধ্বনি শেখা" },
        { title: "Sounds: i p n", desc: "i, p, n ধ্বনি ও তা দিয়ে শব্দ পড়া" },
        { title: "Sounds: ck e h", desc: "ck, e, h ধ্বনি শেখা" },
        { title: "Sounds: r m d", desc: "r, m, d ধ্বনি শেখা" },
        { title: "Sounds: g o u", desc: "g, o, u ধ্বনি শেখা" },
        { title: "Sounds: l f b", desc: "l, f, b ধ্বনি শেখা" },
        { title: "Sounds: ai j oa", desc: "ai, j, oa ধ্বনি শেখা" },
        { title: "Sounds: ie ee or", desc: "ie, ee, or ধ্বনি শেখা" },
        { title: "Sounds: z w ng", desc: "z, w, ng ধ্বনি শেখা" },
        { title: "Sounds: v oo", desc: "v ও oo ধ্বনি শেখা" },
        { title: "Sounds: y x ch", desc: "y, x, ch ধ্বনি শেখা" },
        { title: "Sounds: sh th", desc: "sh ও th ধ্বনি শেখা" },
        { title: "Sounds: qu ou oi", desc: "qu, ou, oi ধ্বনি শেখা" },
        { title: "Sounds: ue er ar", desc: "ue, er, ar ধ্বনি শেখা" },
        { title: "Blending CVC Words", desc: "ধ্বনি মিলিয়ে তিন অক্ষরের শব্দ পড়া (cat, pen)" },
        { title: "Reading Short Words Fast", desc: "ছোট শব্দ দ্রুত পড়ার অনুশীলন" },
        { title: "Reading Digraph Words", desc: "ডাইগ্রাফযুক্ত শব্দ পড়া (ship, chat, fish)" },
        { title: "Tricky Words — Set 1", desc: "দেখেই চেনা কঠিন শব্দ (প্রথম সেট)" },
        { title: "Tricky Words — Set 2 + Sentences", desc: "আরও কঠিন শব্দ ও বাক্যে তাদের ব্যবহার" },
        { title: "Reading Short Stories", desc: "ছোট গল্প নিজে নিজে পড়া" },
        { title: "Spelling with Sounds", desc: "ধ্বনি শুনে সঠিক বানান লেখা" },
        { title: "Final Review & Phonics Test", desc: "পুরো কোর্সের রিভিশন ও পড়ার পরীক্ষা" }
      ]
    }
  ],

  products: [
    {
      id: "packs",
      type: "product",
      title: "Question Paper Packs",
      titleBn: "প্রশ্নপত্র প্যাক — পরীক্ষার পূর্ণ প্রস্তুতি",
      price: 199,
      regular: 500,
      cover: "assets/cover-packs.jpg",
      page: "courses.html#card-packs",
      cta: "অর্ডার করুন"
    },
    {
      id: "ebook",
      type: "product",
      title: "Touchstone E-book",
      titleBn: "Touchstone ই-বুক — ঘরে বসে অনুশীলন",
      price: 299,
      regular: 1000,
      cover: "assets/cover-ebook.jpg",
      page: "courses.html#card-ebook",
      cta: "অর্ডার করুন"
    }
  ],

  faq: [
    {
      q: "কোর্সের ফি কত?",
      a: "Spoken English for Kids ও Phonics Course — প্রতিটি মাত্র ৳499 (নিয়মিত মূল্য ৳5,000)। এছাড়া Question Paper Packs ৳199 এবং Touchstone E-book ৳299।"
    },
    {
      q: "কীভাবে পেমেন্ট করব?",
      a: "বিকাশে 01738601121 নম্বরে Send Money করুন। তারপর কার্ট পেজের ফর্মে আপনার বিকাশ নম্বর ও TrxID দিন — বাকি কাজ আমরাই করব।"
    },
    {
      q: "পেমেন্টের পর অ্যাক্সেস কখন পাব?",
      a: "আমরা আপনার TrxID যাচাই করে অনুমোদন দিলেই আপনার অ্যাকাউন্টে কোর্স চালু হয়ে যাবে — সাধারণত ২৪ ঘণ্টার মধ্যে।"
    },
    {
      q: "প্রতিটি কোর্সে কয়টি লেসন আছে?",
      a: "প্রতিটি কোর্সে ২২টি লেসন আছে। প্রথম লেসনটি ফ্রি প্রিভিউ হিসেবে সবাই দেখতে পারবেন। কোর্স শেষে সার্টিফিকেটও পাবেন।"
    },
    {
      q: "রিফান্ড পলিসি কী?",
      id: "refund",
      a: "কেনার ৭ দিনের মধ্যে এবং কোর্সের ২০%-এর কম ব্যবহার করা হলে পূর্ণ রিফান্ড পাবেন। রিফান্ডের টাকা ৩–৫ কর্মদিবসের মধ্যে আপনার বিকাশে ফেরত দেওয়া হয়।"
    },
    {
      q: "সাহায্য দরকার হলে কোথায় যোগাযোগ করব?",
      a: "WhatsApp-এ মেসেজ করুন: 01782911601। অথবা এই পেজের নিচে ডানদিকের Ask Nowshin বাটনে যেকোনো প্রশ্ন করুন — আমাদের Customer Manager সঙ্গে সঙ্গে উত্তর দেবেন।"
    }
  ]
};

/* Find a course or product by id. */
function ssaFindItem(id) {
  var i;
  for (i = 0; i < SSA_DATA.courses.length; i++) if (SSA_DATA.courses[i].id === id) return SSA_DATA.courses[i];
  for (i = 0; i < SSA_DATA.products.length; i++) if (SSA_DATA.products[i].id === id) return SSA_DATA.products[i];
  return null;
}
function ssaDiscount(item) {
  return Math.round((1 - item.price / item.regular) * 100);
}
