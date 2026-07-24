import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, FileText, Bell, BarChart3, Settings, LogOut, GraduationCap, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Complaints", url: "/admin/complaints", icon: FileText },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
          </span>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm tracking-tight truncate">Complaint Tracker</span>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground">
                <Shield className="h-2.5 w-2.5" /> Admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = item.url === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="relative h-9">
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="relative overflow-hidden text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors duration-150"
                        activeClassName="!text-sidebar-accent-foreground font-medium"
                        onClick={handleNavClick}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="admin-sidebar-active"
                            className="absolute inset-0 rounded-md bg-sidebar-accent"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <item.icon className="relative z-10 mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="relative z-10">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
        <ConfirmDialog
          open={showLogoutConfirm}
          onOpenChange={setShowLogoutConfirm}
          title="Sign Out"
          description="Are you sure you want to sign out? You'll need to log in again to access your account."
          confirmLabel="Sign Out"
          variant="destructive"
          onConfirm={signOut}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
