import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
    { label: "In Review", value: counts.in_review, icon: Clock, color: "text-foreground", to: "/admin/complaints?status=in_review" },
    { label: "Resolved", value: counts.resolved, icon: CheckCircle2, color: "text-muted-foreground", to: "/admin/complaints?status=resolved" },
    { label: "Closed", value: counts.closed, icon: XCircle, color: "text-muted-foreground/50", to: "/admin/complaints?status=closed" },
    { label: "Rejected", value: counts.rejected ?? 0, icon: Ban, color: "text-destructive", to: "/admin/complaints?status=rejected" },
    { label: "Overdue", value: counts.overdue, icon: AlertTriangle, color: "text-destructive", to: "/admin/complaints?status=overdue" },
    { label: "Avg Resolution", value: avgResolutionDays !== null ? `${avgResolutionDays}d` : "—", icon: Timer, color: "text-foreground", to: "/admin/reports" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.04, 0.28) }}
        >
          <Card className="shadow-elevation-sm hover:shadow-elevation-md transition-shadow duration-200">
            <CardContent className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/60">
                <s.icon className={`h-4 w-4 shrink-0 ${s.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl font-semibold tracking-tight tabular-nums leading-tight">{s.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug break-words">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
