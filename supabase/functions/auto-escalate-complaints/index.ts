import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find complaints unresolved for >= 3 days, still at department level
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error } = await admin
    .from("complaints")
    .select("id, assigned_department_id, current_handler_id, current_handler_role, status, escalation_level, user_id, reference_id, subject, created_at")
    .in("status", ["pending", "in_review"])
    .eq("escalation_level", 0)
    .lt("created_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: { id: string; ok: boolean; error?: string; hod_id?: string | null }[] = [];

  for (const c of candidates || []) {
    // Find HOD for the department
    const { data: hodRows } = await admin
      .from("user_roles")
      .select("user_id, profiles!inner(department_id), department_staff(department_id)")
      .eq("role", "hod");

    const hodId =
      (hodRows || []).find(
        (r: any) =>
          r.profiles?.department_id === c.assigned_department_id ||
          (Array.isArray(r.department_staff) && r.department_staff.some((d: any) => d.department_id === c.assigned_department_id))
      )?.user_id ?? null;

    const prevRole = c.current_handler_role || "department_admin";
    const prevId = c.current_handler_id;
    const reason = "Auto-escalated: complaint unresolved after 3 days at department level.";

    const { error: upErr } = await admin
      .from("complaints")
      .update({
        escalation_level: 1,
        escalated_at: new Date().toISOString(),
        escalation_reason: reason,
        current_handler_id: hodId,
        current_handler_role: "hod",
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    if (upErr) {
      results.push({ id: c.id, ok: false, error: upErr.message });
      continue;
    }

    await admin.from("complaint_escalations").insert({
      complaint_id: c.id,
      previous_handler_id: prevId,
      previous_handler_role: prevRole,
      new_handler_id: hodId,
      new_handler_role: "hod",
      escalation_reason: reason,
      escalated_by: null,
    });

    await admin.from("complaint_activity").insert({
      complaint_id: c.id,
      performed_by: c.user_id, // placeholder since system
      action_type: "escalated",
      performed_role: "system",
      old_status: c.status,
      new_status: c.status,
      new_value: { reason, new_handler_role: "hod", new_handler_id: hodId, auto: true },
    });

    const notifications: any[] = [
      {
        user_id: c.user_id,
        complaint_id: c.id,
        title: `Complaint Escalated: ${c.reference_id || c.subject}`,
        message: "Your complaint has been automatically escalated to the Head of Department after 3 days without resolution.",
      },
    ];
    if (hodId) {
      notifications.push({
        user_id: hodId,
        complaint_id: c.id,
        title: `Complaint Escalated to You: ${c.reference_id || c.subject}`,
        message: "An overdue complaint has been escalated to you as HOD.",
      });
    }
    await admin.from("notifications").insert(notifications);

    results.push({ id: c.id, ok: true, hod_id: hodId });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
