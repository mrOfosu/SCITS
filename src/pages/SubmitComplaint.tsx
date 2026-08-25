import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Paperclip, X, Bot } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import KwameFormAssistant from "@/components/kwame/KwameFormAssistant";
import SuccessAnimation from "@/components/SuccessAnimation";
import type { Database } from "@/integrations/supabase/types";

type LegacyCategory = Database["public"]["Enums"]["complaint_category"];

const SEMESTERS = ["First Semester", "Second Semester"];

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  // GCTU academic year typically starts in September
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function nextAcademicYear() {
  const [a, b] = currentAcademicYear().split("/").map(Number);
  return `${a + 1}/${b + 1}`;
}

// Map our new main category codes back to the legacy enum so the legacy column stays valid.
const LEGACY_CATEGORY_MAP: Record<string, LegacyCategory> = {
  ACADEMIC: "academic",
  TECHNICAL: "infrastructure",
  ADMIN: "administrative",
  FACILITIES: "other",
};

export default function SubmitComplaint() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { faculties, departments, categories, types, loading: refLoading } = useReferenceData();

  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [semester, setSemester] = useState("First Semester");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-fill from profile
  useEffect(() => {
    if (profile?.faculty_id && !facultyId) setFacultyId(profile.faculty_id as unknown as string);
    if (profile?.department_id && !departmentId) setDepartmentId(profile.department_id as unknown as string);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const facultyDepartments = useMemo(
    () => departments.filter((d) => d.faculty_id === facultyId),
    [departments, facultyId]
  );
  const categoryTypes = useMemo(
    () => types.filter((t) => t.category_id === categoryId),
    [types, categoryId]
  );
  const selectedType = useMemo(() => types.find((t) => t.id === typeId), [types, typeId]);

  const descriptionError = description.length > 0 && description.length < 20;

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
    if (!user || !facultyId || !departmentId || !categoryId || !typeId) return;
    if (description.length < 20) {
      toast({ title: "Description too short", description: "Please provide at least 20 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);

    let attachment_url: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const path = `${user.id}/${uniqueId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("complaint-attachments").upload(path, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      attachment_url = path;
    }

    const categoryCode = categories.find((c) => c.id === categoryId)?.code ?? "";

    const { data: inserted, error } = await supabase.from("complaints").insert({
      user_id: user.id,
      faculty_id: facultyId,
      department_id: departmentId,
      complaint_category_id: categoryId,
      complaint_type_id: typeId,
      academic_year: academicYear,
      semester,
      // Legacy fields for backwards compatibility
      category: LEGACY_CATEGORY_MAP[categoryCode] ?? "other",
      sub_category: selectedType?.name ?? null,
      priority: selectedType?.default_priority ?? "medium",
      subject,
      description,
      attachment_url,
      is_anonymous: isAnonymous,
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setShowSuccess(true);
    if (inserted?.id) {
      supabase.functions.invoke("generate-ai-summary", { body: { complaint_id: inserted.id } })
        .then(({ error: e }) => { if (e) console.error("AI summary failed:", e); });
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <SuccessAnimation show={showSuccess} onComplete={() => navigate("/")} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={showAssistant ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]" : ""}
      >
        <Card className="shadow-elevation-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl tracking-tight">Submit a Complaint</CardTitle>
                <CardDescription>It will be auto-routed to the correct GCTU department.</CardDescription>
              </div>
              {!showAssistant && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs rounded-full shrink-0"
                  onClick={() => setShowAssistant(true)}
                >
                  <Bot className="h-3.5 w-3.5" /> Ask Kwame
                </Button>
              )}
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Routing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Faculty *</Label>
                  <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setDepartmentId(""); }} disabled={refLoading}>
                    <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                    <SelectContent>
                      {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.faculty_code} — {f.faculty_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
                    <SelectTrigger><SelectValue placeholder={facultyId ? "Select department" : "Select faculty first"} /></SelectTrigger>
                    <SelectContent>
                      {facultyDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Main Category *</Label>
                  <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setTypeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Complaint Type *</Label>
                  <Select value={typeId} onValueChange={setTypeId} disabled={!categoryId}>
                    <SelectTrigger><SelectValue placeholder={categoryId ? "Select complaint type" : "Select category first"} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {categoryTypes.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {selectedType && (
                    <p className="text-xs text-muted-foreground">
                      Auto-priority: <span className="capitalize font-medium">{selectedType.default_priority}</span>
                      {selectedType.default_department_code && <> · Routes to <span className="font-mono">{selectedType.default_department_code}</span></>}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Academic Year *</Label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={currentAcademicYear()}>{currentAcademicYear()}</SelectItem>
                      <SelectItem value={nextAcademicYear()}>{nextAcademicYear()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester *</Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 pt-1">Details</p>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" required />
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

              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 pt-1">Attachment &amp; Privacy</p>
              <div className="space-y-2">
                <Label>Attachment <span className="text-xs text-muted-foreground">(PDF or image, max 5MB)</span></Label>
                {file ? (
                  <div className="flex items-center gap-2 rounded-lg border p-2.5 text-sm bg-secondary/40">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setFile(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
                )}
              </div>

              <div className="flex items-center space-x-3 rounded-lg border p-3.5 bg-secondary/40">
                <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(c) => setIsAnonymous(c === true)} />
                <div className="space-y-0.5">
                  <Label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">Submit anonymously</Label>
                  <p className="text-xs text-muted-foreground">Your identity will be hidden from other students. Admins can still see your details.</p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full shadow-elevation-sm hover:shadow-elevation-md transition-shadow duration-200"
                disabled={loading || !facultyId || !departmentId || !categoryId || !typeId || description.length < 20}
              >
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
                  category={categories.find((c) => c.id === categoryId)?.code.toLowerCase() ?? ""}
                  description={description}
                  subject={subject}
                  onClose={() => setShowAssistant(false)}
                />
              </div>
            </div>
            <div className="fixed inset-4 z-50 lg:hidden">
              <KwameFormAssistant
                category={categories.find((c) => c.id === categoryId)?.code.toLowerCase() ?? ""}
                description={description}
                subject={subject}
                onClose={() => setShowAssistant(false)}
              />
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
