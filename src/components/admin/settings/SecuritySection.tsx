import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Shield, Clock, Lock, AlertCircle } from "lucide-react";

interface SecurityPrefs {
  minPasswordLength: string;
  sessionTimeout: string;
  lockoutAfterAttempts: string;
  enforceStrongPasswords: boolean;
}

const defaultSecurityPrefs: SecurityPrefs = {
  minPasswordLength: "8",
  sessionTimeout: "30",
  lockoutAfterAttempts: "5",
  enforceStrongPasswords: true,
};

export default function SecuritySection() {
  const [prefs, setPrefs] = useState<SecurityPrefs>(defaultSecurityPrefs);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("security-preferences");
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch {}
    }
  }, []);

  const update = (key: keyof SecurityPrefs, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem("security-preferences", JSON.stringify(prefs));
    setDirty(false);
    toast({ title: "Security settings saved" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Security Settings</h2>
        <p className="text-sm text-muted-foreground">Configure system security and access policies</p>
      </div>

      {/* Password Policy */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Password Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Minimum Password Length</Label>
              <p className="text-xs text-muted-foreground">Required minimum characters for passwords</p>
            </div>
            <Select value={prefs.minPasswordLength} onValueChange={v => update("minPasswordLength", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="12">12</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Enforce Strong Passwords</Label>
              <p className="text-xs text-muted-foreground">Require uppercase, lowercase, numbers, and symbols</p>
            </div>
            <Switch checked={prefs.enforceStrongPasswords} onCheckedChange={v => update("enforceStrongPasswords", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Session & Lockout */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Session & Lockout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Session Timeout</Label>
              <p className="text-xs text-muted-foreground">Auto-logout after inactivity (minutes)</p>
            </div>
            <Select value={prefs.sessionTimeout} onValueChange={v => update("sessionTimeout", v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Lockout After Failed Attempts</Label>
              <p className="text-xs text-muted-foreground">Lock account after consecutive failed logins</p>
            </div>
            <Select value={prefs.lockoutAfterAttempts} onValueChange={v => update("lockoutAfterAttempts", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Login Activity */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Login Activity
          </CardTitle>
          <CardDescription>Recent login activity will be displayed here in a future update</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Login activity logs coming soon
          </div>
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex gap-3">
          <Button onClick={handleSave}>Save Settings</Button>
          <Button variant="outline" onClick={() => { setPrefs(defaultSecurityPrefs); setDirty(false); }}>Reset</Button>
        </div>
      )}
    </div>
  );
}
