import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Supabase service credentials are not configured");
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find complaints unresolved for >= 3 days, still at department level
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates, error } = await admin
      .from("complaints")
      .select("id, assigned_department_id, current_handler_id, current_handler_role, status, escalation_level, user_id, reference_id, subject, created_at")
      .in("status", ["pending", "in_review"])
      .eq("escalation_level", 0)
      .lt("created_at", cutoff);

    if (error) throw error;

    const results: { id: string; ok: boolean; error?: string; hod_id?: string | null }[] = [];
    const { data: hodRoles, error: hodRolesError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "hod");

    if (hodRolesError) throw hodRolesError;
    const hodUserIds = (hodRoles || []).map((r) => r.user_id);

    for (const c of candidates || []) {
      if (!c.assigned_department_id) {
        results.push({ id: c.id, ok: false, error: "missing assigned_department_id" });
        continue;
      }

      let hodId: string | null = null;

      // The HOD's primary profile department is authoritative. A staff link is
      // only a legacy fallback when the HOD profile has no department set.
      // Never use a faculty-wide or arbitrary-HOD fallback.
      if (hodUserIds.length > 0) {
        const { data: hodProfiles, error: hodProfilesError } = await admin
          .from("profiles")
          .select("id")
          .eq("department_id", c.assigned_department_id)
          .in("id", hodUserIds)
          .limit(1);

        if (hodProfilesError) {
          results.push({ id: c.id, ok: false, error: hodProfilesError.message });
          continue;
        }

        hodId = hodProfiles?.[0]?.id ?? null;
        if (!hodId) {
          const { data: hodStaff, error: hodStaffError } = await admin
            .from("department_staff")
            .select("user_id, profiles!inner(department_id)")
            .eq("department_id", c.assigned_department_id)
            .in("user_id", hodUserIds)
            .is("profiles.department_id", null)
            .limit(1);

          if (hodStaffError) {
            results.push({ id: c.id, ok: false, error: hodStaffError.message });
            continue;
          }
          hodId = hodStaff?.[0]?.user_id ?? null;
        }
      }

      if (!hodId) {
        results.push({ id: c.id, ok: false, error: "no HOD assigned to the complaint department" });
        continue;
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
        .eq("id", c.id)
        .eq("escalation_level", 0);

      if (upErr) {
        results.push({ id: c.id, ok: false, error: upErr.message });
        continue;
      }

      const { error: escalationError } = await admin.from("complaint_escalations").insert({
        complaint_id: c.id,
        previous_handler_id: prevId,
        previous_handler_role: prevRole,
        new_handler_id: hodId,
        new_handler_role: "hod",
        escalation_reason: reason,
        escalated_by: null,
      });
      if (escalationError) {
        results.push({ id: c.id, ok: false, error: escalationError.message, hod_id: hodId });
        continue;
      }

      const { error: activityError } = await admin.from("complaint_activity").insert({
        complaint_id: c.id,
        performed_by: c.user_id,
        action_type: "escalated",
        performed_role: "system",
        old_status: c.status,
        new_status: c.status,
        new_value: { reason, new_handler_role: "hod", new_handler_id: hodId, auto: true },
      });
      if (activityError) {
        results.push({ id: c.id, ok: false, error: activityError.message, hod_id: hodId });
        continue;
      }

      const { error: notificationError } = await admin.from("notifications").insert([
        {
          user_id: c.user_id,
          complaint_id: c.id,
          title: `Complaint Escalated: ${c.reference_id || c.subject}`,
          message: "Your complaint has been automatically escalated to the Head of Department after 3 days without resolution.",
        },
        {
          user_id: hodId,
          complaint_id: c.id,
          title: `Complaint Escalated to You: ${c.reference_id || c.subject}`,
          message: "An overdue complaint has been escalated to you as HOD. Reason: " + reason,
        },
      ]);
      if (notificationError) {
        results.push({ id: c.id, ok: false, error: notificationError.message, hod_id: hodId });
        continue;
      }

      results.push({ id: c.id, ok: true, hod_id: hodId });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("auto-escalate-complaints error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
