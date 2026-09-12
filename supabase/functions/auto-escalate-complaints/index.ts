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
    if (!c.assigned_department_id) {
      results.push({ id: c.id, ok: false, error: "missing assigned_department_id" });
      continue;
    }

    // HOD lookup matching manual escalate_complaint RPC:
    // SELECT ur.user_id FROM user_roles ur
    // LEFT JOIN department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c.assigned_department_id
    // LEFT JOIN profiles p ON p.id = ur.user_id AND p.department_id = c.assigned_department_id
    // WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL) LIMIT 1
    const { data: hodStaff } = await admin
      .from("department_staff")
      .select("user_id, user_roles!inner(role)")
      .eq("department_id", c.assigned_department_id)
      .eq("user_roles.role", "hod")
      .limit(1);

    let hodId: string | null = null;

    if (hodStaff && hodStaff.length > 0) {
      hodId = hodStaff[0].user_id;
    } else {
      const { data: hodProfiles } = await admin
        .from("profiles")
        .select("id, user_roles!inner(role)")
        .eq("department_id", c.assigned_department_id)
        .eq("user_roles.role", "hod")
        .limit(1);

      if (hodProfiles && hodProfiles.length > 0) {
        hodId = hodProfiles[0].id;
      }
    }

    const prevRole = c.current_handler_role || "department_admin";
    const prevId = c.current_handler_id;
    const reason = "Auto-escalated: complaint unresolved after 3 days at department level.";

    const { error: upErr } = await admin
      .from("complaints")
      .update({
        escalation_level: 1,
        escalated_at: new Date().toISOString(),
        escalated_by: null,
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
      performed_by: c.user_id,
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
        message: "An overdue complaint has been escalated to you as HOD. Reason: " + reason,
      });
    }
    await admin.from("notifications").insert(notifications);

    results.push({ id: c.id, ok: true, hod_id: hodId });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
