/* Self Scale Academy — Supabase client (Phase 2).
   SECURITY: only the public anon key lives here. The secret admin key must
   NEVER appear anywhere in this app — the database is guarded by
   row-level security (RLS) policies instead.
   If the CDN script or the internet is unavailable, SSA_DB stays null and
   the site simply behaves as "logged out" (browsing still works offline). */
(function () {
  "use strict";
  var SUPABASE_URL = "https://actykevvljlwoxjybagw.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjdHlrZXZ2bGpsd294anliYWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzAyNDgsImV4cCI6MjEwODIwNjI0OH0.edsL4u0ms6jmcfBSlGjY93Av2XEd7VFfDTC1uAwbBew";
  window.SSA_DB = null;
  if (window.supabase && window.supabase.createClient) {
    try {
      window.SSA_DB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      window.SSA_DB = null;
    }
  }
})();
