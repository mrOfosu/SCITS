import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawResendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const RESEND_API_KEY = rawResendApiKey
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^RESEND_API_KEY\s*=\s*/i, "")
      .replace(/^Bearer\s+/i, "");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Supabase env vars missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { complaint_id, response_id } = await req.json();
    if (!complaint_id || !response_id)
      throw new Error("complaint_id and response_id are required");

    // Fetch complaint to get current handler
    const { data: complaint, error: compErr } = await supabase
      .from("complaints")
      .select("current_handler_id, reference_id, subject, status")
      .eq("id", complaint_id)
      .single();

    if (compErr || !complaint) throw new Error("Complaint not found");
    if (!complaint.current_handler_id) throw new Error("No handler assigned to this complaint");

    // Fetch handler profile
    const { data: handlerProfile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", complaint.current_handler_id)
      .single();

    if (!handlerProfile?.email) throw new Error("Handler email not found");

    // Fetch response message
    const { data: response } = await supabase
      .from("complaint_responses")
      .select("message")
      .eq("id", response_id)
      .single();

    if (!response) throw new Error("Response not found");

    // Dedupe check
    const dedupeKey = `student_response_${response_id}`;
    const { data: existing } = await supabase
      .from("notification_log")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Already notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert notification log for dedup
    const { error: logErr } = await supabase.from("notification_log").insert({
      complaint_id,
      response_id,
      recipient_email: handlerProfile.email,
      notification_type: "student_response",
      dedupe_key: dedupeKey,
      status: "sending",
    });

    if (logErr) {
      if (logErr.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, message: "Already notified" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw logErr;
    }

    const statusLabels: Record<string, string> = {
      pending: "Pending",
      in_review: "In Review",
      resolved: "Resolved",
      closed: "Closed",
    };

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Complaints <noreply@stucomp.online>",
        to: [handlerProfile.email],
        subject: `Student Response: ${complaint.reference_id || complaint.subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">New Student Response</h2>
            <p>Hi ${handlerProfile.display_name || "there"},</p>
            <p>A student has added a response/comment to a complaint assigned to you.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Reference</td><td style="padding: 8px;">${complaint.reference_id || "N/A"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Subject</td><td style="padding: 8px;">${complaint.subject}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Status</td><td style="padding: 8px;">${statusLabels[complaint.status] || complaint.status}</td></tr>
            </table>
            <div style="background: #f5f5f5; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${response.message}</p>
            </div>
            <p style="color: #888; font-size: 12px;">This is an automated notification. Please log in to view the full conversation.</p>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      const isSandbox403 = emailRes.status === 403 || emailData?.statusCode === 403;
      await supabase
        .from("notification_log")
        .update({ status: isSandbox403 ? "skipped_sandbox" : "failed", error_message: JSON.stringify(emailData) })
        .eq("dedupe_key", dedupeKey);

      if (isSandbox403) {
        console.warn("Resend sandbox restriction – skipping email silently");
        return new Response(
          JSON.stringify({ success: true, message: "Skipped (sandbox mode)" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Resend error: ${JSON.stringify(emailData)}`,
          code: "EMAIL_DELIVERY_FAILED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("notification_log")
      .update({ status: "sent" })
      .eq("dedupe_key", dedupeKey);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Student response notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
