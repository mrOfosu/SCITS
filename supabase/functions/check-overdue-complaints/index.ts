import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const overdueDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overdueDays);

    // Find open complaints older than 7 days
    const { data: overdueComplaints, error: fetchErr } = await supabase
      .from("complaints")
      .select("id, reference_id, subject, priority, category, created_at, user_id")
      .in("status", ["pending", "in_review"])
      .lt("created_at", cutoffDate.toISOString());

    if (fetchErr) throw fetchErr;
    if (!overdueComplaints || overdueComplaints.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue complaints", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all admin user IDs
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) {
      return new Response(JSON.stringify({ message: "No admins found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing overdue notifications to avoid duplicates (last 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentNotifs } = await supabase
      .from("notifications")
      .select("complaint_id, user_id")
      .gte("created_at", oneDayAgo.toISOString())
      .like("title", "Overdue:%");

    const recentSet = new Set(
      (recentNotifs || []).map((n) => `${n.complaint_id}_${n.user_id}`)
    );

    const notifications: Array<{
      user_id: string;
      complaint_id: string;
      title: string;
      message: string;
    }> = [];

    for (const complaint of overdueComplaints) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const admin of admins) {
        const key = `${complaint.id}_${admin.user_id}`;
        if (recentSet.has(key)) continue; // Already notified within 24h

        notifications.push({
          user_id: admin.user_id,
          complaint_id: complaint.id,
          title: `Overdue: ${complaint.reference_id || complaint.subject}`,
          message: `This ${complaint.priority} priority complaint has been open for ${daysOverdue} days without resolution.`,
        });
      }
    }

    if (notifications.length > 0) {
      const { error: insertErr } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${overdueComplaints.length} overdue complaints`,
        notifications_sent: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-overdue-complaints error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
