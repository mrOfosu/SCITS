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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Supabase env vars missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { complaint_id } = await req.json();
    if (!complaint_id) throw new Error("complaint_id is required");

    // Dedupe check
    const dedupeKey = `new_complaint_${complaint_id}`;
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

    // Fetch complaint
    const { data: complaint, error: compErr } = await supabase
      .from("complaints")
      .select("user_id, reference_id, subject, category, priority, description")
      .eq("id", complaint_id)
      .single();

    if (compErr || !complaint) throw new Error("Complaint not found");

    // Fetch submitter profile
    const { data: submitter } = await supabase
      .from("profiles")
      .select("display_name, email, student_id")
      .eq("id", complaint.user_id)
      .single();

    // Fetch all admin user IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No admins found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch admin emails
    const adminIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminIds);

    const adminEmails = (adminProfiles || [])
      .map((p) => p.email)
      .filter((e): e is string => !!e);

    if (adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryLabels: Record<string, string> = {
      academic: "Academic",
      infrastructure: "Infrastructure",
      administrative: "Administrative",
      other: "Other",
    };

    const priorityLabels: Record<string, string> = {
      low: "Low",
      medium: "Medium",
      high: "High",
    };

    const priorityColors: Record<string, string> = {
      low: "#16a34a",
      medium: "#ca8a04",
      high: "#dc2626",
    };

    // Insert notification log for dedup
    const { error: logErr } = await supabase.from("notification_log").insert({
      complaint_id,
      recipient_email: adminEmails.join(", "),
      notification_type: "new_complaint",
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

    // Send email to all admins
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Complaints <onboarding@resend.dev>",
        to: adminEmails,
        subject: `New Complaint: ${complaint.reference_id || complaint.subject} [${priorityLabels[complaint.priority] || complaint.priority}]`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">New Complaint Submitted</h2>
            <p>A student has submitted a new complaint that requires your attention.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Reference</td><td style="padding: 8px;">${complaint.reference_id || "N/A"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Submitted by</td><td style="padding: 8px;">${submitter?.display_name || "Unknown"}${submitter?.student_id ? ` (${submitter.student_id})` : ""}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Category</td><td style="padding: 8px;">${categoryLabels[complaint.category] || complaint.category}</td></tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #666;">Priority</td>
                <td style="padding: 8px;">
                  <span style="background: ${priorityColors[complaint.priority] || "#666"}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                    ${priorityLabels[complaint.priority] || complaint.priority}
                  </span>
                </td>
              </tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Subject</td><td style="padding: 8px;">${complaint.subject}</td></tr>
            </table>
            <div style="background: #f5f5f5; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${complaint.description.substring(0, 300)}${complaint.description.length > 300 ? "..." : ""}</p>
            </div>
            <p style="color: #888; font-size: 12px;">Please log in to the admin dashboard to review and respond to this complaint.</p>
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
      throw new Error(`Resend error: ${JSON.stringify(emailData)}`);
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
    console.error("New complaint notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
