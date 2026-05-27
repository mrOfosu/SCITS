import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "department_admin" | "hod" | "faculty_admin" | "admin" | "super_admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole;
  isAdmin: boolean; // any staff role (gets admin layout)
  isSuperAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: "student",
  isAdmin: false,
  isSuperAdmin: false,
  isLoading: true,
  signOut: async () => {},
});

const STAFF_ROLES: AppRole[] = ["department_admin", "hod", "faculty_admin", "admin", "super_admin"];

function pickHighestRole(roles: string[]): AppRole {
  const order: AppRole[] = ["super_admin", "admin", "faculty_admin", "hod", "department_admin", "student"];
  for (const r of order) if (roles.includes(r)) return r;
  return "student";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>("student");
  const [isLoading, setIsLoading] = useState(true);
  const loadedRoleForUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRole = async (userId: string) => {
      // Avoid re-loading for the same user on every token refresh
      if (loadedRoleForUserRef.current === userId) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        if (!mounted) return;
        if (error) {
          // Don't flip role on transient errors; just mark loading done
          setIsLoading(false);
          return;
        }
        const roles = (data || []).map((r: { role: string }) => r.role);
        setRole(pickHighestRole(roles));
        loadedRoleForUserRef.current = userId;
      } catch {
        // ignore transient errors
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // Defer role loading to avoid deadlocks inside the callback
        setTimeout(() => { if (mounted) void loadRole(s.user.id); }, 0);
      } else {
        loadedRoleForUserRef.current = null;
        setRole("student");
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        void loadRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    }).catch(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  const isAdmin = STAFF_ROLES.includes(role);
  const isSuperAdmin = role === "super_admin" || role === "admin";

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, isAdmin, isSuperAdmin, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
