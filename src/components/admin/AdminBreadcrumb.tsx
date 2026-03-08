import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

export default function AdminBreadcrumb() {
  const location = useLocation();
  const items: BreadcrumbItem[] = [];

  if (location.pathname === "/admin") {
    items.push({ label: "Dashboard" });
  } else if (location.pathname === "/admin/complaints") {
    items.push({ label: "Dashboard", path: "/admin" });
    items.push({ label: "Complaints" });
  } else if (location.pathname.startsWith("/admin/complaint/")) {
    items.push({ label: "Dashboard", path: "/admin" });
    items.push({ label: "Complaints", path: "/admin/complaints" });
    items.push({ label: "Complaint Details" });
  } else if (location.pathname === "/admin/notifications") {
    items.push({ label: "Dashboard", path: "/admin" });
    items.push({ label: "Notifications" });
  } else if (location.pathname === "/admin/reports") {
    items.push({ label: "Dashboard", path: "/admin" });
    items.push({ label: "Reports" });
  } else if (location.pathname === "/admin/settings") {
    items.push({ label: "Dashboard", path: "/admin" });
    items.push({ label: "Settings" });
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      <Link to="/admin" className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.path && i < items.length - 1 ? (
            <Link to={item.path} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-foreground font-medium" : ""}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
