import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Home, PlusCircle, Shield, User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navItems = isAdmin
    ? [
        { to: "/admin", label: "Dashboard", icon: Home },
      ]
    : [
        { to: "/", label: "My Complaints", icon: Home },
        { to: "/submit", label: "New Complaint", icon: PlusCircle },
        { to: "/profile", label: "Profile", icon: User },
      ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to={isAdmin ? "/admin" : "/"} className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Complaint Tracker</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
            {isAdmin && (
              <div className="ml-1 flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                <Shield className="h-3 w-3" /> Admin
              </div>
            )}
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setShowLogoutConfirm(true)} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
          <ConfirmDialog
            open={showLogoutConfirm}
            onOpenChange={setShowLogoutConfirm}
            title="Sign Out"
            description="Are you sure you want to sign out? You'll need to log in again to access your account."
            confirmLabel="Sign Out"
            variant="destructive"
            onConfirm={signOut}
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
