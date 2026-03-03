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

    // Check for duplicate
    const { data: existing } = await supabase
      .from("notification_log")
      .select("id")
      .eq("response_id", response_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Already notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch complaint
    const { data: complaint, error: compErr } = await supabase
      .from("complaints")
      .select("user_id, reference_id, subject, status")
      .eq("id", complaint_id)
      .single();

    if (compErr || !complaint) throw new Error("Complaint not found");

    // Fetch owner email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", complaint.user_id)
      .single();

    if (!profile?.email) throw new Error("Owner email not found");

    // Fetch response message
    const { data: response } = await supabase
      .from("complaint_responses")
      .select("message")
      .eq("id", response_id)
      .single();

    if (!response) throw new Error("Response not found");

    // Insert log first (prevents duplicates via unique constraint)
    const dedupeKey = `response_${response_id}`;
    const { error: logErr } = await supabase.from("notification_log").insert({
      complaint_id,
      response_id,
      recipient_email: profile.email,
      notification_type: "response",
      dedupe_key: dedupeKey,
      status: "sending",
    });

    if (logErr) {
      // Unique constraint violation = already sent
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
        from: "Complaints <onboarding@resend.dev>",
        to: [profile.email],
        subject: `Update on your complaint: ${complaint.reference_id || complaint.subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">New Response on Your Complaint</h2>
            <p>Hi ${profile.display_name || "there"},</p>
            <p>An admin has responded to your complaint.</p>
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
      await supabase
        .from("notification_log")
        .update({ status: "failed", error_message: JSON.stringify(emailData) })
        .eq("response_id", response_id);

      throw new Error(`Resend error: ${JSON.stringify(emailData)}`);
    }

    // Mark as sent
    await supabase
      .from("notification_log")
      .update({ status: "sent" })
      .eq("response_id", response_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
