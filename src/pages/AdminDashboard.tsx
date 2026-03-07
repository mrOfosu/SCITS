import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import StatsCards from "@/components/admin/StatsCards";
import AdminCharts from "@/components/admin/AdminCharts";
import AdminFilters, { type Filters, defaultFilters } from "@/components/admin/AdminFilters";
import ComplaintsTable from "@/components/admin/ComplaintsTable";
import ExportButtons from "@/components/admin/ExportButtons";

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

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState<ComplaintWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);

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

  const departments = useMemo(() => {
    const set = new Set<string>();
    complaints.forEach((c) => { if (c.profiles?.department) set.add(c.profiles.department); });
    return Array.from(set).sort();
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (filters.status !== "all" && c.status !== filters.status) return false;
      if (filters.category !== "all" && c.category !== filters.category) return false;
      if (filters.priority !== "all" && c.priority !== filters.priority) return false;
      if (filters.department !== "all" && c.profiles?.department !== filters.department) return false;
      if (filters.dateFrom && new Date(c.created_at) < filters.dateFrom) return false;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(c.created_at) > end) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          c.subject.toLowerCase().includes(q) ||
          c.reference_id?.toLowerCase().includes(q) ||
          c.profiles?.full_name?.toLowerCase().includes(q) ||
          c.profiles?.display_name?.toLowerCase().includes(q) ||
          c.profiles?.student_id?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [complaints, filters]);

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

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage and respond to student complaints</p>
        </div>
        <ExportButtons complaints={filtered} />
      </div>

      <StatsCards counts={counts} avgResolutionDays={avgResolutionDays} />

      <AdminCharts complaints={filtered} />

      <AdminFilters filters={filters} onChange={setFilters} departments={departments} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} complaint{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <ComplaintsTable complaints={filtered} />
    </div>
  );
}
