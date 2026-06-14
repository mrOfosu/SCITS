import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StatsCards from "@/components/admin/StatsCards";
import AdminCharts from "@/components/admin/AdminCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Download, Bell, Eye, AlertTriangle } from "lucide-react";
import RoleGreeting from "@/components/RoleGreeting";
import { useAuth } from "@/hooks/useAuth";

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
  rejected: { label: "Rejected", variant: "destructive" },
};

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administrative: "Administrative",
  other: "Other",
};

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      supabase
        .from("complaints")
        .select("*, profiles:user_id(display_name, full_name, student_id, department)")
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setComplaints((data as unknown as ComplaintWithProfile[]) || []);
          setLoading(false);
        });
    load();

    // Fire-and-forget: check for overdue complaints and send admin notifications
    supabase.functions.invoke("check-overdue-complaints").then(({ error }) => {
      if (error) console.error("Overdue check failed:", error);
    });

    // Realtime: refresh on any complaint change (insert/update/delete)
    const channel = supabase
      .channel("admin-dashboard-complaints")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "complaint_escalations" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => {
    const now = new Date();
    const overdueDays = 7;
    return {
      total: complaints.length,
      pending: complaints.filter((c) => c.status === "pending").length,
      in_review: complaints.filter((c) => c.status === "in_review").length,
      resolved: complaints.filter((c) => c.status === "resolved" || c.status === "closed").length,
      closed: complaints.filter((c) => c.status === "closed").length,
      rejected: complaints.filter((c) => c.status === "rejected").length,
      overdue: complaints.filter((c) => {
        if (c.status === "resolved" || c.status === "closed" || c.status === "rejected") return false;
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

  if (loading) {
    return (
      <div className="space-y-5 sm:space-y-6 animate-fade-in">
        <div className="h-16 rounded-lg bg-muted/60 animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-64 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-64 rounded-lg bg-muted/60 animate-pulse" />
        </div>
        <div className="h-48 rounded-lg bg-muted/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <RoleGreeting />
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Overview of complaint analytics and trends</p>
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
              {recentComplaints.map((c) => {
                const isOverdue =
                  c.status !== "resolved" &&
                  c.status !== "closed" &&
                  (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24) > 7;
                return (
                <Link
                  key={c.id}
                  to={`/admin/complaint/${c.id}`}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${isOverdue ? "border-l-2 border-l-destructive bg-destructive/5" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start sm:items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{c.reference_id || "—"}</span>
                      <span className="text-sm font-medium break-words flex-1 min-w-0">{c.subject}</span>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Overdue</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate max-w-[140px] sm:max-w-none">{c.profiles?.full_name || c.profiles?.display_name || "Unknown"}</span>
                      <span>·</span>
                      <span>{categoryLabels[c.category] || c.category}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge variant={statusConfig[c.status]?.variant || "outline"} className="shrink-0 self-start sm:self-center sm:ml-2">
                    {statusConfig[c.status]?.label || c.status}
                  </Badge>
                </Link>
                );
              })}
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
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            <Link to="/admin/complaints" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-10 gap-2">
                <FileText className="h-4 w-4" /> View Complaints
              </Button>
            </Link>
            <Link to="/admin/reports" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-10 gap-2">
                <Download className="h-4 w-4" /> Export Reports
              </Button>
            </Link>
            <Link to="/admin/notifications" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-10 gap-2">
                <Bell className="h-4 w-4" /> View Notifications
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
