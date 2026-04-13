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
import type { Tables } from "@/integrations/supabase/types";
import { timeAgo, estimatedResolutionLabel } from "@/lib/timeUtils";

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">My Complaints</h1>
          <p className="text-muted-foreground">Track and manage your submitted complaints</p>
        </div>
        <Link to="/submit">
          <Button className="gap-1.5 hover:scale-105 transition-transform duration-200 shadow-sm hover:shadow-md">
            <PlusCircle className="h-4 w-4" /> New Complaint
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      {bookmarkedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All ({complaints.length})
          </Button>
          <Button variant={filter === "bookmarked" ? "default" : "outline"} size="sm" className="gap-1" onClick={() => setFilter("bookmarked")}>
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
        <div className="space-y-3">
          {displayed.map((c, index) => {
            const hasUpdates = c.has_new_updates;
            const estHours = c.estimated_resolution_hours;
            return (
              <Link key={c.id} to={`/complaint/${c.id}`} className="block">
                <Card className={`group transition-all duration-200 hover:shadow-md hover:scale-[1.01] border hover:border-primary/20 animate-fade-in ${hasUpdates ? "border-l-2 border-l-primary" : ""}`} style={{ animationDelay: `${index * 100}ms` }}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {hasUpdates && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{c.subject}</p>
                        {c.attachment_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary/70 transition-colors" />}
                        {bookmarkedIds.has(c.id) && <BookmarkCheck className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{c.reference_id}</span>
                        <span>·</span>
                        <span>{categoryLabels[c.category]}</span>
                        <span>·</span>
                        <span>{timeAgo(c.updated_at)}</span>
                        {estHours && c.status !== "closed" && c.status !== "resolved" && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {estimatedResolutionLabel(estHours)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant={priorityConfig[c.priority]?.variant || "outline"} className="transition-transform group-hover:scale-105">
                        {priorityConfig[c.priority]?.label || c.priority}
                      </Badge>
                      <Badge variant={statusConfig[c.status].variant} className="transition-transform group-hover:scale-105">
                        {statusConfig[c.status].label}
                      </Badge>
                      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
