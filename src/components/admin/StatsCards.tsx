import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle2, XCircle, FileText, AlertTriangle, Timer, Ban } from "lucide-react";

interface StatsCardsProps {
  counts: { total: number; pending: number; in_review: number; resolved: number; closed: number; overdue: number; rejected?: number };
  avgResolutionDays: number | null;
}

export default function StatsCards({ counts, avgResolutionDays }: StatsCardsProps) {
  const stats = [
    { label: "Total", value: counts.total, icon: FileText, color: "text-foreground", to: "/admin/complaints?status=all" },
    { label: "Pending", value: counts.pending, icon: AlertCircle, color: "text-destructive", to: "/admin/complaints?status=pending" },
    { label: "In Review", value: counts.in_review, icon: Clock, color: "text-primary", to: "/admin/complaints?status=in_review" },
    { label: "Resolved", value: counts.resolved, icon: CheckCircle2, color: "text-muted-foreground", to: "/admin/complaints?status=resolved" },
    { label: "Closed", value: counts.closed, icon: XCircle, color: "text-muted-foreground/50", to: "/admin/complaints?status=closed" },
    { label: "Rejected", value: counts.rejected ?? 0, icon: Ban, color: "text-destructive", to: "/admin/complaints?status=rejected" },
    { label: "Overdue", value: counts.overdue, icon: AlertTriangle, color: "text-destructive", to: "/admin/complaints?status=overdue" },
    { label: "Avg Resolution", value: avgResolutionDays !== null ? `${avgResolutionDays}d` : "—", icon: Timer, color: "text-primary", to: "/admin/reports" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.to}
          className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label={`View ${s.label}`}
        >
          <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 group-active:scale-[0.98]">
            <CardContent className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4">
              <s.icon className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 ${s.color}`} />
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold truncate">{s.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
