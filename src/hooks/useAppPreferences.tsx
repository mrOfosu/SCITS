import { useEffect } from "react";

const ACCENT_COLORS: Record<string, string> = {
  blue: "221 83% 53%",
  green: "142 71% 45%",
  purple: "262 83% 58%",
  orange: "24 95% 53%",
  rose: "346 77% 50%",
};

/** Build a user-scoped localStorage key */
export function prefKey(userId: string, key: string) {
  return `admin-${userId}-${key}`;
}

/**
 * Applies saved per-user appearance preferences on app mount.
 * Needs to run outside auth context (user may not be known yet),
 * so we store the last-known userId and read its prefs.
 */
export function useAppPreferences() {
  useEffect(() => {
    const userId = localStorage.getItem("admin-last-user");
    if (!userId) return;

    // Theme
    const theme = localStorage.getItem(prefKey(userId, "theme"));
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Accent color
    const accent = localStorage.getItem(prefKey(userId, "accent"));
    if (accent && accent !== "default") {
      const hsl = ACCENT_COLORS[accent];
      if (hsl) document.documentElement.style.setProperty("--primary", hsl);
    }

    // Font size
    const fontSize = localStorage.getItem(prefKey(userId, "font-size"));
    if (fontSize === "small") document.documentElement.style.fontSize = "14px";
    else if (fontSize === "large") document.documentElement.style.fontSize = "18px";
    else document.documentElement.style.fontSize = "16px";

    // System theme listener
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const uid = localStorage.getItem("admin-last-user");
      if (uid && localStorage.getItem(prefKey(uid, "theme")) === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handleSystemChange);
    return () => mql.removeEventListener("change", handleSystemChange);
  }, []);
}
