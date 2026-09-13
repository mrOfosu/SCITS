import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Search, Star, ThumbsDown, ThumbsUp, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Feedback = { id: string; complaint_id: string; satisfied: boolean; rating: number | null; comment: string | null; created_at: string; user_id: string };
type Complaint = { id: string; reference_id: string | null; subject: string; department_id: string | null; status: string; resolved_by: string | null; current_handler_id: string | null; assigned_admin_id: string | null; created_at: string };

const handlerFor = (complaint?: Complaint) => complaint?.resolved_by ?? complaint?.current_handler_id ?? complaint?.assigned_admin_id ?? null;
const stars = (rating: number | null) => rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "—";

export default function SuperAdminReviews() {
  const { departments } = useReferenceData();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState("all");
  const [admin, setAdmin] = useState("all");
  const [rating, setRating] = useState("all");
  const [date, setDate] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: feedbackRows }, { data: complaintRows }] = await Promise.all([
        supabase.from("complaint_feedback").select("id, complaint_id, user_id, satisfied, rating, comment, created_at").order("created_at", { ascending: false }),
        supabase.from("complaints").select("id, reference_id, subject, department_id, status, resolved_by, current_handler_id, assigned_admin_id, created_at"),
      ]);
      const complaintData = (complaintRows || []) as Complaint[];
      const handlerIds = [...new Set(complaintData.map(handlerFor).filter((id): id is string => Boolean(id)))];
      if (handlerIds.length) {
        const { data: handlerRows } = await supabase.from("profiles").select("id, display_name, full_name").in("id", handlerIds);
        setProfiles(Object.fromEntries((handlerRows || []).map((p) => [p.id, p.full_name || p.display_name])));
      }
      setFeedback((feedbackRows || []) as Feedback[]);
      setComplaints(complaintData);
      setLoading(false);
    };
    load();
    const channel = supabase.channel("super-admin-reviews")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_feedback" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "complaints" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const complaintById = useMemo(() => new Map(complaints.map((complaint) => [complaint.id, complaint])), [complaints]);
  const handlerOptions = useMemo(() => Object.entries(profiles).sort((a, b) => a[1].localeCompare(b[1])), [profiles]);
  const filtered = useMemo(() => feedback.filter((item) => {
    const complaint = complaintById.get(item.complaint_id);
    const handler = handlerFor(complaint);
    if (department !== "all" && complaint?.department_id !== department) return false;
    if (admin !== "all" && handler !== admin) return false;
    if (rating !== "all" && item.rating !== Number(rating)) return false;
    if (date !== "all") {
      const days = Number(date);
      if (Date.now() - new Date(item.created_at).getTime() > days * 86400000) return false;
    }
    const haystack = `${complaint?.reference_id || ""} ${complaint?.subject || ""} ${item.comment || ""} ${profiles[handler || ""] || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [feedback, complaintById, department, admin, rating, date, search, profiles]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const rated = filtered.filter((item) => item.rating !== null);
    const average = rated.length ? rated.reduce((sum, item) => sum + (item.rating || 0), 0) / rated.length : 0;
    return { total, average, positive: filtered.filter((item) => item.satisfied).length, negative: filtered.filter((item) => !item.satisfied).length };
  }, [filtered]);

  const distribution = useMemo(() => [5, 4, 3, 2, 1].map((value) => ({ value, count: filtered.filter((item) => item.rating === value).length })), [filtered]);
  const trends = useMemo(() => {
    const buckets = new Map<string, { total: number; sum: number }>();
    filtered.forEach((item) => {
      const key = item.created_at.slice(0, 7);
      const bucket = buckets.get(key) || { total: 0, sum: 0 };
      bucket.total += 1; bucket.sum += item.rating || 0; buckets.set(key, bucket);
    });
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [filtered]);
  const performance = useMemo(() => handlerOptions.map(([id, name]) => {
    const handled = complaints.filter((complaint) => handlerFor(complaint) === id);
    const reviews = filtered.filter((item) => handlerFor(complaintById.get(item.complaint_id)) === id);
    const avg = reviews.length ? reviews.reduce((sum, item) => sum + (item.rating || 0), 0) / reviews.length : 0;
    const resolved = handled.filter((item) => ["resolved", "closed"].includes(item.status)).length;
    return { id, name, handled: handled.length, reviews: reviews.length, average: avg, resolutionRate: handled.length ? Math.round((resolved / handled.length) * 100) : 0 };
  }).filter((item) => admin === "all" || item.id === admin), [handlerOptions, complaints, filtered, complaintById, admin]);
  const departmentPerformance = useMemo(() => departments.map((item) => {
    const handled = complaints.filter((complaint) => complaint.department_id === item.id);
    const reviews = filtered.filter((feedbackItem) => complaintById.get(feedbackItem.complaint_id)?.department_id === item.id);
    const resolved = handled.filter((complaint) => ["resolved", "closed"].includes(complaint.status)).length;
    const average = reviews.length ? reviews.reduce((sum, feedbackItem) => sum + (feedbackItem.rating || 0), 0) / reviews.length : 0;
    return { id: item.id, name: item.department_name, handled: handled.length, reviews: reviews.length, average, resolutionRate: handled.length ? Math.round((resolved / handled.length) * 100) : 0 };
  }).filter((item) => department === "all" || item.id === department), [departments, complaints, filtered, complaintById, department]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading review performance…</div>;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Reviews & Performance</h1><p className="text-muted-foreground">Student feedback and handling performance across all departments.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric title="Total reviews" value={metrics.total} icon={<MessageSquare className="h-4 w-4" />} />
      <Metric title="Average rating" value={`${metrics.average.toFixed(1)} / 5`} icon={<Star className="h-4 w-4" />} />
      <Metric title="Positive reviews" value={metrics.positive} icon={<ThumbsUp className="h-4 w-4" />} />
      <Metric title="Negative reviews" value={metrics.negative} icon={<ThumbsDown className="h-4 w-4" />} />
    </div>
    <Card><CardContent className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
      <Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}</SelectContent></Select>
      <Select value={admin} onValueChange={setAdmin}><SelectTrigger><SelectValue placeholder="Admin" /></SelectTrigger><SelectContent><SelectItem value="all">All handling admins</SelectItem>{handlerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
      <Select value={rating} onValueChange={setRating}><SelectTrigger><SelectValue placeholder="Rating" /></SelectTrigger><SelectContent><SelectItem value="all">All ratings</SelectItem>{[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}</SelectContent></Select>
      <Select value={date} onValueChange={setDate}><SelectTrigger><SelectValue placeholder="Date" /></SelectTrigger><SelectContent><SelectItem value="all">All dates</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="365">Last year</SelectItem></SelectContent></Select>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews" className="pl-9" /></div>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Rating distribution</CardTitle></CardHeader><CardContent className="space-y-2">{distribution.map(({ value, count }) => <div key={value} className="flex items-center gap-3 text-sm"><span className="w-12">{value} stars</span><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${metrics.total ? (count / metrics.total) * 100 : 0}%` }} /></div><span className="w-6 text-right">{count}</span></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Rating trend</CardTitle></CardHeader><CardContent className="space-y-3">{trends.length ? trends.map(([month, values]) => <div key={month} className="flex justify-between text-sm"><span>{month}</span><span>{(values.sum / values.total).toFixed(1)} / 5 <span className="text-muted-foreground">({values.total} reviews)</span></span></div>) : <p className="text-sm text-muted-foreground">No ratings match the selected filters.</p>}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Performance by admin</CardTitle></CardHeader><CardContent className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Admin</TableHead><TableHead>Complaints handled</TableHead><TableHead>Reviews</TableHead><TableHead>Average rating</TableHead><TableHead>Resolution rate</TableHead></TableRow></TableHeader><TableBody>{performance.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.handled}</TableCell><TableCell>{item.reviews}</TableCell><TableCell>{item.reviews ? `${item.average.toFixed(1)} / 5` : "—"}</TableCell><TableCell>{item.resolutionRate}%</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Performance by department</CardTitle></CardHeader><CardContent className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Complaints handled</TableHead><TableHead>Reviews</TableHead><TableHead>Average rating</TableHead><TableHead>Resolution rate</TableHead></TableRow></TableHeader><TableBody>{departmentPerformance.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.handled}</TableCell><TableCell>{item.reviews}</TableCell><TableCell>{item.reviews ? `${item.average.toFixed(1)} / 5` : "—"}</TableCell><TableCell>{item.resolutionRate}%</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">All reviews</CardTitle></CardHeader><CardContent className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Complaint</TableHead><TableHead>Department</TableHead><TableHead>Handling admin</TableHead><TableHead>Rating</TableHead><TableHead>Feedback</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{filtered.map((item) => { const complaint = complaintById.get(item.complaint_id); const handler = handlerFor(complaint); return <TableRow key={item.id}><TableCell><div className="font-mono text-xs">{complaint?.reference_id || "—"}</div><div className="max-w-48 truncate text-sm">{complaint?.subject || "Complaint unavailable"}</div></TableCell><TableCell>{departments.find((d) => d.id === complaint?.department_id)?.department_name || "—"}</TableCell><TableCell>{profiles[handler || ""] || "Unassigned"}</TableCell><TableCell><span className="text-amber-500">{stars(item.rating)}</span></TableCell><TableCell className="max-w-xs whitespace-normal">{item.comment || <span className="text-muted-foreground">No written feedback</span>}</TableCell><TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell></TableRow>; })}{!filtered.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No reviews match these filters.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>;
}

function Metric({ title, value, icon }: { title: string; value: string | number; icon: ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className="text-primary">{icon}</div></CardContent></Card>;
}
