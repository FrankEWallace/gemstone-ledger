// supabase/functions/send-weekly-report/index.ts
// Sends a weekly KPI digest email via Resend for orgs that have enabled it.
// Intended to be called by a Supabase Cron job every Monday at 08:00 UTC.
// Can also be triggered manually from System Settings UI.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function weekRange() {
  const now  = new Date();
  const day  = now.getDay();
  // Sunday = 0, Monday = 1 ... saturday = 6
  // We want Mon–Sun of the LAST week
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - day - 6);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(lastMonday), to: fmt(lastSunday) };
}

// ─── Build HTML for one site ──────────────────────────────────────────────────

async function buildSiteReport(siteId: string, siteName: string, from: string, to: string): Promise<string> {
  // Revenue & expenses
  const { data: txs } = await supabase
    .from("transactions")
    .select("type, quantity, unit_price, status")
    .eq("site_id", siteId)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .eq("status", "success");

  const txList = txs ?? [];
  const revenue  = txList.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.quantity * t.unit_price, 0);
  const expenses = txList.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.quantity * t.unit_price, 0);

  // Open safety incidents
  const { count: openIncidents } = await supabase
    .from("safety_incidents")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .is("resolved_at", null);

  // Equipment needing service
  const { count: overdueEquipment } = await supabase
    .from("equipment")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .lte("next_service_date", to)
    .neq("status", "retired");

  // Low stock items
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("name, quantity, reorder_level")
    .eq("site_id", siteId)
    .not("reorder_level", "is", null);

  const lowStock = (inventory ?? []).filter((i: any) => i.quantity <= i.reorder_level);

  // Production log for the week
  const { data: prodLogs } = await supabase
    .from("production_logs")
    .select("ore_tonnes, waste_tonnes, grade_g_t")
    .eq("site_id", siteId)
    .gte("log_date", from)
    .lte("log_date", to);

  const totalOre  = (prodLogs ?? []).reduce((s: number, l: any) => s + (l.ore_tonnes ?? 0), 0);
  const avgGrade  = (prodLogs ?? []).filter((l: any) => l.grade_g_t != null).length > 0
    ? (prodLogs ?? []).filter((l: any) => l.grade_g_t != null).reduce((s: number, l: any) => s + l.grade_g_t, 0) /
      (prodLogs ?? []).filter((l: any) => l.grade_g_t != null).length
    : null;

  const pill = (label: string, value: string, color: string) =>
    `<td style="padding:8px 16px;background:${color}10;border-radius:8px;text-align:center;">
      <div style="font-size:11px;color:#666;margin-bottom:2px;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:${color};">${value}</div>
    </td>`;

  return `
    <h2 style="font-size:16px;font-weight:700;margin:24px 0 8px;">${siteName}</h2>
    <table style="border-collapse:separate;border-spacing:8px;margin-bottom:16px;">
      <tr>
        ${pill("Revenue", fmt(revenue), "#16a34a")}
        ${pill("Expenses", fmt(expenses), "#dc2626")}
        ${pill("Net", fmt(revenue - expenses), revenue >= expenses ? "#16a34a" : "#dc2626")}
        ${totalOre > 0 ? pill("Ore Extracted", `${totalOre.toLocaleString()}t`, "#b45309") : ""}
        ${avgGrade != null ? pill("Avg Grade", `${avgGrade.toFixed(3)} g/t`, "#7c3aed") : ""}
      </tr>
    </table>
    ${openIncidents ? `<p style="color:#ea580c;font-size:13px;">⚠️ ${openIncidents} open safety incident${openIncidents === 1 ? "" : "s"}</p>` : ""}
    ${overdueEquipment ? `<p style="color:#dc2626;font-size:13px;">🔧 ${overdueEquipment} equipment item${overdueEquipment === 1 ? "" : "s"} overdue for service</p>` : ""}
    ${lowStock.length > 0
      ? `<p style="color:#b45309;font-size:13px;">📦 Low stock: ${lowStock.slice(0, 5).map((i: any) => i.name).join(", ")}${lowStock.length > 5 ? ` +${lowStock.length - 5} more` : ""}</p>`
      : ""}
  `;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Auth: accept either the CRON_SECRET (for scheduled invocations) or a valid
  // user JWT (for manual triggers from the System Settings UI).
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET");

  let authed = false;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Called by the Supabase cron scheduler
    authed = true;
  } else if (authHeader.startsWith("Bearer ")) {
    // Called manually from the UI — verify the user JWT
    const supabaseClient = createClient(
      SUPABASE_URL,
      ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    authed = !!user;
  }

  if (!authed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Allow manual trigger from UI with optional org_id filter
  let targetOrgId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      targetOrgId = body?.org_id ?? null;
    } catch { /* no body */ }
  }

  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const { from, to } = weekRange();

  // Fetch orgs with weekly reports enabled
  const query = supabase
    .from("organizations")
    .select("id, name, weekly_report_email")
    .eq("weekly_report_enabled", true)
    .not("weekly_report_email", "is", null);

  if (targetOrgId) query.eq("id", targetOrgId);

  const { data: orgs, error: orgErr } = await query;
  if (orgErr) return new Response(JSON.stringify({ error: orgErr.message }), { status: 500 });

  const results: { org: string; sent: boolean; error?: string }[] = [];

  for (const org of orgs ?? []) {
    // Fetch all sites for this org
    const { data: sites } = await supabase
      .from("sites")
      .select("id, name")
      .eq("org_id", org.id);

    let body = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111;">
        <h1 style="font-size:20px;font-weight:800;margin-bottom:4px;">📊 Weekly KPI Report</h1>
        <p style="color:#666;font-size:13px;margin-top:0;">${org.name} · Week of ${from} to ${to}</p>
    `;

    for (const site of sites ?? []) {
      body += await buildSiteReport(site.id, site.name, from, to);
    }

    body += `
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:11px;color:#999;">
          You're receiving this because weekly reports are enabled for ${org.name}.
          Manage settings in FW Mining OS → Settings → System Settings.
        </p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FW Mining OS <reports@fwmining.app>",
          to: [org.weekly_report_email],
          subject: `Weekly Report — ${org.name} (${from})`,
          html: body,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        results.push({ org: org.name, sent: false, error: err });
      } else {
        results.push({ org: org.name, sent: true });
      }
    } catch (e: any) {
      results.push({ org: org.name, sent: false, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results, from, to }), {
    headers: { "Content-Type": "application/json" },
  });
});
