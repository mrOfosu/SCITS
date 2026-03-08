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

    const { complaint_id } = await req.json();
    if (!complaint_id) {
      return new Response(JSON.stringify({ error: "complaint_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all admin user IDs
    const { data: admins, error: adminErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminErr) throw adminErr;
    if (!admins || admins.length === 0) {
      return new Response(JSON.stringify({ assigned: false, reason: "No admins available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Round-robin: count open complaints per admin and pick the one with fewest
    const adminIds = admins.map((a) => a.user_id);

    // Count complaints currently in_review per admin (assigned = moved to in_review)
    const { data: openComplaints } = await supabase
      .from("complaint_activity")
      .select("performed_by")
      .eq("action_type", "status_change")
      .eq("new_status", "in_review")
      .in("performed_by", adminIds);

    const countMap: Record<string, number> = {};
    for (const id of adminIds) countMap[id] = 0;
    for (const c of openComplaints || []) {
      if (countMap[c.performed_by] !== undefined) countMap[c.performed_by]++;
    }

    // Pick admin with fewest assignments
    const assignedAdmin = adminIds.reduce((best, id) =>
      countMap[id] < countMap[best] ? id : best
    );

    // Move complaint to in_review
    const { error: updateErr } = await supabase
      .from("complaints")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("id", complaint_id)
      .eq("status", "pending"); // Only auto-assign pending ones

    if (updateErr) throw updateErr;

    // Log the activity
    await supabase.from("complaint_activity").insert({
      complaint_id,
      performed_by: assignedAdmin,
      performed_role: "admin",
      action_type: "status_change",
      old_status: "pending",
      new_status: "in_review",
    });

    // Get admin profile for notification
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", assignedAdmin)
      .maybeSingle();

    // Notify the assigned admin
    await supabase.from("notifications").insert({
      user_id: assignedAdmin,
      complaint_id,
      title: "Complaint Auto-Assigned",
      message: `A new complaint has been automatically assigned to you for review.`,
    });

    return new Response(
      JSON.stringify({
        assigned: true,
        admin_id: assignedAdmin,
        admin_name: adminProfile?.display_name || "Unknown",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-assign error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
