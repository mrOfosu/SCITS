import { useEffect, useState, useCallback } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Sparkles, RefreshCw, Clock, User, Bookmark, BookmarkCheck, RotateCcw, Download, Trash2, TrendingUp, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AttachmentPreview from "@/components/AttachmentPreview";
import ReactMarkdown from "react-markdown";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import ActivityLog from "@/components/ActivityLog";
import FeedbackPrompt from "@/components/FeedbackPrompt";
import ComplaintPdfExport from "@/components/ComplaintPdfExport";
import type { ActivityEntry } from "@/components/ActivityLog";
import type { Tables, Database } from "@/integrations/supabase/types";
import { timeAgo, estimatedResolutionLabel } from "@/lib/timeUtils";

// Inline component: shows full student details for admins
function StudentDetailCard({ userId, isAnonymous }: { userId: string; isAnonymous: boolean }) {
  const [profile, setProfile] = useState<{ display_name: string; full_name: string | null; student_id: string | null; email: string | null; department: string | null; level: string | null; phone_number: string | null } | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("display_name, full_name, student_id, email, department, level, phone_number").eq("id", userId).maybeSingle().then(({ data }) => setProfile(data));
  }, [userId]);

  if (!profile) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student Details</h4>
        {isAnonymous && <Badge variant="outline" className="text-[10px]">Anonymous Submission</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div><span className="text-muted-foreground">Name:</span> {profile.full_name || profile.display_name}</div>
        <div><span className="text-muted-foreground">Student ID:</span> {profile.student_id || "—"}</div>
        <div><span className="text-muted-foreground">Email:</span> {profile.email || "—"}</div>
        <div><span className="text-muted-foreground">Department:</span> {profile.department || "—"}</div>
        <div><span className="text-muted-foreground">Level:</span> {profile.level || "—"}</div>
        <div><span className="text-muted-foreground">Phone:</span> {profile.phone_number || "—"}</div>
      </div>
    </div>
  );
}

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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null | undefined>(undefined);
  const [assignedAdmin, setAssignedAdmin] = useState<string | null>(null);
  const [currentHandler, setCurrentHandler] = useState<string | null>(null);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [myRoles, setMyRoles] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    const { data: comp } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
    setComplaint(comp);

    // Clear new updates flag for student
    if (comp && !isAdmin && comp.has_new_updates) {
      supabase.from("complaints").update({ has_new_updates: false }).eq("id", id).then(() => {});
    }

    // Fetch assigned admin name
    if (comp && comp.assigned_admin_id) {
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", comp.assigned_admin_id)
        .maybeSingle();
      setAssignedAdmin(adminProfile?.display_name || null);
    }

    // Fetch current handler name
    if (comp && comp.current_handler_id) {
      const { data: handlerProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", comp.current_handler_id)
        .maybeSingle();
      setCurrentHandler(handlerProfile?.display_name || null);
    } else {
      setCurrentHandler(null);
    }

    // Fetch my roles (for escalate button visibility)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    setMyRoles((roles || []).map((r) => r.role));

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

    // Fetch bookmark status
    const { data: bm } = await supabase
      .from("complaint_bookmarks")
      .select("id")
      .eq("complaint_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    setBookmarked(!!bm);

    // Fetch feedback
    const { data: fb } = await supabase
      .from("complaint_feedback")
      .select("satisfied")
      .eq("complaint_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    setFeedback(fb ? fb.satisfied : null);

    setLoading(false);
  }, [id, user, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: refresh on complaint, response, activity, or escalation changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`complaint-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `id=eq.${id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_responses", filter: `complaint_id=eq.${id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_activity", filter: `complaint_id=eq.${id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_escalations", filter: `complaint_id=eq.${id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchData]);


  useEffect(() => {
    if (!isAdmin || !complaint) return;
    if (complaint.ai_summary) {
      setAiSummary(complaint.ai_summary);
    }
  }, [complaint, isAdmin]);

  const generateAiSummary = async () => {
    if (!id) return;
    setGeneratingSummary(true);
    setAiSummary(null);
    const { data, error } = await supabase.functions.invoke("generate-ai-summary", {
      body: { complaint_id: id },
    });
    if (error) {
      toast({ title: "Error", description: "Failed to generate AI summary", variant: "destructive" });
    } else {
      const newSummary = data?.summary || "Summary unavailable.";
      setAiSummary(newSummary);
      toast({ title: "AI Summary regenerated successfully" });
    }
    setGeneratingSummary(false);
  };

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
      fetchData();
    }
    setTransitioning(false);
  };

  const handleReopen = async () => {
    if (!id || !complaint) return;
    setTransitioning(true);
    const { error } = await supabase
      .from("complaints")
      .update({ status: "in_review" as ComplaintStatus })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Complaint reopened", description: "Status changed to In Review" });
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

  const toggleBookmark = async () => {
    if (!user || !id) return;
    if (bookmarked) {
      await supabase.from("complaint_bookmarks").delete().eq("complaint_id", id).eq("user_id", user.id);
      setBookmarked(false);
      toast({ title: "Bookmark removed" });
    } else {
      await supabase.from("complaint_bookmarks").insert({ complaint_id: id, user_id: user.id });
      setBookmarked(true);
      toast({ title: "Complaint bookmarked" });
    }
  };

  const handleEscalate = async () => {
    if (!id || escalationReason.trim().length < 3) {
      toast({ title: "Reason required", description: "Please provide a reason (3+ chars).", variant: "destructive" });
      return;
    }
    setEscalating(true);
    const { error } = await supabase.rpc("escalate_complaint", { _complaint_id: id, _reason: escalationReason.trim() });
    if (error) {
      toast({ title: "Escalation failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escalated to HOD", description: "The Head of Department has been notified." });
      setShowEscalateDialog(false);
      setEscalationReason("");
      fetchData();
    }
    setEscalating(false);
  };


  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!complaint) return <div className="py-12 text-center text-muted-foreground">Complaint not found.</div>;

  const isOwner = user?.id === complaint.user_id;
  const showFeedback = isOwner && complaint.status === "resolved";
  const canReopen = isOwner && complaint.status === "resolved" && feedback === false;

  const resolvedAt = (complaint as unknown as { resolved_at: string | null }).resolved_at;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const msSinceResolved = resolvedAt ? Date.now() - new Date(resolvedAt).getTime() : 0;
  const canStudentDelete = isOwner && complaint.status === "resolved" && resolvedAt !== null && msSinceResolved >= weekMs;
  const daysUntilDeletable = resolvedAt && msSinceResolved < weekMs
    ? Math.ceil((weekMs - msSinceResolved) / (24 * 60 * 60 * 1000))
    : 0;

  const handleDelete = async () => {
    if (!complaint) return;
    setDeleting(true);
    const { error } = await supabase.from("complaints").delete().eq("id", complaint.id);
    if (error) {
      toast({ title: "Unable to delete", description: error.message, variant: "destructive" });
      setDeleting(false);
    } else {
      toast({ title: "Complaint deleted" });
      navigate(isAdmin ? "/admin/complaints" : "/");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {isAdmin && <AdminBreadcrumb />}
      <div className="flex items-center justify-between">
        {isAdmin ? (
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/complaints")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Complaints
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          <ComplaintPdfExport complaint={complaint} responses={responses} />
          {!isAdmin && (
            <Button variant="ghost" size="icon" onClick={toggleBookmark} className="h-8 w-8">
              {bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

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
          {/* Admin: full student details */}
          {isAdmin && <StudentDetailCard userId={complaint.user_id} isAnonymous={complaint.is_anonymous} />}

          {/* Anonymous badge for students */}
          {!isAdmin && complaint.is_anonymous && (
            <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/40 p-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              This complaint was submitted anonymously
            </div>
          )}

          {/* Info row: estimated time, last updated, assigned admin */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b pb-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Est. resolution: {estimatedResolutionLabel(complaint.estimated_resolution_hours)}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Updated {timeAgo(complaint.updated_at)}
            </span>
            {assignedAdmin && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Assigned to: {assignedAdmin}
              </span>
            )}
          </div>

          <p className="whitespace-pre-wrap text-sm">{complaint.description}</p>
          {complaint.attachment_url && (
            <AttachmentPreview attachmentUrl={complaint.attachment_url} />
          )}
        </CardContent>
      </Card>

      {/* Quick Suggestions for Admins */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Quick Suggestions
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={generateAiSummary}
              disabled={generatingSummary}
            >
              <RefreshCw className={`h-3 w-3 ${generatingSummary ? "animate-spin" : ""}`} />
              {aiSummary ? "Regenerate" : "Generate"}
            </Button>
          </CardHeader>
          <CardContent>
            {aiSummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {generatingSummary ? "Generating suggestions..." : "No suggestions yet. Click Generate to create one."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feedback prompt for students on resolved complaints */}
      {showFeedback && (
        <FeedbackPrompt
          complaintId={complaint.id}
          existingFeedback={feedback}
          onFeedbackSubmitted={fetchData}
        />
      )}

      {/* Reopen button */}
      {canReopen && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">Not satisfied? You can reopen this complaint.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReopen} disabled={transitioning}>
              <RotateCcw className="h-4 w-4" /> Reopen Complaint
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Student delete (available 7 days after resolution) */}
      {isOwner && complaint.status === "resolved" && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            {canStudentDelete ? (
              <>
                <p className="text-sm text-muted-foreground">This complaint was resolved over a week ago. You can permanently delete it.</p>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                  <Trash2 className="h-4 w-4" /> {deleting ? "Deleting..." : "Delete"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                You'll be able to delete this complaint in {daysUntilDeletable} day{daysUntilDeletable === 1 ? "" : "s"}.
              </p>
            )}
            <ConfirmDialog
              open={showDeleteConfirm}
              onOpenChange={setShowDeleteConfirm}
              title="Delete Complaint"
              description="This will permanently remove the complaint and all its responses, activity, and bookmarks. This action cannot be undone."
              confirmLabel="Delete"
              onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
            />
          </CardContent>
        </Card>
      )}



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
            <Button size="sm" onClick={() => setShowStatusConfirm(true)} disabled={transitioning}>
              {transitioning ? "Updating..." : transitionLabels[nextStatus] || "Advance"}
            </Button>
            <ConfirmDialog
              open={showStatusConfirm}
              onOpenChange={setShowStatusConfirm}
              title="Change Complaint Status"
              description={`Are you sure you want to change the status from "${statusConfig[complaint.status]?.label}" to "${statusConfig[nextStatus]?.label}"? This action will be logged and the student will be notified.`}
              confirmLabel={transitionLabels[nextStatus] || "Advance"}
              onConfirm={() => { setShowStatusConfirm(false); handleTransition(); }}
            />
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
                  <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
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
