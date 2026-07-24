import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
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

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 border-b last:border-0 bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View all your notifications</p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>
      <Card className="shadow-elevation-sm">
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 bg-secondary rounded-full flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n, i) => (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.03, 0.24) }}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full border-b px-4 py-3.5 text-left transition-colors duration-150 hover:bg-secondary/50 last:border-0",
                  !n.is_read && "bg-secondary/30"
                )}
              >
                <div className="flex items-start gap-2.5">
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" />}
                  <div className={cn("min-w-0", n.is_read && "pl-4")}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
