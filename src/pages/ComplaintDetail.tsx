import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Paperclip, ExternalLink } from "lucide-react";
import AttachmentPreview from "@/components/AttachmentPreview";
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

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [complaint, setComplaint] = useState<Tables<"complaints"> | null>(null);
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newStatus, setNewStatus] = useState<ComplaintStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    const { data: comp } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
    setComplaint(comp);
    setNewStatus(comp?.status || "");

    const { data: resp } = await supabase
      .from("complaint_responses")
      .select("id, message, created_at, responder_id")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    // Fetch responder names separately since there's no FK
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
    setLoading(false);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSendResponse = async () => {
    if (!user || !id || !newMessage.trim()) return;
    setSending(true);

    if (isAdmin && newStatus && newStatus !== complaint?.status) {
      await supabase.from("complaints").update({ status: newStatus as ComplaintStatus }).eq("id", id);
    }

    const { error } = await supabase.from("complaint_responses").insert({
      complaint_id: id,
      responder_id: user.id,
      message: newMessage,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Response sent" });
      setNewMessage("");
      fetchData();
    }
    setSending(false);
  };

  const handleStatusUpdate = async () => {
    if (!isAdmin || !id || !newStatus) return;
    setSending(true);
    const { error } = await supabase.from("complaints").update({ status: newStatus as ComplaintStatus }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status updated" });
      fetchData();
    }
    setSending(false);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!complaint) return <div className="py-12 text-center text-muted-foreground">Complaint not found.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
              <Badge variant={statusConfig[complaint.status].variant}>
                {statusConfig[complaint.status].label}
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

      {/* Admin status controls */}
      {isAdmin && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-sm font-medium">Update Status:</span>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ComplaintStatus)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleStatusUpdate} disabled={sending || newStatus === complaint.status}>
              Save
            </Button>
          </CardContent>
        </Card>
      )}

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
