import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Auth is required — support form is only for logged-in users
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
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Enforce input length limits to prevent abuse
    if (name.length > 100 || email.length > 254 || subject.length > 200 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "One or more fields exceed the maximum allowed length" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Log to notifications table as a record for admins
    // In production, replace this with Resend / SendGrid / SMTP call
    const logEntry = {
      submitted_at: new Date().toISOString(),
      from_name: name,
      from_email: email,
      subject,
      message,
    };

    console.log("Support request received:", JSON.stringify(logEntry));

    // Optional: if SUPPORT_EMAIL_TO is configured, send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supportEmailTo = Deno.env.get("SUPPORT_EMAIL_TO");

    if (resendApiKey && supportEmailTo) {
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "support@fwmining.io",
          to: [supportEmailTo],
          reply_to: email,
          subject: `[Support] ${esc(subject)}`,
          html: `
            <h2>Support Request from ${esc(name)}</h2>
            <p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p>
            <p><strong>Subject:</strong> ${esc(subject)}</p>
            <hr />
            <p>${esc(message).replace(/\n/g, "<br>")}</p>
          `,
        }),
      });
      if (!emailRes.ok) {
        console.error("Resend error:", await emailRes.text());
      }
    }

    return new Response(
      JSON.stringify({ message: "Support request received. We'll be in touch soon." }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
