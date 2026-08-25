import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Palette, Sun, Moon, Monitor, Type, PanelLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { prefKey } from "@/hooks/useAppPreferences";

const accentColors = [
  { name: "Default", value: "default", hsl: "0 0% 9%" },
  { name: "Blue", value: "blue", hsl: "221 83% 53%" },
  { name: "Green", value: "green", hsl: "142 71% 45%" },
  { name: "Purple", value: "purple", hsl: "262 83% 58%" },
  { name: "Orange", value: "orange", hsl: "24 95% 53%" },
  { name: "Rose", value: "rose", hsl: "346 77% 50%" },
];

type ThemeMode = "light" | "dark" | "system";

export default function AppearanceSection() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [accentColor, setAccentColor] = useState("default");
  const [fontSize, setFontSize] = useState("medium");
  const { state, setOpen } = useSidebar();
  const sidebarStyle = state === "expanded" ? "expanded" : "compact";

  useEffect(() => {
    if (!userId) return;
    // Remember last user for global initializer
    localStorage.setItem("admin-last-user", userId);

    const saved = localStorage.getItem(prefKey(userId, "theme")) as ThemeMode | null;
    if (saved) {
      setTheme(saved);
      applyThemeToDOM(saved);
    } else {
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) setTheme("dark");
    }
    const savedAccent = localStorage.getItem(prefKey(userId, "accent"));
    if (savedAccent) setAccentColor(savedAccent);
    const savedFont = localStorage.getItem(prefKey(userId, "font-size"));
    if (savedFont) setFontSize(savedFont);
  }, [userId]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const applyThemeToDOM = (mode: ThemeMode) => {
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else if (mode === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  };

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem(prefKey(userId, "theme"), mode);
    applyThemeToDOM(mode);
  };

  const applyAccent = (color: string) => {
    setAccentColor(color);
    localStorage.setItem(prefKey(userId, "accent"), color);
    const found = accentColors.find(c => c.value === color);
    if (found && color !== "default") {
      document.documentElement.style.setProperty("--primary", found.hsl);
    } else {
      document.documentElement.style.removeProperty("--primary");
    }
    toast({ title: "Accent color updated" });
  };

  const applyFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem(prefKey(userId, "font-size"), size);
    const root = document.documentElement;
    if (size === "small") root.style.fontSize = "14px";
    else if (size === "large") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  };

  const handleSidebarStyle = (style: string) => {
    const expanded = style === "expanded";
    setOpen(expanded);
    localStorage.setItem(prefKey(userId, "sidebar-style"), style);
    toast({ title: `Sidebar set to ${style}` });
  };

  const resetToDefaults = () => {
    // Remove all per-user appearance keys
    localStorage.removeItem(prefKey(userId, "theme"));
    localStorage.removeItem(prefKey(userId, "accent"));
    localStorage.removeItem(prefKey(userId, "font-size"));
    localStorage.removeItem(prefKey(userId, "sidebar-style"));

    // Reset DOM
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.fontSize = "16px";
    setOpen(true);

    // Reset state
    setTheme("light");
    setAccentColor("default");
    setFontSize("medium");

    toast({ title: "Appearance reset to defaults" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize the look and feel of your dashboard</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDefaults} className="gap-2 rounded-full shrink-0">
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>

      {/* Theme Mode */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base tracking-tight flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Theme Mode
          </CardTitle>
          <CardDescription>Choose between light, dark, or system theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { mode: "light" as ThemeMode, icon: Sun, label: "Light" },
              { mode: "dark" as ThemeMode, icon: Moon, label: "Dark" },
              { mode: "system" as ThemeMode, icon: Monitor, label: "System" },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => applyTheme(mode)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors duration-150 hover:bg-secondary/50",
                  theme === mode ? "border-foreground bg-secondary/60" : "border-border"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base tracking-tight flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Accent Color
          </CardTitle>
          <CardDescription>Select a primary accent color for the interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {accentColors.map((color) => (
              <button
                key={color.value}
                onClick={() => applyAccent(color.value)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors duration-150 hover:bg-secondary/50",
                  accentColor === color.value ? "border-foreground" : "border-border"
                )}
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: `hsl(${color.hsl})` }}
                />
                <span className="text-sm">{color.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font Size & Sidebar */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base tracking-tight flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            Display Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Font Size</Label>
              <p className="text-xs text-muted-foreground">Adjust the base font size</p>
            </div>
            <Select value={fontSize} onValueChange={applyFontSize}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
                Sidebar Style
              </Label>
              <p className="text-xs text-muted-foreground">Choose sidebar display mode</p>
            </div>
            <Select value={sidebarStyle} onValueChange={handleSidebarStyle}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expanded">Expanded</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
