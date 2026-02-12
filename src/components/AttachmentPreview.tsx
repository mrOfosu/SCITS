import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Download } from "lucide-react";

interface AttachmentPreviewProps {
  attachmentUrl: string;
}

function getFileType(path: string): "image" | "pdf" | "unknown" {
  const ext = path.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return "image";
  if (ext === "pdf") return "pdf";
  return "unknown";
}

export default function AttachmentPreview({ attachmentUrl }: AttachmentPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const isPath = !attachmentUrl.startsWith("http");

  useEffect(() => {
    const getUrl = async () => {
      if (!isPath) {
        // Legacy: already a full URL
        setSignedUrl(attachmentUrl);
        setLoading(false);
        return;
      }
      const { data, error: signError } = await supabase.storage
        .from("complaint-attachments")
        .createSignedUrl(attachmentUrl, 3600); // 1 hour
      if (signError || !data?.signedUrl) {
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };
    getUrl();
  }, [attachmentUrl, isPath]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading attachment…</p>;
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        <span>Attachment unavailable</span>
      </div>
    );
  }

  const fileType = getFileType(attachmentUrl);

  return (
    <div className="space-y-2">
      {fileType === "image" && (
        <img
          src={signedUrl}
          alt="Complaint attachment"
          className="max-h-96 rounded-md border object-contain"
          onError={() => setError(true)}
        />
      )}

      {fileType === "pdf" && (
        <iframe
          src={signedUrl}
          title="PDF attachment"
          className="h-[500px] w-full rounded-md border"
          onError={() => setError(true)}
        />
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={downloading}
        onClick={async () => {
          try {
            setDownloading(true);
            const res = await fetch(signedUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const ext = attachmentUrl.split(".").pop() || "file";
            a.download = `attachment.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch {
            setError(true);
          } finally {
            setDownloading(false);
          }
        }}
      >
        <Download className="h-4 w-4" />
        {downloading ? "Downloading..." : "Download Attachment"}
      </Button>
    </div>
  );
}
