// Deletes the signed-in user's account and everything saved with it.
//
// POST with the user's session token as the Authorization bearer.
// → 200 { deleted: true }, 401 not signed in, 500 the delete failed.
//
// Deleting the auth user removes their profile, friend code and stats too,
// since those rows reference it with ON DELETE CASCADE. Only the service role
// can delete auth users, so this runs here and never in the app.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not signed in" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Works out who is asking from their own token, so nobody can delete someone else.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "not signed in" }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return json({ error: "delete failed" }, 500);

  return json({ deleted: true });
});
