import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { email, org_id, site_id, role } = await req.json();

    if (!email || !org_id || !site_id || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, org_id, site_id, role" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Verify the calling user is authenticated and belongs to the org
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: inviter }, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr || !inviter) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Confirm inviter belongs to the org
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("org_id")
      .eq("id", inviter.id)
      .single();

    if (profileErr || profile?.org_id !== org_id) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this organization" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Confirm inviter has admin or site_manager role for the target site
    const { data: roleRow } = await supabaseAdmin
      .from("user_site_roles")
      .select("role")
      .eq("user_id", inviter.id)
      .eq("site_id", site_id)
      .single();

    if (!roleRow || !["admin", "site_manager"].includes(roleRow.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: must be admin or site_manager for this site" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Send invitation — user_metadata is available in the signup trigger
    const { data, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        org_id,
        invited_to_site: site_id,
        invited_role: role,
      },
    });

    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: `Invitation sent to ${email}`, user_id: data.user?.id }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
