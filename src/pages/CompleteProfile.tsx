import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { GraduationCap } from "lucide-react";

const levels = ["100", "200", "300", "400", "Postgraduate"];

export default function CompleteProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { faculties, departments, loading: refLoading } = useReferenceData();

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programme, setProgramme] = useState("");
  const [level, setLevel] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const facultyDepartments = useMemo(
    () => departments.filter((d) => d.faculty_id === facultyId),
    [departments, facultyId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const deptName = departments.find((d) => d.id === departmentId)?.department_name ?? null;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        student_index_number: studentId.trim(),
        faculty_id: facultyId,
        department_id: departmentId,
        department: deptName, // keep legacy text field in sync
        programme: programme.trim() || null,
        level,
        phone_number: phoneNumber.trim(),
        display_name: fullName.trim(),
        profile_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile completed!", description: "You can now submit complaints." });
      navigate("/");
    }
    setLoading(false);
  };

  const isValid = fullName.trim() && studentId.trim() && facultyId && departmentId && level && phoneNumber.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>Please fill in your GCTU details to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">Student Index Number</Label>
              <Input id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. 012023456" required />
            </div>

            <div className="space-y-2">
              <Label>Faculty</Label>
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
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
                <SelectTrigger><SelectValue placeholder={facultyId ? "Select department" : "Select faculty first"} /></SelectTrigger>
                <SelectContent>
                  {facultyDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="programme">Programme (optional)</Label>
              <Input id="programme" value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="e.g. BSc Information Technology" />
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 0241234567" required />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !isValid}>
              {loading ? "Saving..." : "Complete Profile"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
