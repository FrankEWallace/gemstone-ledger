// Supabase Edge Function: evaluate-alerts
// Called on a schedule (pg_cron or Supabase scheduled function) or manually.
// Evaluates all enabled alert_rules and fires notifications for triggered ones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Require a shared secret so only the Supabase cron system (or an admin)
  // can trigger this function. Set CRON_SECRET in Supabase Edge Function secrets.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // Fetch all enabled rules
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) throw rulesError;
    if (!rules?.length) return new Response(JSON.stringify({ triggered: 0 }), { headers: CORS });

    let triggered = 0;

    for (const rule of rules) {
      let value: number | null = null;

      // ── Evaluate rule ────────────────────────────────────────────────────
      if (rule.entity_type === "inventory_item" && rule.field === "quantity") {
        // Find any item in this site where quantity satisfies operator vs threshold
        const { data: items } = await supabase
          .from("inventory_items")
          .select("id, name, quantity")
          .eq("site_id", rule.site_id);

        const matching = (items ?? []).filter((item: { quantity: number }) =>
          evalOp(item.quantity, rule.operator, rule.threshold)
        );

        if (matching.length === 0) continue;
        value = matching.length;

      } else if (rule.entity_type === "equipment" && rule.field === "days_since_service") {
        const { data: equip } = await supabase
          .from("equipment")
          .select("id, name, last_service_date, status")
          .eq("site_id", rule.site_id)
          .neq("status", "retired");

        const now = Date.now();
        const matching = (equip ?? []).filter((e: { last_service_date: string | null }) => {
          if (!e.last_service_date) return false;
          const days = (now - new Date(e.last_service_date).getTime()) / 86_400_000;
          return evalOp(days, rule.operator, rule.threshold);
        });

        if (matching.length === 0) continue;
        value = matching.length;

      } else if (rule.entity_type === "safety_incident" && rule.field === "open_count") {
        const { count } = await supabase
          .from("safety_incidents")
          .select("id", { count: "exact", head: true })
          .eq("site_id", rule.site_id)
          .is("resolved_at", null);

        value = count ?? 0;
        if (!evalOp(value, rule.operator, rule.threshold)) continue;
      } else {
        continue;
      }

      // ── Cooldown: don't spam — only trigger once per hour ─────────────────
      if (rule.last_triggered_at) {
        const diff = Date.now() - new Date(rule.last_triggered_at).getTime();
        if (diff < 60 * 60 * 1000) continue;
      }

      // ── Get all admins/managers for this site ─────────────────────────────
      const { data: recipients } = await supabase
        .from("site_roles")
        .select("user_id")
        .eq("site_id", rule.site_id)
        .in("role", ["admin", "site_manager"]);

      if (!recipients?.length) continue;

      // ── Insert notifications ──────────────────────────────────────────────
      const notifications = recipients.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        title: rule.notification_title,
        body: rule.notification_body ?? `Threshold: ${rule.operator} ${rule.threshold} (current: ${value})`,
        type: "alert",
        read: false,
      }));

      await supabase.from("notifications").insert(notifications);

      // ── Update last_triggered_at ──────────────────────────────────────────
      await supabase
        .from("alert_rules")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", rule.id);

      triggered++;
    }

    return new Response(
      JSON.stringify({ triggered, evaluated: rules.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

function evalOp(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    case "gt":  return value > threshold;
    case "lt":  return value < threshold;
    case "eq":  return value === threshold;
    default:    return false;
  }
}
