import { useState } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface ComplaintPdfExportProps {
  complaint: Tables<"complaints">;
  responses: { message: string; created_at: string; profiles: { display_name: string } | null }[];
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

const pdfSafeText = (value: string) =>
  value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[…]/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );

  window.setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 60_000);

  return blobUrl;
};

const triggerTopLevelDownload = (targetWindow: Window, blob: Blob, filename: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const doc = targetWindow.document;

  doc.open();
  doc.write(`<!doctype html><html><head><title>Preparing PDF</title></head><body style="font-family: Arial, sans-serif; padding: 24px;"><p>Preparing your PDF download...</p></body></html>`);
  doc.close();

  const link = doc.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.textContent = "Download PDF";
  link.style.display = "none";
  doc.body.appendChild(link);
  targetWindow.focus();
  link.click();

  const fallbackText = doc.createElement("p");
  fallbackText.textContent = "If the download does not start automatically, use the link below.";
  fallbackText.style.marginBottom = "12px";
  doc.body.appendChild(fallbackText);

  const visibleLink = doc.createElement("a");
  visibleLink.href = blobUrl;
  visibleLink.download = filename;
  visibleLink.textContent = `Download ${filename}`;
  visibleLink.style.color = "inherit";
  doc.body.appendChild(visibleLink);

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    if (!targetWindow.closed) {
      targetWindow.close();
    }
  }, 60_000);
};

export default function ComplaintPdfExport({ complaint, responses }: ComplaintPdfExportProps) {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    const previewDownloadWindow = window.self !== window.top ? window.open("", "_blank") : null;
    setExporting(true);

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 20;

      const writeBlock = (label: string, value: string, fontSize = 10) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(`${label}: ${pdfSafeText(value)}`, 180);
        if (y + lines.length * 5 > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, 14, y);
        y += lines.length * 5 + 2;
      };

      doc.setFontSize(18);
      doc.text("Complaint Report", 14, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
      y += 12;

      doc.setTextColor(0);
      writeBlock("Reference", complaint.reference_id || "N/A", 12);
      writeBlock("Subject", complaint.subject, 12);
      writeBlock("Category", complaint.category, 12);
      writeBlock("Priority", complaint.priority, 12);
      writeBlock("Status", complaint.status, 12);
      writeBlock("Created", new Date(complaint.created_at).toLocaleString(), 12);

      y += 4;
      doc.setFontSize(11);
      doc.text("Description:", 14, y);
      y += 6;
      doc.setFontSize(10);
      const descriptionLines = doc.splitTextToSize(pdfSafeText(complaint.description), 180);
      if (y + descriptionLines.length * 5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(descriptionLines, 14, y);
      y += descriptionLines.length * 5 + 8;

      if (responses.length > 0) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(11);
        doc.text("Responses:", 14, y);
        y += 6;
        doc.setFontSize(9);

        for (const response of responses) {
          const author = response.profiles?.display_name || "Unknown";
          const header = pdfSafeText(`${author} - ${new Date(response.created_at).toLocaleString()}`);
          const messageLines = doc.splitTextToSize(pdfSafeText(response.message), 180);
          const requiredHeight = 5 + messageLines.length * 4.5 + 6;

          if (y + requiredHeight > 280) {
            doc.addPage();
            y = 20;
          }

          doc.setTextColor(60);
          doc.text(header, 14, y);
          y += 5;
          doc.setTextColor(0);
          doc.text(messageLines, 14, y);
          y += messageLines.length * 4.5 + 6;
        }
      }

      const pdfBlob = doc.output("blob");
      const filename = `complaint-${complaint.reference_id || complaint.id.slice(0, 8)}.pdf`;
      const pickerWindow = window as SaveFilePickerWindow;

      if (typeof pickerWindow.showSaveFilePicker === "function") {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "PDF Document",
              accept: {
                "application/pdf": [".pdf"],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        previewDownloadWindow?.close();
        toast({ title: "PDF saved" });
        return;
      }

      if (previewDownloadWindow && !previewDownloadWindow.closed) {
        triggerTopLevelDownload(previewDownloadWindow, pdfBlob, filename);
      } else {
        triggerBlobDownload(pdfBlob, filename);
      }

      toast({
        title: "PDF ready",
        description: previewDownloadWindow
          ? "Your PDF download is being handled in a new tab."
          : "Your PDF download has started.",
      });
    } catch (err) {
      previewDownloadWindow?.close();
      console.error("PDF export error:", err);
      toast({
        title: "PDF export failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportPdf} disabled={exporting}>
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export PDF
    </Button>
  );
}
