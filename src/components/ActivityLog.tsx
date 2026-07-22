import { Badge } from "@/components/ui/badge";
import { ArrowRight, History, FileText, MessageSquare, PenLine, Trash2, Plus, TrendingUp } from "lucide-react";

interface ActivityEntry {
  id: string;
  action_type: string;
  performed_by: string;
  performed_role: string;
  old_status: string;
  new_status: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  profiles?: { display_name: string } | null;
}

interface ActivityLogProps {
  activity: ActivityEntry[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

const actionIcons: Record<string, typeof History> = {
  status_change: ArrowRight,
  complaint_created: Plus,
  response_added: MessageSquare,
  complaint_edited: PenLine,
  complaint_deleted: Trash2,
  escalated: TrendingUp,
};

const actionLabels: Record<string, string> = {
  status_change: "Status Changed",
  complaint_created: "Complaint Created",
  response_added: "Response Added",
  complaint_edited: "Complaint Edited",
  complaint_deleted: "Complaint Deleted",
  escalated: "Escalated to HOD",
};

export default function ActivityLog({ activity }: ActivityLogProps) {
  if (activity.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <History className="h-4 w-4" /> Complaint Timeline
      </h3>
      <div className="relative space-y-2">

        {activity.map((a) => {
          const Icon = actionIcons[a.action_type] || FileText;
          const label = actionLabels[a.action_type] || a.action_type;
          const displayName = a.profiles?.display_name || "System";

          return (
            <div key={a.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{displayName}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {a.performed_role}
                  </Badge>
                </div>
                {a.action_type === "status_change" && a.old_status && a.new_status && (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant={statusConfig[a.old_status]?.variant || "outline"} className="text-xs">
                      {statusConfig[a.old_status]?.label || a.old_status}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant={statusConfig[a.new_status]?.variant || "outline"} className="text-xs">
                      {statusConfig[a.new_status]?.label || a.new_status}
                    </Badge>
                  </div>
                )}
                {a.action_type === "response_added" && a.new_value && (
                  <p className="pt-1 text-xs text-muted-foreground italic">
                    "{(a.new_value as Record<string, string>).message_preview}..."
                  </p>
                )}
                {a.action_type === "escalated" && a.new_value && (
                  <p className="pt-1 text-xs text-muted-foreground italic">
                    Reason: {(a.new_value as Record<string, string>).reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ActivityEntry };
