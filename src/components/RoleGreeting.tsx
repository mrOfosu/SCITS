import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  Landmark,
  UserCog,
} from "lucide-react";

const ROLE_META: Record<
  AppRole,
  { label: string; short: string; icon: React.ComponentType<{ className?: string }> }
> = {
  super_admin: { label: "Super Admin", short: "Super Admin", icon: ShieldCheck },
  admin: { label: "Administrator", short: "Admin", icon: ShieldCheck },
  faculty_admin: { label: "Faculty Head", short: "Faculty", icon: Landmark },
  hod: { label: "Head of Department", short: "HOD", icon: UserCog },
  department_admin: { label: "Department Admin", short: "Department", icon: Building2 },
  student: { label: "Student", short: "Student", icon: GraduationCap },
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border bg-card p-4 shadow-elevation-sm"
    >
      <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
            {timeOfDayGreeting()}, {name}
          </h2>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-medium">
            {meta.short}
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
          {meta.label}
          {position ? ` · ${position}` : ""}
          {contextBits.length ? ` · ${contextBits.join(" · ")}` : ""}
        </p>
      </div>
    </motion.div>
  );
}
