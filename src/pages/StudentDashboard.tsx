import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StudentChatbot from "@/components/StudentChatbot";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Eye, Paperclip } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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

export default function StudentDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Tables<"complaints">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("complaints")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setComplaints(data || []);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Complaints</h1>
          <p className="text-muted-foreground">Track and manage your submitted complaints</p>
        </div>
        <Link to="/submit">
          <Button className="gap-1.5">
            <PlusCircle className="h-4 w-4" /> New Complaint
          </Button>
        </Link>
      </div>

      {complaints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>You haven't submitted any complaints yet.</p>
            <Link to="/submit">
              <Button variant="outline" className="mt-4">Submit your first complaint</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <Link key={c.id} to={`/complaint/${c.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.subject}</p>
                      {c.attachment_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{c.reference_id}</span>
                      <span>·</span>
                      <span>{categoryLabels[c.category]}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityConfig[c.priority]?.variant || "outline"}>
                      {priorityConfig[c.priority]?.label || c.priority}
                    </Badge>
                    <Badge variant={statusConfig[c.status].variant}>
                      {statusConfig[c.status].label}
                    </Badge>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <StudentChatbot />
    </div>
  );
}
