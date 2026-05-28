import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  Landmark,
  UserCog,
  User as UserIcon,
} from "lucide-react";

const ROLE_META: Record<
  AppRole,
  { label: string; short: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  super_admin: { label: "Super Admin", short: "Super Admin", icon: ShieldCheck, tone: "bg-primary/10 text-primary" },
  admin: { label: "Administrator", short: "Admin", icon: ShieldCheck, tone: "bg-primary/10 text-primary" },
  faculty_admin: { label: "Faculty Head", short: "Faculty", icon: Landmark, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  hod: { label: "Head of Department", short: "HOD", icon: UserCog, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  department_admin: { label: "Department Admin", short: "Department", icon: Building2, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  student: { label: "Student", short: "Student", icon: GraduationCap, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function RoleGreeting() {
  const { user, role } = useAuth();
  const { profile } = useProfile();
  const [facultyName, setFacultyName] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (profile?.faculty_id) {
        const { data } = await supabase
          .from("faculties")
          .select("faculty_name")
          .eq("id", profile.faculty_id)
          .maybeSingle();
        if (!cancelled) setFacultyName(data?.faculty_name ?? null);
      } else {
        setFacultyName(null);
      }
      if (profile?.department_id) {
        const { data } = await supabase
          .from("departments")
          .select("department_name")
          .eq("id", profile.department_id)
          .maybeSingle();
        if (!cancelled) setDepartmentName(data?.department_name ?? null);
      } else {
        setDepartmentName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.faculty_id, profile?.department_id]);

  if (!user) return null;

  const meta = ROLE_META[role];
  const Icon = meta.icon;
  const name = profile?.full_name || profile?.display_name || user.email?.split("@")[0] || "there";
  const position = profile?.staff_position;

  const contextBits: string[] = [];
  if (role === "faculty_admin" && facultyName) contextBits.push(facultyName);
  if ((role === "hod" || role === "department_admin") && departmentName) {
    contextBits.push(departmentName);
    if (facultyName) contextBits.push(facultyName);
  }
  if (role === "student") {
    if (profile?.programme) contextBits.push(profile.programme);
    else if (departmentName) contextBits.push(departmentName);
  }

  return (
    <Card className="border-l-4 border-l-primary animate-fade-in">
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-semibold truncate">
              {timeOfDayGreeting()}, {name}
            </h2>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {meta.short}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {meta.label}
            {position ? ` · ${position}` : ""}
            {contextBits.length ? ` · ${contextBits.join(" · ")}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
