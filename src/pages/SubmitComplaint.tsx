import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Paperclip, X, Bot, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import KwameFormAssistant from "@/components/kwame/KwameFormAssistant";
import SuccessAnimation from "@/components/SuccessAnimation";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Enums"]["complaint_category"];
type Priority = Database["public"]["Enums"]["complaint_priority"];

const subCategories: Record<string, string[]> = {
  academic: ["Grading", "Course Content", "Faculty", "Examination", "Timetable"],
  infrastructure: ["Hostel", "Classroom", "Laboratory", "Library", "Sports Facility"],
  administrative: ["Registration", "Fees", "Documentation", "ID Card", "Scholarship"],
  other: ["General", "Suggestion", "Feedback"],
};

interface SimilarComplaint {
  id: string;
  subject: string;
  reference_id: string | null;
  status: string;
}

export default function SubmitComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | "">("");
  const [subCategory, setSubCategory] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [similarComplaints, setSimilarComplaints] = useState<SimilarComplaint[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const duplicateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const descriptionError = description.length > 0 && description.length < 20;

  // Duplicate detection: search for similar complaints when subject changes
  const checkDuplicates = useCallback(async (subjectText: string) => {
    if (!user || subjectText.length < 5) {
      setSimilarComplaints([]);
      return;
    }
    const words = subjectText.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    if (words.length === 0) { setSimilarComplaints([]); return; }
    
    const { data } = await supabase
      .from("complaints")
      .select("id, subject, reference_id, status")
      .eq("user_id", user.id)
      .or(words.map(w => `subject.ilike.%${w}%`).join(","))
      .limit(3);
    
    setSimilarComplaints((data || []).filter(c => c.subject.toLowerCase() !== subjectText.toLowerCase()));
  }, [user]);

  const handleSubjectChange = (val: string) => {
    setSubject(val);
    if (duplicateTimer.current) clearTimeout(duplicateTimer.current);
    duplicateTimer.current = setTimeout(() => checkDuplicates(val), 500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(selected.type)) {
      toast({ title: "Invalid file", description: "Only PDF, JPEG, PNG, and WebP files are allowed.", variant: "destructive" });
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !category || !priority) return;
    if (description.length < 20) {
      toast({ title: "Description too short", description: "Please provide at least 20 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);

    let attachment_url: string | null = null;

    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-attachments")
        .upload(path, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      attachment_url = path;
    }

    const { data: inserted, error } = await supabase.from("complaints").insert({
      user_id: user.id,
      category: category as Category,
      priority: priority as Priority,
      sub_category: subCategory || null,
      subject,
      description,
      attachment_url,
      is_anonymous: isAnonymous,
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Show success animation
      setShowSuccess(true);
      if (inserted?.id) {
        supabase.functions.invoke("generate-ai-summary", {
          body: { complaint_id: inserted.id },
        }).then(({ error: sumErr }) => {
          if (sumErr) console.error("AI summary generation failed:", sumErr);
        });
        supabase.functions.invoke("notify-new-complaint", {
          body: { complaint_id: inserted.id },
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error("Admin notification failed:", notifErr);
        });
        try {
          const savedPrefs = localStorage.getItem("system-preferences");
          const prefs = savedPrefs ? JSON.parse(savedPrefs) : {};
          if (prefs.autoAssign) {
            supabase.functions.invoke("auto-assign-complaint", {
              body: { complaint_id: inserted.id },
            }).then(({ error: assignErr }) => {
              if (assignErr) console.error("Auto-assign failed:", assignErr);
            });
          }
        } catch {}
      }
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <SuccessAnimation show={showSuccess} onComplete={() => navigate("/")} />
      <div className={showAssistant ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]" : ""}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Submit a Complaint</CardTitle>
                <CardDescription>Describe your issue and we'll route it to the right team.</CardDescription>
              </div>
              {!showAssistant && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAssistant(true)}>
                  <Bot className="h-3.5 w-3.5" /> Ask Kwame
                </Button>
              )}
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={(v) => { setCategory(v as Category); setSubCategory(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="administrative">Administrative</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {category && subCategories[category] && (
                <div className="space-y-2">
                  <Label>Sub-category</Label>
                  <Select value={subCategory} onValueChange={setSubCategory}>
                    <SelectTrigger><SelectValue placeholder="Select sub-category (optional)" /></SelectTrigger>
                    <SelectContent>
                      {subCategories[category].map((sc) => (
                        <SelectItem key={sc} value={sc.toLowerCase()}>{sc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input id="subject" value={subject} onChange={(e) => handleSubjectChange(e.target.value)} placeholder="Brief summary of your issue" required />
                {/* Duplicate detection */}
                {similarComplaints.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Similar complaints found
                    </div>
                    <ul className="space-y-1">
                      {similarComplaints.map((sc) => (
                        <li key={sc.id} className="text-xs text-amber-700 dark:text-amber-400">
                          <span className="font-mono">{sc.reference_id}</span> — {sc.subject} ({sc.status})
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">Consider viewing these before submitting a new complaint.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description * <span className="text-xs text-muted-foreground">(min 20 characters)</span></Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about your complaint..."
                  rows={5}
                  required
                  className={descriptionError ? "border-destructive" : ""}
                />
                {descriptionError && (
                  <p className="text-xs text-destructive">Description must be at least 20 characters ({description.length}/20)</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Attachment <span className="text-xs text-muted-foreground">(PDF or image, max 5MB)</span></Label>
                {file ? (
                  <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || !category || !priority || description.length < 20}>
@@
              <Label>Attachment <span className="text-xs text-muted-foreground">(PDF or image, max 5MB)</span></Label>
                {loading ? "Submitting..." : "Submit Complaint"}
              </Button>
            </CardContent>
          </form>
        </Card>

        {showAssistant && (
          <>
            <div className="hidden lg:block">
              <div className="sticky top-4 h-[calc(100vh-8rem)]">
                <KwameFormAssistant
                  category={category}
                  description={description}
                  subject={subject}
                  onClose={() => setShowAssistant(false)}
                />
              </div>
            </div>
            <div className="fixed inset-4 z-50 lg:hidden">
              <KwameFormAssistant
                category={category}
                description={description}
                subject={subject}
                onClose={() => setShowAssistant(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
