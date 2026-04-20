import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle2, XCircle, FileText, AlertTriangle, Timer } from "lucide-react";

interface StatsCardsProps {
  counts: { total: number; pending: number; in_review: number; resolved: number; closed: number; overdue: number };
  avgResolutionDays: number | null;
}

export default function StatsCards({ counts, avgResolutionDays }: StatsCardsProps) {
  const stats = [
    { label: "Total", value: counts.total, icon: FileText, color: "text-foreground" },
    { label: "Pending", value: counts.pending, icon: AlertCircle, color: "text-destructive" },
    { label: "In Review", value: counts.in_review, icon: Clock, color: "text-primary" },
    { label: "Resolved", value: counts.resolved, icon: CheckCircle2, color: "text-muted-foreground" },
    { label: "Closed", value: counts.closed, icon: XCircle, color: "text-muted-foreground/50" },
    { label: "Overdue", value: counts.overdue, icon: AlertTriangle, color: "text-destructive" },
    { label: "Avg Resolution", value: avgResolutionDays !== null ? `${avgResolutionDays}d` : "—", icon: Timer, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4">
            <s.icon className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 ${s.color}`} />
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold truncate">{s.value}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
