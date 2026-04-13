import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ComplaintWithProfile } from "@/pages/AdminDashboard";

interface ExportButtonsProps {
  complaints: ComplaintWithProfile[];
}

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administrative: "Administrative",
  other: "Other",
};

function toRows(complaints: ComplaintWithProfile[]) {
  return complaints.map((c) => ({
    "Reference ID": c.reference_id || "—",
    "Student Name": c.profiles?.full_name || c.profiles?.display_name || "Unknown",
    "Student ID": c.profiles?.student_id || "—",
    Category: categoryLabels[c.category] || c.category,
    Priority: c.priority,
    Status: c.status,
    "Date Submitted": new Date(c.created_at).toLocaleDateString(),
  }));
}

function exportCSV(complaints: ComplaintWithProfile[]) {
  const rows = toRows(complaints);
  if (!rows.length) { toast({ title: "No data to export" }); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${(r as Record<string, string>)[h]}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast({ title: "CSV exported" });
}

async function exportPDF(complaints: ComplaintWithProfile[]) {
  const rows = toRows(complaints);
  if (!rows.length) { toast({ title: "No data to export" }); return; }
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Complaints Report", 14, 18);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);

  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => (r as Record<string, string>)[h]));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 30,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 40, 49] },
  });
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complaints-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast({ title: "PDF exported" });
}

export default function ExportButtons({ complaints }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => exportCSV(complaints)}>
        <Download className="h-4 w-4 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportPDF(complaints)}>
        <Download className="h-4 w-4 mr-1" /> PDF
      </Button>
    </div>
  );
}
