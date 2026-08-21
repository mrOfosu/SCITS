import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prefKey } from "@/hooks/useAppPreferences";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

export default function ThemeToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (userId) {
      const saved = localStorage.getItem(prefKey(userId, "theme"));
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        applyThemeToDOM(saved);
      } else {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "dark" : "light");
      }
    } else {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    }
  }, [userId]);

  const applyThemeToDOM = (mode: ThemeMode) => {
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyThemeToDOM(newTheme);
    if (userId) {
      localStorage.setItem(prefKey(userId, "theme"), newTheme);
    } else {
      localStorage.setItem("guest-theme", newTheme);
    }
  };

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg",
        "border border-border/60 bg-background/90 backdrop-blur-sm",
        "hover:bg-accent hover:scale-110 transition-all duration-200",
        className
      )}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-foreground" />
      ) : (
        <Moon className="h-5 w-5 text-foreground" />
      )}
    </Button>
  );
}
