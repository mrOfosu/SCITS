import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Home, PlusCircle, Shield, User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ConfirmDialog from "@/components/ConfirmDialog";
import ThemeToggle from "@/components/ThemeToggle";

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
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link
            to={isAdmin ? "/admin" : "/"}
            className="flex items-center gap-2 font-semibold tracking-tight min-w-0 group"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline truncate">Complaint Tracker</span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            <div className="flex items-center gap-0.5 sm:gap-1 rounded-full bg-muted/60 p-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} className="relative">
                    {isActive && (
                      <motion.span
                        layoutId="student-nav-active"
                        className="absolute inset-0 rounded-full bg-background shadow-elevation-sm"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden md:inline">{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {isAdmin && (
              <div className="ml-2 hidden sm:flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
                <Shield className="h-3 w-3" /> Admin
              </div>
            )}
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign out"
              className="h-10 w-10 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
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
<<<<<<< HEAD
      <main className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6">{children}</main>
      <ThemeToggle />
=======
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
>>>>>>> ui-loderico
    </div>
  );
}
