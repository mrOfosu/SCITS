import { useEffect } from "react";

/**
 * Reads saved appearance preferences from localStorage and applies them
 * to the DOM on mount. This runs at the app root so preferences survive
 * logout / login cycles.
 */
export function useAppPreferences() {
  useEffect(() => {
    // Theme
    const theme = localStorage.getItem("admin-theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Accent color
    const accent = localStorage.getItem("admin-accent");
    if (accent && accent !== "default") {
      const accentColors: Record<string, string> = {
        blue: "221 83% 53%",
        green: "142 71% 45%",
        purple: "262 83% 58%",
        orange: "24 95% 53%",
        rose: "346 77% 50%",
      };
      const hsl = accentColors[accent];
      if (hsl) document.documentElement.style.setProperty("--primary", hsl);
    }

    // Font size
    const fontSize = localStorage.getItem("admin-font-size");
    if (fontSize === "small") document.documentElement.style.fontSize = "14px";
    else if (fontSize === "large") document.documentElement.style.fontSize = "18px";
    else document.documentElement.style.fontSize = "16px";

    // System theme listener
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("admin-theme") === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handleSystemChange);
    return () => mql.removeEventListener("change", handleSystemChange);
  }, []);
}
