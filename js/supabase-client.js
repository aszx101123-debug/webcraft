import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
export const supabase = createClient("https://rswxnprupyulbjblafgs.supabase.co", "sb_publishable_AFoQ_eNoMTeHmePv5TvC7w_aoL0gck7", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
