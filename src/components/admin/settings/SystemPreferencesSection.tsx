import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Settings, ArrowRight, Bot, Bell } from "lucide-react";

interface SystemPrefs {
  defaultPriority: string;
  autoAssign: boolean;
  notificationsEnabled: boolean;
  aiChatbotEnabled: boolean;
}

const defaultPrefs: SystemPrefs = {
  defaultPriority: "medium",
  autoAssign: false,
  notificationsEnabled: true,
  aiChatbotEnabled: false,
};

export default function SystemPreferencesSection() {
  const [prefs, setPrefs] = useState<SystemPrefs>(defaultPrefs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("system-preferences");
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch {}
    }
  }, []);

  const update = (key: keyof SystemPrefs, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem("system-preferences", JSON.stringify(prefs));
    setDirty(false);
    toast({ title: "System preferences saved" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">System Preferences</h2>
        <p className="text-sm text-muted-foreground">Configure how the complaint system operates</p>
      </div>

      {/* Default Priority */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Complaint Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Complaint Priority</Label>
              <p className="text-xs text-muted-foreground">Priority assigned to new complaints</p>
            </div>
            <Select value={prefs.defaultPriority} onValueChange={(v) => update("defaultPriority", v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <Label className="text-sm font-medium">Complaint Status Workflow</Label>
            <p className="text-xs text-muted-foreground mb-3">The lifecycle of a complaint</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {["Pending", "In Review", "Resolved", "Closed"].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                    {step}
                  </span>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-assignment & Toggles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Automation & Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Assignment</Label>
              <p className="text-xs text-muted-foreground">Automatically assign complaints to available admins</p>
            </div>
            <Switch checked={prefs.autoAssign} onCheckedChange={(v) => update("autoAssign", v)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Notifications</Label>
                <p className="text-xs text-muted-foreground">Enable system-wide notifications</p>
              </div>
            </div>
            <Switch checked={prefs.notificationsEnabled} onCheckedChange={(v) => update("notificationsEnabled", v)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>AI Student Chatbot</Label>
                <p className="text-xs text-muted-foreground">Enable AI-powered chatbot for students</p>
              </div>
            </div>
            <Switch checked={prefs.aiChatbotEnabled} onCheckedChange={(v) => update("aiChatbotEnabled", v)} />
          </div>
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex gap-3">
          <Button onClick={handleSave}>Save Preferences</Button>
          <Button variant="outline" onClick={() => { setPrefs(defaultPrefs); setDirty(false); }}>Reset</Button>
        </div>
      )}
    </div>
  );
}
