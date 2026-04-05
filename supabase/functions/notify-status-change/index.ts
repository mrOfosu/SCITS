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

    const { complaint_id, old_status, new_status } = await req.json();
    if (!complaint_id || !old_status || !new_status)
      throw new Error("complaint_id, old_status, and new_status are required");

    if (old_status === new_status) {
      return new Response(
        JSON.stringify({ success: true, message: "No status change" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dedupe key: use complaint_id + new_status combo
    const dedupeKey = `status_${complaint_id}_${old_status}_${new_status}`;

    // Check for recent duplicate (within last 60 seconds)
    const { data: existing } = await supabase
      .from("notification_log")
      .select("id")
      .eq("complaint_id", complaint_id)
      .eq("notification_type", "status_change")
      .eq("dedupe_key", dedupeKey)
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
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
      .select("user_id, reference_id, subject, priority")
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

    const statusLabels: Record<string, string> = {
      pending: "Pending",
      in_review: "In Review",
      resolved: "Resolved",
      closed: "Closed",
    };

    const priorityLabels: Record<string, string> = {
      low: "Low",
      medium: "Medium",
      high: "High",
    };

    // Insert log first for dedup
    const { error: logErr } = await supabase.from("notification_log").insert({
      complaint_id,
      recipient_email: profile.email,
      notification_type: "status_change",
      dedupe_key: dedupeKey,
      status: "sending",
    });

    if (logErr) throw logErr;

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
        subject: `Status Update: ${complaint.reference_id || complaint.subject} — ${statusLabels[new_status] || new_status}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Complaint Status Updated</h2>
            <p>Hi ${profile.display_name || "there"},</p>
            <p>The status of your complaint has been updated.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Reference</td><td style="padding: 8px;">${complaint.reference_id || "N/A"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Subject</td><td style="padding: 8px;">${complaint.subject}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Priority</td><td style="padding: 8px;">${priorityLabels[complaint.priority] || complaint.priority}</td></tr>
            </table>
            <div style="display: flex; align-items: center; gap: 12px; margin: 20px 0;">
              <div style="background: #fee2e2; color: #991b1b; padding: 8px 16px; border-radius: 6px; font-weight: 600;">
                ${statusLabels[old_status] || old_status}
              </div>
              <div style="font-size: 20px; color: #999;">→</div>
              <div style="background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 6px; font-weight: 600;">
                ${statusLabels[new_status] || new_status}
              </div>
            </div>
            <p style="color: #888; font-size: 12px;">This is an automated notification. Please log in to view your complaint details.</p>
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
        JSON.stringify({ success: false, error: `Resend error: ${JSON.stringify(emailData)}`, code: "EMAIL_DELIVERY_FAILED" }),
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
    console.error("Status notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
