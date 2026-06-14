import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import KwameChatbot from "@/components/KwameChatbot";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComplaintListSkeleton } from "@/components/ui/skeleton-card";
import { PlusCircle, Eye, Paperclip, BookmarkCheck, Clock } from "lucide-react";
import RoleGreeting from "@/components/RoleGreeting";
import type { Tables } from "@/integrations/supabase/types";
import { timeAgo, estimatedResolutionLabel } from "@/lib/timeUtils";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
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
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "bookmarked">("all");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("complaints").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("complaint_bookmarks").select("complaint_id").eq("user_id", user.id),
    ]).then(([{ data: comp }, { data: bm }]) => {
      setComplaints(comp || []);
      setBookmarkedIds(new Set((bm || []).map((b) => b.complaint_id)));
      setLoading(false);
    });
  }, [user]);

  const displayed = filter === "bookmarked" 
    ? complaints.filter((c) => bookmarkedIds.has(c.id))
    : complaints;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-5 w-80 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-primary/20 rounded animate-pulse" />
        </div>
        <ComplaintListSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-24 sm:pb-6">
      <RoleGreeting />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Complaints</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track and manage your submitted complaints</p>
        </div>
        <Link to="/submit" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto h-11 sm:h-10 gap-1.5 hover:scale-[1.02] transition-transform duration-200 shadow-sm hover:shadow-md">
            <PlusCircle className="h-4 w-4" /> New Complaint
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      {bookmarkedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" className="h-9" onClick={() => setFilter("all")}>
            All ({complaints.length})
          </Button>
          <Button variant={filter === "bookmarked" ? "default" : "outline"} size="sm" className="h-9 gap-1" onClick={() => setFilter("bookmarked")}>
            <BookmarkCheck className="h-3.5 w-3.5" /> Bookmarked ({bookmarkedIds.size})
          </Button>
        </div>
      )}

      {displayed.length === 0 ? (
        <Card className="border-dashed animate-fade-in">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <PlusCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {filter === "bookmarked" ? "No bookmarked complaints" : "No complaints yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {filter === "bookmarked" 
                ? "Bookmark complaints from their detail page to see them here."
                : "You haven't submitted any complaints yet. Start by submitting your first complaint."}
            </p>
            {filter !== "bookmarked" && (
              <Link to="/submit">
                <Button variant="outline" className="hover:scale-105 transition-transform duration-200">
                  Submit your first complaint
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayed.map((c, index) => {
            const hasUpdates = c.has_new_updates;
            const estHours = c.estimated_resolution_hours;
            const isEscalated = ((c as any).escalation_level || 0) >= 1;
            return (
              <Link key={c.id} to={`/complaint/${c.id}`} className="block">
                <Card
                  className={`group transition-all duration-200 hover:shadow-md border hover:border-primary/20 animate-fade-in overflow-hidden ${
                    hasUpdates ? "ring-1 ring-primary/20" : ""
                  } ${isEscalated ? "border-l-4 border-l-amber-500" : ""}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-0">
                    {/* Top bar: status strip */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {hasUpdates && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="New updates" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                          {c.reference_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.attachment_url && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {bookmarkedIds.has(c.id) && (
                          <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                        )}
                        <Badge
                          variant={statusConfig[c.status].variant}
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          {statusConfig[c.status].label}
                        </Badge>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="px-4 pb-1">
                      <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug break-words">
                        {c.subject}
                      </h3>
                    </div>

                    {/* Meta row */}
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <Badge
                        variant={priorityConfig[c.priority]?.variant || "outline"}
                        className="text-[10px] px-1.5 py-0 h-5 font-normal"
                      >
                        {priorityConfig[c.priority]?.label || c.priority} Priority
                      </Badge>
                      <span>{categoryLabels[c.category]}</span>
                      <span className="hidden sm:inline text-border">|</span>
                      <span>{timeAgo(c.updated_at)}</span>
                      {estHours && c.status !== "closed" && c.status !== "resolved" && (
                        <>
                          <span className="hidden sm:inline text-border">|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {estimatedResolutionLabel(estHours)}
                          </span>
                        </>
                      )}
                      {isEscalated && (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0 h-5 font-normal">
                          Escalated
                        </Badge>
                      )}
                    </div>

                    {/* Bottom action hint */}
                    <div className="px-4 py-2.5 bg-muted/30 border-t flex items-center justify-between text-xs text-muted-foreground group-hover:bg-muted/50 transition-colors">
                      <span>Tap to view details</span>
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <KwameChatbot />
    </div>
  );
}
