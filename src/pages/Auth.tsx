import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import logoWatermark from "@/assets/logo-watermark.jpg";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  Lock,
  User as UserIcon,
  FileText,
  Activity,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a password reset link." });
      setIsForgotPassword(false);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        if (!rememberMe) {
          sessionStorage.setItem("no-persist", "true");
        } else {
          sessionStorage.removeItem("no-persist");
        }
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a verification link." });
      }
    }
    setLoading(false);
  };

  if (isForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="shadow-elevation-lg border-border/60">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-foreground">
                <GraduationCap className="h-6 w-6 text-background" />
              </div>
              <CardTitle className="text-2xl tracking-tight">Reset Password</CardTitle>
              <CardDescription>Enter your email to receive a reset link</CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="resetEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full h-11 shadow-elevation-sm hover:shadow-elevation-md transition-shadow duration-200" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                  onClick={() => setIsForgotPassword(false)}
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  const features = [
    { icon: FileText, title: "Easy Submission", desc: "Report issues in just a few clicks" },
    { icon: Activity, title: "Real-time Tracking", desc: "Follow your complaint status live" },
    { icon: Sparkles, title: "Kwame AI Assistant", desc: "Get smart guidance instantly", featured: true },
    { icon: ShieldCheck, title: "Secure & Transparent", desc: "Your data stays private and safe" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Left: Branding */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col justify-between p-8 lg:p-12 overflow-hidden lg:border-r"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Desaturated logo watermark, isolated on its own layer so the grayscale filter
              doesn't affect the dot-grid texture or any content stacked above it */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
            style={{
              backgroundImage: `url(${logoWatermark})`,
              backgroundSize: "140% auto",
              backgroundPosition: "center 65%",
              backgroundRepeat: "no-repeat",
              filter: "grayscale(1) contrast(1.1)",
            }}
          />
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
              <GraduationCap className="h-5 w-5 text-background" />
            </div>
            <span className="font-semibold text-lg tracking-tight">SCITS</span>
          </div>

          <div className="py-10 space-y-6 lg:space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
                Student Complaint & Issue Tracking System
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-md">
                A smart platform for students to report, track, and resolve issues efficiently.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.06 }}
                  whileHover={{ y: -2 }}
                  className={`flex items-start gap-3 rounded-xl border p-3 shadow-elevation-sm transition-shadow duration-200 hover:shadow-elevation-md ${
                    f.featured ? "bg-foreground text-background border-foreground" : "bg-card"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      f.featured ? "bg-background/15 text-background" : "bg-secondary text-foreground"
                    }`}
                  >
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm flex items-center gap-1.5 ${f.featured ? "text-background" : ""}`}>
                      {f.title}
                      {f.featured && (
                        <span className="rounded-full bg-background/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                          AI
                        </span>
                      )}
                    </p>
                    <p className={`text-xs ${f.featured ? "text-background/70" : "text-muted-foreground"}`}>{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex gap-4 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors duration-150">Privacy Policy</a>
            <span>·</span>
            <a href="#" className="hover:text-foreground transition-colors duration-150">Terms of Service</a>
          </div>
        </motion.div>

        {/* Right: Auth form */}
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="w-full max-w-md"
          >
          <Card className="shadow-elevation-lg border-border/60">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</CardTitle>
              <CardDescription>
                {isLogin ? "Sign in to access your dashboard" : "Register as a new student to get started"}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      required
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="pl-10 pr-10 h-11"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {isLogin && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => setIsForgotPassword(true)}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full h-11 text-base shadow-elevation-sm hover:shadow-elevation-md transition-shadow duration-200" disabled={loading}>
                  {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-foreground font-medium">{isLogin ? "Sign up" : "Sign in"}</span>
                </button>
              </CardFooter>
            </form>
          </Card>
          </motion.div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden flex justify-center gap-4 text-xs text-muted-foreground pb-6">
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
