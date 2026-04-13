import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface ComplaintPdfExportProps {
  complaint: Tables<"complaints">;
  responses: { message: string; created_at: string; profiles: { display_name: string } | null }[];
}

export default function ComplaintPdfExport({ complaint, responses }: ComplaintPdfExportProps) {
  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF() as any;
    let y = 20;

    doc.setFontSize(18);
    doc.text("Complaint Report", 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 12;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Reference: ${complaint.reference_id || "N/A"}`, 14, y); y += 7;
    doc.text(`Subject: ${complaint.subject}`, 14, y); y += 7;
    doc.text(`Category: ${complaint.category}`, 14, y); y += 7;
    doc.text(`Priority: ${complaint.priority}`, 14, y); y += 7;
    doc.text(`Status: ${complaint.status}`, 14, y); y += 7;
    doc.text(`Created: ${new Date(complaint.created_at).toLocaleString()}`, 14, y); y += 10;

    doc.setFontSize(11);
    doc.text("Description:", 14, y); y += 6;
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(complaint.description, 180);
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 8;

    if (responses.length > 0) {
      doc.setFontSize(11);
      doc.text("Responses:", 14, y); y += 6;
      doc.setFontSize(9);
      for (const r of responses) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(60);
        doc.text(`${r.profiles?.display_name || "Unknown"} — ${new Date(r.created_at).toLocaleString()}`, 14, y);
        y += 5;
        doc.setTextColor(0);
        const msgLines = doc.splitTextToSize(r.message, 180);
        doc.text(msgLines, 14, y);
        y += msgLines.length * 4.5 + 6;
      }
    }

    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complaint-${complaint.reference_id || complaint.id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "PDF downloaded" });
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPdf}>
      <Download className="h-4 w-4" /> Export PDF
    </Button>
  );
}
