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

/** Reset all appearance customizations back to defaults on the DOM */
export function resetDOMAppearance() {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.fontSize = "16px";
}

/**
 * Applies saved per-user appearance preferences.
 * Only call this when a valid userId is known (i.e. user is authenticated).
 */
export function applyUserPreferences(userId: string) {
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
  } else {
    document.documentElement.style.removeProperty("--primary");
  }

  // Font size
  const fontSize = localStorage.getItem(prefKey(userId, "font-size"));
  if (fontSize === "small") document.documentElement.style.fontSize = "14px";
  else if (fontSize === "large") document.documentElement.style.fontSize = "18px";
  else document.documentElement.style.fontSize = "16px";
}

/**
 * Hook that applies/resets appearance based on auth state.
 * Pass the current user id (or null/undefined if not authenticated).
 */
export function useAppPreferences(userId: string | undefined) {
  useEffect(() => {
    if (userId) {
      applyUserPreferences(userId);
    } else {
      resetDOMAppearance();
    }

    // System theme listener (only when authenticated + system mode)
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (userId && localStorage.getItem(prefKey(userId, "theme")) === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handleSystemChange);
    return () => mql.removeEventListener("change", handleSystemChange);
  }, [userId]);
}
