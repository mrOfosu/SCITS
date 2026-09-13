import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const cleanResendKey = (value: string) => value.trim()
  .replace(/^['"]|['"]$/g, "")
  .replace(/^RESEND_API_KEY\s*=\s*/i, "")
  .replace(/^Bearer\s+/i, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = cleanResendKey(Deno.env.get("RESEND_API_KEY") ?? "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { complaint_id, feedback_id } = await req.json();
    if (!complaint_id || !feedback_id) throw new Error("complaint_id and feedback_id are required");

    const dedupeKey = `complaint_feedback_${feedback_id}`;
    const { data: existing } = await supabase.from("notification_log")
      .select("id, status").eq("dedupe_key", dedupeKey).maybeSingle();
    if (existing?.status === "sent" || existing?.status === "sending") {
      return new Response(JSON.stringify({ success: true, message: "Already notified" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: complaint, error: complaintError }, { data: feedback, error: feedbackError }] = await Promise.all([
      supabase.from("complaints").select("reference_id, subject, department_id, resolved_by, current_handler_id, assigned_admin_id").eq("id", complaint_id).single(),
      supabase.from("complaint_feedback").select("rating, satisfied, comment, created_at").eq("id", feedback_id).eq("complaint_id", complaint_id).single(),
    ]);
    if (complaintError || !complaint) throw new Error("Complaint not found");
    if (feedbackError || !feedback) throw new Error("Feedback not found");

    // The person who resolved it is authoritative; use the live handler only
    // for legacy complaints that do not yet have resolved_by populated.
    const handlerId = complaint.resolved_by ?? complaint.current_handler_id ?? complaint.assigned_admin_id;
    if (!handlerId) throw new Error("No handling admin is recorded for this complaint");
    const [{ data: handler }, { data: department }] = await Promise.all([
      supabase.from("profiles").select("email, display_name").eq("id", handlerId).single(),
      complaint.department_id
        ? supabase.from("departments").select("department_name").eq("id", complaint.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!handler?.email) throw new Error("Handling admin email not found");

    const logPayload = {
      complaint_id,
      recipient_email: handler.email,
      notification_type: "complaint_feedback",
      dedupe_key: dedupeKey,
      status: "sending",
      error_message: null,
    };
    const { error: logError } = existing
      ? await supabase.from("notification_log").update(logPayload).eq("id", existing.id)
      : await supabase.from("notification_log").insert(logPayload);
    if (logError) throw logError;

    const stars = "★".repeat(feedback.rating ?? 0) + "☆".repeat(5 - (feedback.rating ?? 0));
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Complaints <noreply@stucomp.online>",
        to: [handler.email],
        subject: `Student Review: ${complaint.reference_id || complaint.subject} — ${feedback.rating ?? "—"}/5`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px"><h2>New Student Review</h2><p>Hi ${handler.display_name || "there"},</p><p>A student reviewed a complaint you handled.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;font-weight:bold">Reference</td><td style="padding:8px">${complaint.reference_id || "N/A"}</td></tr><tr><td style="padding:8px;font-weight:bold">Subject</td><td style="padding:8px">${complaint.subject}</td></tr><tr><td style="padding:8px;font-weight:bold">Department</td><td style="padding:8px">${department?.department_name || "—"}</td></tr><tr><td style="padding:8px;font-weight:bold">Rating</td><td style="padding:8px">${stars} (${feedback.rating ?? "—"}/5)</td></tr><tr><td style="padding:8px;font-weight:bold">Outcome</td><td style="padding:8px">${feedback.satisfied ? "Issue resolved" : "Not resolved"}</td></tr></table><div style="background:#f5f5f5;border-left:4px solid #3b82f6;padding:16px;margin-top:16px"><strong>Feedback</strong><p style="white-space:pre-wrap">${feedback.comment || "No written feedback provided."}</p></div></div>`,
      }),
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      const sandbox = emailRes.status === 403 || emailData?.statusCode === 403;
      await supabase.from("notification_log").update({ status: sandbox ? "skipped_sandbox" : "failed", error_message: JSON.stringify(emailData) }).eq("dedupe_key", dedupeKey);
      return new Response(JSON.stringify({ success: false, error: `Resend error: ${JSON.stringify(emailData)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("notification_log").update({ status: "sent" }).eq("dedupe_key", dedupeKey);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Complaint feedback notification error:", error);
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
