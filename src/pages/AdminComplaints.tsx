import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminFilters, { type Filters, defaultFilters } from "@/components/admin/AdminFilters";
import ComplaintsTable from "@/components/admin/ComplaintsTable";
import ExportButtons from "@/components/admin/ExportButtons";
import type { ComplaintWithProfile } from "@/pages/AdminDashboard";

const KNOWN_STATUSES = ["all", "pending", "in_review", "resolved", "closed", "rejected", "overdue"];

export default function AdminComplaints() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";
  const [complaints, setComplaints] = useState<ComplaintWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    ...defaultFilters,
    status: KNOWN_STATUSES.includes(initialStatus) && initialStatus !== "overdue" ? initialStatus : "all",
  });
  const [overdueOnly, setOverdueOnly] = useState(initialStatus === "overdue");

  useEffect(() => {
    const s = searchParams.get("status") || "all";
    setOverdueOnly(s === "overdue");
    setFilters((f) => ({
      ...f,
      status: KNOWN_STATUSES.includes(s) && s !== "overdue" ? s : "all",
    }));
  }, [searchParams]);

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
    const now = Date.now();
    return complaints.filter((c) => {
      if (overdueOnly) {
        if (c.status === "resolved" || c.status === "closed" || c.status === "rejected") return false;
        const ageDays = (now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays <= 7) return false;
      }
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
  }, [complaints, filters, overdueOnly]);

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
        <div className="h-12 bg-muted/60 rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/60 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Complaints</h1>
          <p className="text-muted-foreground">Manage and respond to student complaints</p>
        </div>
        <ExportButtons complaints={filtered} />
      </div>

      <AdminFilters filters={filters} onChange={setFilters} departments={departments} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} complaint{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <ComplaintsTable complaints={filtered} />
    </div>
  );
}
