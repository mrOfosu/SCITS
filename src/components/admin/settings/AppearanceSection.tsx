import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Palette, Sun, Moon, Monitor, Type, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

const accentColors = [
  { name: "Default", value: "default", hsl: "222.2 47.4% 11.2%" },
  { name: "Blue", value: "blue", hsl: "221 83% 53%" },
  { name: "Green", value: "green", hsl: "142 71% 45%" },
  { name: "Purple", value: "purple", hsl: "262 83% 58%" },
  { name: "Orange", value: "orange", hsl: "24 95% 53%" },
  { name: "Rose", value: "rose", hsl: "346 77% 50%" },
];

type ThemeMode = "light" | "dark" | "system";

export default function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [accentColor, setAccentColor] = useState("default");
  const [fontSize, setFontSize] = useState("medium");
  const [sidebarStyle, setSidebarStyle] = useState("expanded");

  useEffect(() => {
    const saved = localStorage.getItem("admin-theme") as ThemeMode | null;
    if (saved) setTheme(saved);
    const savedAccent = localStorage.getItem("admin-accent");
    if (savedAccent) setAccentColor(savedAccent);
    const savedFont = localStorage.getItem("admin-font-size");
    if (savedFont) setFontSize(savedFont);
    const savedSidebar = localStorage.getItem("admin-sidebar-style");
    if (savedSidebar) setSidebarStyle(savedSidebar);

    // Apply current theme
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) setTheme("dark");
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("admin-theme", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else if (mode === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  };

  const applyAccent = (color: string) => {
    setAccentColor(color);
    localStorage.setItem("admin-accent", color);
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
    localStorage.setItem("admin-font-size", size);
    const root = document.documentElement;
    root.classList.remove("text-sm", "text-base", "text-lg");
    if (size === "small") root.style.fontSize = "14px";
    else if (size === "large") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  };

  const handleSidebarStyle = (style: string) => {
    setSidebarStyle(style);
    localStorage.setItem("admin-sidebar-style", style);
    toast({ title: `Sidebar set to ${style}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize the look and feel of your dashboard</p>
      </div>

      {/* Theme Mode */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
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
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent",
                  theme === mode ? "border-primary bg-accent" : "border-border"
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
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Accent Color
          </CardTitle>
          <CardDescription>Select a primary accent color for the interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {accentColors.map((color) => (
              <button
                key={color.value}
                onClick={() => applyAccent(color.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all hover:bg-accent",
                  accentColor === color.value ? "border-primary" : "border-border"
                )}
              >
                <div
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: `hsl(${color.hsl})` }}
                />
                <span className="text-sm">{color.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font Size & Sidebar */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
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
