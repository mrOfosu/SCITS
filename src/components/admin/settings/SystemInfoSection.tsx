import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Database, Globe, Clock, Server } from "lucide-react";

export default function SystemInfoSection() {
  const [dbStatus, setDbStatus] = useState<"connected" | "error" | "checking">("checking");
  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [complaintCount, setComplaintCount] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const { count: pCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
        const { count: cCount } = await supabase.from("complaints").select("*", { count: "exact", head: true });
        setProfileCount(pCount ?? 0);
        setComplaintCount(cCount ?? 0);
        setDbStatus("connected");
      } catch {
        setDbStatus("error");
      }
    };
    check();
  }, []);

  const infoItems = [
    { icon: Server, label: "System Version", value: "1.0.0" },
    { icon: Database, label: "Database Status", value: dbStatus === "checking" ? "Checking..." : dbStatus === "connected" ? "Connected" : "Error", badge: true, status: dbStatus },
    { icon: Globe, label: "API Status", value: "Operational", badge: true, status: "connected" as const },
    { icon: Clock, label: "Last Updated", value: new Date().toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">System Information</h2>
        <p className="text-sm text-muted-foreground">View system details and health status</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {infoItems.map(item => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.badge ? (
                  <Badge variant={item.status === "connected" ? "default" : item.status === "error" ? "destructive" : "secondary"}>
                    {item.value}
                  </Badge>
                ) : (
                  <p className="font-medium text-foreground">{item.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Database Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{profileCount ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Registered Users</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{complaintCount ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Total Complaints</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
