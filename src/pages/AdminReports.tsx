import { useEffect, useState, useMemo } from "react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Export and analyze complaint data</p>
        </div>
        <ExportButtons complaints={complaints} />
      </div>
      <AdminCharts complaints={complaints} />
    </div>
  );
}
