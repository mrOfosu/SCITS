import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { prefKey } from "@/hooks/useAppPreferences";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const savedSidebar = userId ? localStorage.getItem(prefKey(userId, "sidebar-style")) : null;
  const defaultOpen = savedSidebar !== "compact";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 px-4 transition-colors duration-200">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors duration-150" />
            <NotificationBell />
          </header>
          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
