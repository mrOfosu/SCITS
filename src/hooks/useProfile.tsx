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
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data as unknown as Profile | null);
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  return { profile, loading, refetch: fetchProfile };
}
