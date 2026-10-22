/* Self Scale Academy — Google Bridge (Apps Script web app).
   Founder order 2026-10-22: customer chats, leads (name + mobile),
   and sales/revenue are saved in the Founder's OWN Google Sheet.
   One web app, five tabs:
     "Chats"  — Time | Page | Name | Mobile | Customer wrote | Nowshin replied | Flag
     "Leads"  — Time | Name | Mobile | Page
     "Sales"  — Time | Customer | Mobile | Item | Amount | TrxID | Status
     "Nowshin Feedback" — Time | Page | Customer | Question | Answer | Vote
       (👍/👎 taps under Nowshin's answers in the chat widget — the
        Founder reads here what people ask and whether they were happy
        with her answer. The same votes are also stored in Supabase
        nowshin_feedback, where the Super Admin computes the happy-%.)
     "আয়-ব্যয়" — Date | Type | Title | Amount | Note | EntryID
       (Super Admin income & expense COPY — Supabase finance_entries is
        the primary store; rows upsert by EntryID so panel edits and
        deletes correct this copy too. Sheet stays in his Drive only.)
   Unanswered chats are flagged NEEDS-CEO in the Chats tab.

   SETUP (one time): open the Sheet → Extensions → Apps Script →
   delete any code → paste THIS whole file → Save →
   Deploy → New deployment → type "Web app" →
   Execute as: Me, Who has access: Anyone → Deploy →
   copy the Web app URL and give it to CEO. */

function sheetByName_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var when = d.t || new Date().toISOString();
    if (d.type === "lead") {
      sheetByName_("Leads", ["Time", "Name", "Mobile", "Page"])
        .appendRow([when, d.name || "", d.mobile || "", d.page || ""]);
    } else if (d.type === "finance") {
      /* Super Admin আয়-ব্যয় copy (Founder order 2026-10-22): rows are
         keyed by EntryID (last column). action "upsert" (default)
         updates the existing row for that EntryID — an edit made in
         the panel corrects the Sheet copy too, never duplicates;
         action "delete" removes that row. This Sheet lives in the
         Founder's own Drive only — nothing here is public. */
      var fsh = sheetByName_("আয়-ব্যয়", ["Date", "Type", "Title", "Amount", "Note", "EntryID"]);
      var fid = String(d.id || "");
      var fdata = fsh.getDataRange().getValues();
      var frow = -1;
      for (var fi = 1; fi < fdata.length; fi++) {
        if (fid && String(fdata[fi][5]) === fid) { frow = fi + 1; break; }
      }
      if (d.action === "delete") {
        if (frow > 0) fsh.deleteRow(frow);
      } else {
        var fvals = [d.entry_date || "", d.ftype || "", d.title || "",
                     d.amount || "", d.note || "", fid];
        if (frow > 0) fsh.getRange(frow, 1, 1, 6).setValues([fvals]);
        else fsh.appendRow(fvals);
      }
    } else if (d.type === "feedback") {
      /* Nowshin 👍/👎 (Phase 12): a visitor tapped thumbs-up or
         thumbs-down under one of Nowshin's answers. One row per tap —
         Question + Answer + Vote, so the Founder can read exactly
         what people ask and which answers made them unhappy. */
      sheetByName_("Nowshin Feedback", ["Time", "Page", "Customer", "Question", "Answer", "Vote"])
        .appendRow([when, d.page || "", d.name || "", d.question || "", d.answer || "",
                    d.vote === "up" ? "👍 Happy" : "👎 Not happy"]);
    } else if (d.type === "sale") {
      sheetByName_("Sales", ["Time", "Customer", "Mobile", "Item", "Amount", "TrxID", "Status"])
        .appendRow([when, d.name || "", d.mobile || "", d.item || "",
                    d.amount || "", d.trxid || "", d.status || ""]);
    } else {
      sheetByName_("Chats", ["Time", "Page", "Name", "Mobile", "Customer wrote", "Nowshin replied", "Flag"])
        .appendRow([when, d.page || "", d.name || "", d.mobile || "",
                    d.user || "", d.bot || "", d.flag || ""]);
    }
  } catch (err) {
    /* Logging must never break the customer's experience. */
  }
  return ContentService.createTextOutput("ok");
}

function doGet() {
  return ContentService.createTextOutput("SSA Google Bridge is running.");
}
