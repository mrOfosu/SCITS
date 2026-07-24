import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import ExportButtons from "@/components/admin/ExportButtons";
import AdminCharts from "@/components/admin/AdminCharts";
import type { ComplaintWithProfile } from "@/pages/AdminDashboard";

export default function AdminReports() {
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
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-72 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-64 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-64 rounded-lg bg-muted/60 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Export and analyze complaint data</p>
        </div>
        <ExportButtons complaints={complaints} />
      </div>
      <AdminCharts complaints={complaints} />
    </motion.div>
  );
}
