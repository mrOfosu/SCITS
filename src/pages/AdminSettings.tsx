import { useState } from "react";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure system preferences and manage your account</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Sidebar */}
        <nav className="lg:w-56 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
                  active === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
