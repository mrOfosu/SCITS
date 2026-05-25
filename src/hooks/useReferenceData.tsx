import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Faculty { id: string; faculty_name: string; faculty_code: string; }
export interface Department { id: string; faculty_id: string; department_name: string; department_code: string; }
export interface ComplaintCategory { id: string; name: string; code: string; }
export interface ComplaintType {
  id: string;
  category_id: string;
  name: string;
  code: string;
  default_priority: "low" | "medium" | "high" | "critical";
  default_department_code: string | null;
}

export function useReferenceData() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [types, setTypes] = useState<ComplaintType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [f, d, c, t] = await Promise.all([
        supabase.from("faculties").select("*").order("faculty_name"),
        supabase.from("departments").select("*").order("department_name"),
        supabase.from("complaint_categories").select("*").order("name"),
        supabase.from("complaint_types").select("*").order("name"),
      ]);
      if (cancelled) return;
      setFaculties((f.data as Faculty[]) || []);
      setDepartments((d.data as Department[]) || []);
      setCategories((c.data as ComplaintCategory[]) || []);
      setTypes((t.data as ComplaintType[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { faculties, departments, categories, types, loading };
}
