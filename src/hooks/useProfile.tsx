import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  level: string | null;
  phone_number: string | null;
  profile_completed: boolean;
  faculty_id: string | null;
  department_id: string | null;
  programme: string | null;
  staff_position: string | null;
  student_index_number: string | null;
}

export function useProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish before doing anything
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setProfile(data as unknown as Profile | null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  const refetch = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data as unknown as Profile | null);
  };

  return { profile, loading, refetch };
}
