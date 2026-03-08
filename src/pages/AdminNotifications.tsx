import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  complaint_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id, complaint_id, title, message, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setNotifications((data || []) as Notification[]);
        setLoading(false);
      });
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.complaint_id) navigate(`/admin/complaint/${n.complaint_id}`);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">View all your notifications</p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all as read</Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 last:border-0",
                  !n.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className={cn("min-w-0", n.is_read && "pl-4")}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
