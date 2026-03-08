import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import AttachmentPreview from "@/components/AttachmentPreview";
import ReactMarkdown from "react-markdown";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import ActivityLog from "@/components/ActivityLog";
import type { ActivityEntry } from "@/components/ActivityLog";
import type { Tables, Database } from "@/integrations/supabase/types";

type ComplaintStatus = Database["public"]["Enums"]["complaint_status"];

interface ResponseWithProfile {
  id: string;
  message: string;
  created_at: string;
  responder_id: string;
  profiles: { display_name: string } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "secondary" },
  medium: { label: "Medium", variant: "outline" },
  high: { label: "High", variant: "destructive" },
};

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administrative: "Administrative",
  other: "Other",
};

const nextStatusMap: Record<string, ComplaintStatus | null> = {
  pending: "in_review",
  in_review: "resolved",
  resolved: "closed",
  closed: null,
};

const transitionLabels: Record<string, string> = {
  in_review: "Mark as In Review",
  resolved: "Mark as Resolved",
  closed: "Close Complaint",
};

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [complaint, setComplaint] = useState<Tables<"complaints"> | null>(null);
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    const { data: comp } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
    setComplaint(comp);

    const { data: resp } = await supabase
      .from("complaint_responses")
      .select("id, message, created_at, responder_id")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    const enriched: ResponseWithProfile[] = [];
    for (const r of resp || []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", r.responder_id)
        .maybeSingle();
      enriched.push({ ...r, profiles: profile });
    }
    setResponses(enriched);

    const { data: act } = await supabase
      .from("complaint_activity")
      .select("*")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    const enrichedAct: ActivityEntry[] = [];
    for (const a of act || []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", a.performed_by)
        .maybeSingle();
      enrichedAct.push({
        id: a.id,
        action_type: a.action_type,
        performed_by: a.performed_by,
        performed_role: a.performed_role,
        old_status: a.old_status,
        new_status: a.new_status,
        old_value: a.old_value as Record<string, unknown> | null,
        new_value: a.new_value as Record<string, unknown> | null,
        created_at: a.created_at,
        profiles: profile,
      });
    }
    setActivity(enrichedAct);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const nextStatus = complaint ? nextStatusMap[complaint.status] : null;

  const handleTransition = async () => {
    if (!isAdmin || !id || !nextStatus || !complaint) return;
    setTransitioning(true);
    const oldStatus = complaint.status;
    const { error } = await supabase
      .from("complaints")
      .update({ status: nextStatus })
      .eq("id", id);
    if (error) {
      toast({ title: "Invalid transition", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status updated", description: `Moved to ${statusConfig[nextStatus]?.label}` });
      // Send status change notification (fire-and-forget)
      supabase.functions.invoke("notify-status-change", {
        body: { complaint_id: id, old_status: oldStatus, new_status: nextStatus },
      }).then(({ error: notifErr }) => {
        if (notifErr) console.error("Status notification failed:", notifErr);
      });
      fetchData();
    }
    setTransitioning(false);
  };

  const handleSendResponse = async () => {
    if (!user || !id || !newMessage.trim()) return;
    setSending(true);
    const { data: inserted, error } = await supabase.from("complaint_responses").insert({
      complaint_id: id,
      responder_id: user.id,
      message: newMessage,
    }).select("id").single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Response sent" });
      setNewMessage("");
      // Send email notification (fire-and-forget, don't block UI)
      if (isAdmin && inserted?.id) {
        supabase.functions.invoke("notify-complaint-response", {
          body: { complaint_id: id, response_id: inserted.id },
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error("Notification failed:", notifErr);
        });
      }
      fetchData();
    }
    setSending(false);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!complaint) return <div className="py-12 text-center text-muted-foreground">Complaint not found.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {isAdmin && <AdminBreadcrumb />}
      {isAdmin && (
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/complaints")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Complaints
        </Button>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{complaint.subject}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {complaint.reference_id && (
                  <span className="font-mono text-xs font-medium text-foreground">{complaint.reference_id}</span>
                )}
                <span>·</span>
                <span>{categoryLabels[complaint.category]}</span>
                {complaint.sub_category && (
                  <>
                    <span>›</span>
                    <span className="capitalize">{complaint.sub_category}</span>
                  </>
                )}
                <span>·</span>
                <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={priorityConfig[complaint.priority]?.variant || "outline"}>
                {priorityConfig[complaint.priority]?.label || complaint.priority}
              </Badge>
              <Badge variant={statusConfig[complaint.status]?.variant || "outline"}>
                {statusConfig[complaint.status]?.label || complaint.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{complaint.description}</p>
          {complaint.attachment_url && (
            <AttachmentPreview attachmentUrl={complaint.attachment_url} />
          )}
        </CardContent>
      </Card>

      {/* Admin status workflow */}
      {isAdmin && nextStatus && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={statusConfig[complaint.status]?.variant || "outline"}>
                {statusConfig[complaint.status]?.label}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant={statusConfig[nextStatus]?.variant || "outline"}>
                {statusConfig[nextStatus]?.label}
              </Badge>
            </div>
            <Button size="sm" onClick={handleTransition} disabled={transitioning}>
              {transitioning ? "Updating..." : transitionLabels[nextStatus] || "Advance"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && !nextStatus && complaint.status === "closed" && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            This complaint is closed. No further status changes are available.
          </CardContent>
        </Card>
      )}

      {/* Activity log */}
      <ActivityLog activity={activity} />

      {/* Responses */}
      <div className="space-y-3">
        <h3 className="font-semibold">Responses</h3>
        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No responses yet.</p>
        ) : (
          responses.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{r.profiles?.display_name || "Unknown"}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add response */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isAdmin ? "Write a response to the student..." : "Add a comment..."}
            rows={3}
          />
          <Button onClick={handleSendResponse} disabled={sending || !newMessage.trim()}>
            {sending ? "Sending..." : "Send Response"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
