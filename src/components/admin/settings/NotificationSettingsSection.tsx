import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Bell, Mail, AlertTriangle, FileText } from "lucide-react";

interface NotifPrefs {
  emailNewComplaint: boolean;
  emailStatusUpdate: boolean;
  adminAlerts: boolean;
  dailySummary: boolean;
}

const defaultNotifPrefs: NotifPrefs = {
  emailNewComplaint: true,
  emailStatusUpdate: true,
  adminAlerts: true,
  dailySummary: false,
};

export default function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultNotifPrefs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("notification-preferences");
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch {}
    }
  }, []);

  const update = (key: keyof NotifPrefs, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem("notification-preferences", JSON.stringify(prefs));
    setDirty(false);
    toast({ title: "Notification settings saved" });
  };

  const items = [
    {
      key: "emailNewComplaint" as const,
      icon: Mail,
      title: "New Complaint Emails",
      desc: "Receive email when a new complaint is submitted",
    },
    {
      key: "emailStatusUpdate" as const,
      icon: Mail,
      title: "Status Update Emails",
      desc: "Send email to students when complaint status changes",
    },
    {
      key: "adminAlerts" as const,
      icon: AlertTriangle,
      title: "Admin Alerts",
      desc: "In-app alerts for high-priority complaints",
    },
    {
      key: "dailySummary" as const,
      icon: FileText,
      title: "Daily Summary",
      desc: "Receive a daily email digest of complaint activity",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Notification Settings</h2>
        <p className="text-sm text-muted-foreground">Control how notifications are sent and received</p>
      </div>

      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base tracking-tight flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Email & Alert Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item, i) => (
            <div key={item.key}>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <Label className="text-sm">{item.title}</Label>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Switch checked={prefs[item.key]} onCheckedChange={(v) => update(item.key, v)} />
              </div>
              {i < items.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3"
          >
            <Button onClick={handleSave} className="shadow-elevation-sm">Save Settings</Button>
            <Button variant="outline" onClick={() => { setPrefs(defaultNotifPrefs); setDirty(false); }}>Reset</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
