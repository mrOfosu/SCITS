import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { User, Palette, Settings, Tags, Users, Bell, Shield, Info } from "lucide-react";
import ProfileAccountSection from "@/components/admin/settings/ProfileAccountSection";
import AppearanceSection from "@/components/admin/settings/AppearanceSection";
import SystemPreferencesSection from "@/components/admin/settings/SystemPreferencesSection";
import CategoriesSection from "@/components/admin/settings/CategoriesSection";
import UserManagementSection from "@/components/admin/settings/UserManagementSection";
import NotificationSettingsSection from "@/components/admin/settings/NotificationSettingsSection";
import SecuritySection from "@/components/admin/settings/SecuritySection";
import SystemInfoSection from "@/components/admin/settings/SystemInfoSection";

const sections = [
  { id: "profile", label: "Profile & Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "system", label: "System Preferences", icon: Settings },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "info", label: "System Info", icon: Info },
] as const;

type SectionId = (typeof sections)[number]["id"];

const sectionComponents: Record<SectionId, React.FC> = {
  profile: ProfileAccountSection,
  appearance: AppearanceSection,
  system: SystemPreferencesSection,
  categories: CategoriesSection,
  users: UserManagementSection,
  notifications: NotificationSettingsSection,
  security: SecuritySection,
  info: SystemInfoSection,
};

export default function AdminSettings() {
  const [active, setActive] = useState<SectionId>("profile");
  const ActiveComponent = sectionComponents[active];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Configure system preferences and manage your account</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">
        {/* Settings Sidebar */}
        <nav className="lg:w-56 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:rounded-lg lg:border lg:bg-card lg:p-1.5 lg:shadow-elevation-sm">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 text-left shrink-0",
                  active === id
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                {active === id && (
                  <motion.span
                    layoutId="settings-nav-active"
                    className="absolute inset-0 rounded-md bg-secondary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10 hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
