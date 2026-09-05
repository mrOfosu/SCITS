import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://scits-six.vercel.app";
const DEFAULT_DESCRIPTION = "SCITS helps students submit, track, and resolve school complaints efficiently.";

const routeMeta = [
  { match: (path: string) => path === "/auth", title: "Sign In", description: "Sign in to SCITS to submit and track school complaints." },
  { match: (path: string) => path === "/complete-profile", title: "Complete Profile", description: "Complete your SCITS student profile to access complaint services." },
  { match: (path: string) => path === "/submit", title: "Submit a Complaint", description: "Submit a school complaint through the SCITS complaint tracking system." },
  { match: (path: string) => path === "/profile", title: "My Profile", description: "Manage your SCITS profile and student information." },
  { match: (path: string) => path === "/help", title: "Help & FAQ", description: "Find help and answers about using the SCITS complaint tracking system." },
  { match: (path: string) => path === "/admin", title: "Admin Dashboard", description: "Manage and monitor student complaints in the SCITS admin dashboard." },
  { match: (path: string) => path.startsWith("/admin/"), title: "Administration", description: "Manage complaints, users, notifications, and reports in SCITS." },
  { match: (path: string) => path.startsWith("/complaint/"), title: "Complaint Details", description: "View complaint status, activity, responses, and resolution details in SCITS." },
  { match: (path: string) => path.startsWith("/reset-password"), title: "Reset Password", description: "Securely reset your SCITS account password." },
];

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function setProperty(property: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function SiteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const matched = routeMeta.find((route) => route.match(pathname));
    const pageTitle = matched ? `${matched.title} | SCITS` : "SCITS | Student Complaint & Issue Tracking System";
    const description = matched?.description || DEFAULT_DESCRIPTION;
    const canonicalUrl = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
    const imageUrl = `${SITE_URL}/scits-social-preview.jpg`;

    document.title = pageTitle;
    setMeta("description", description);
    setProperty("og:title", pageTitle);
    setProperty("og:description", description);
    setProperty("og:url", canonicalUrl);
    setProperty("og:image", imageUrl);
    setMeta("twitter:title", pageTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", imageUrl);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [pathname]);

  return null;
}
