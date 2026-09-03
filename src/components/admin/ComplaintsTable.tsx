import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Paperclip, AlertTriangle } from "lucide-react";
import type { ComplaintWithProfile } from "@/pages/AdminDashboard";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
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

interface ComplaintsTableProps {
  complaints: ComplaintWithProfile[];
}

const OVERDUE_DAYS = 7;

function isOverdue(complaint: ComplaintWithProfile) {
  if (complaint.status === "resolved" || complaint.status === "closed") return false;
  const created = new Date(complaint.created_at);
  return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) > OVERDUE_DAYS;
}

export default function ComplaintsTable({ complaints }: ComplaintsTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No complaints found.
              </TableCell>
            </TableRow>
          ) : (
            complaints.map((c) => {
              const overdue = isOverdue(c);
              return (
              <TableRow key={c.id} className={overdue ? "bg-destructive/5 border-l-2 border-l-destructive" : ""}>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    {c.reference_id || "—"}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {c.subject}
                    {c.attachment_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                    {overdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{c.profiles?.full_name || c.profiles?.display_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{c.profiles?.student_id || "—"}</p>
                  </div>
                </TableCell>
                <TableCell>{categoryLabels[c.category] || c.category}</TableCell>
                <TableCell>
                  <Badge variant={priorityConfig[c.priority]?.variant || "outline"}>
                    {priorityConfig[c.priority]?.label || c.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[c.status]?.variant || "outline"}>
                    {statusConfig[c.status]?.label || c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Link to={`/admin/complaint/${c.id}`}>
                    <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
