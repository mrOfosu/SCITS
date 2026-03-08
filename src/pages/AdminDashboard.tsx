import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StatsCards from "@/components/admin/StatsCards";
import AdminCharts from "@/components/admin/AdminCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Download, Bell, Eye } from "lucide-react";

export interface ComplaintWithProfile {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  reference_id: string | null;
  sub_category: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  description: string;
  profiles: { display_name: string; full_name: string | null; student_id: string | null; department: string | null } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administrative: "Administrative",
  other: "Other",
};

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState<ComplaintWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("complaints")
      .select("*, profiles:user_id(display_name, full_name, student_id, department)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setComplaints((data as unknown as ComplaintWithProfile[]) || []);
        setLoading(false);
      });

    // Fire-and-forget: check for overdue complaints and send admin notifications
    supabase.functions.invoke("check-overdue-complaints").then(({ error }) => {
      if (error) console.error("Overdue check failed:", error);
    });
  }, []);

  const counts = useMemo(() => {
    const now = new Date();
    const overdueDays = 7;
    return {
      total: complaints.length,
      pending: complaints.filter((c) => c.status === "pending").length,
      in_review: complaints.filter((c) => c.status === "in_review").length,
      resolved: complaints.filter((c) => c.status === "resolved").length,
      closed: complaints.filter((c) => c.status === "closed").length,
      overdue: complaints.filter((c) => {
        if (c.status === "resolved" || c.status === "closed") return false;
        const created = new Date(c.created_at);
        return (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24) > overdueDays;
      }).length,
    };
  }, [complaints]);

  const avgResolutionDays = useMemo(() => {
    const resolved = complaints.filter((c) => c.status === "resolved" || c.status === "closed");
    if (!resolved.length) return null;
    const totalMs = resolved.reduce((sum, c) => {
      return sum + (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime());
    }, 0);
    return Math.round(totalMs / resolved.length / (1000 * 60 * 60 * 24));
  }, [complaints]);

  const recentComplaints = useMemo(() => complaints.slice(0, 5), [complaints]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of complaint analytics and trends</p>
      </div>

      <StatsCards counts={counts} avgResolutionDays={avgResolutionDays} />

      <AdminCharts complaints={complaints} />

      {/* Recent Complaints */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Complaints</CardTitle>
          <Link to="/admin/complaints">
            <Button variant="outline" size="sm" className="gap-1.5">
              View All Complaints <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentComplaints.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No complaints yet.</p>
          ) : (
            <div className="space-y-3">
              {recentComplaints.map((c) => (
                <Link
                  key={c.id}
                  to={`/admin/complaint/${c.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference_id || "—"}</span>
                      <span className="text-sm font-medium truncate">{c.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{c.profiles?.full_name || c.profiles?.display_name || "Unknown"}</span>
                      <span>·</span>
                      <span>{categoryLabels[c.category] || c.category}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge variant={statusConfig[c.status]?.variant || "outline"} className="shrink-0 ml-2">
                    {statusConfig[c.status]?.label || c.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/complaints">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" /> View Complaints
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Export Reports
              </Button>
            </Link>
            <Link to="/admin/notifications">
              <Button variant="outline" className="gap-2">
                <Bell className="h-4 w-4" /> View Notifications
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
