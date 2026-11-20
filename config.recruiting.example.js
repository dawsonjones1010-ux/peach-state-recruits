// EXAMPLE ONLY. Merge with the existing config.js; do not erase brand/payment settings.
// Use only your public Supabase publishable key (or legacy anon key), never service_role.
window.PSR_CONFIG = Object.assign({}, window.PSR_CONFIG || {}, {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "YOUR_PUBLIC_PUBLISHABLE_KEY"
});
// If the existing shared.js already defines window.PSR_SB, recruiting reuses that client.
