import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useProfile } from "@/hooks/useProfile";
import PageTransition from "./components/PageTransition";
import { RouteLoader } from "./components/RouteLoader";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Help from "./pages/Help";
import StudentDashboard from "./pages/StudentDashboard";
import SubmitComplaint from "./pages/SubmitComplaint";
import ComplaintDetail from "./pages/ComplaintDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminComplaints from "./pages/AdminComplaints";
import AdminNotifications from "./pages/AdminNotifications";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import CompleteProfile from "./pages/CompleteProfile";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";
import AdminLayout from "./components/admin/AdminLayout";
import NotFound from "./pages/NotFound";

function OAuthCallback() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      navigate(user ? (isAdmin ? "/admin" : "/") : "/auth", { replace: true });
    }
  }, [isAdmin, isLoading, navigate, user]);

  return <RouteLoader />;
}

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  
  if (isLoading || profileLoading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (profile && !profile.profile_completed) return <Navigate to="/complete-profile" replace />;
  
  return (
    <Layout>
      <PageTransition>{children}</PageTransition>
    </Layout>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  
  if (isLoading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return (
    <AdminLayout>
      <PageTransition>{children}</PageTransition>
    </AdminLayout>
  );
}

function AuthRoute() {
  const { user, isAdmin, isLoading } = useAuth();
  
  if (isLoading) return <RouteLoader />;
  if (user) return <Navigate to={isAdmin ? "/admin" : "/"} replace />;
  
  return <PageTransition><Auth /></PageTransition>;
}

function CompleteProfileRoute() {
  const { user, isAdmin, isLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  
  if (isLoading || profileLoading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin || (profile && profile.profile_completed)) return <Navigate to="/" replace />;
  
  return <PageTransition><CompleteProfile /></PageTransition>;
}

function AppPreferences({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useAppPreferences(user?.id);
  return <>{children}</>;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppPreferences>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/auth/callback" element={<OAuthCallback />} />
                <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
                <Route path="/help" element={<PageTransition><Help /></PageTransition>} />
                <Route path="/complete-profile" element={<CompleteProfileRoute />} />
                <Route path="/" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
                <Route path="/submit" element={<ProtectedRoute><SubmitComplaint /></ProtectedRoute>} />
                <Route path="/complaint/:id" element={<ProtectedRoute><ComplaintDetail /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/complaints" element={<AdminRoute><AdminComplaints /></AdminRoute>} />
                <Route path="/admin/complaint/:id" element={<AdminRoute><ComplaintDetail /></AdminRoute>} />
                <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
                <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
                <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
              </Routes>
            </AppPreferences>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
