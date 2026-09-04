import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  HelpCircle,
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      setLoading(false);
    }
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
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
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsForgotPassword(false)}
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  const features = [
    { icon: FileText, title: "Easy Submission", desc: "Report issues in just a few clicks" },
    { icon: Activity, title: "Real-time Tracking", desc: "Follow your complaint status live" },
    { icon: Sparkles, title: "Kwame AI Assistant", desc: "Get smart guidance instantly" },
    { icon: ShieldCheck, title: "Secure & Transparent", desc: "Your data stays private and safe" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Left: Branding */}
        <div className="relative flex flex-col justify-between p-8 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />

          {/* Animated ambient background — kept clear of the headline text */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-32 top-[4%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] animate-spin-slow rounded-full border border-dashed border-brand/40">
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/60" />
            </div>
            <div className="absolute -right-20 top-[12%] h-[190px] w-[190px] sm:h-[260px] sm:w-[260px] animate-spin-slower rounded-full border border-brand-teal/40">
              <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-teal/70" />
            </div>
            <div className="absolute -bottom-40 -left-32 h-[380px] w-[380px] sm:h-[480px] sm:w-[480px] animate-spin-slower rounded-full border border-dashed border-brand/25" />
            <div className="absolute right-[6%] top-[3%] animate-float text-brand/60">
              <FileText className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="absolute right-[16%] top-[15%] animate-float text-brand-teal/60 [animation-delay:1.5s]">
              <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="absolute left-[4%] top-[6%] animate-float text-brand/45 [animation-delay:2.2s]">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="absolute bottom-[6%] right-[8%] animate-float text-brand-teal/50 [animation-delay:3s]">
              <Activity className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="absolute bottom-[16%] left-[6%] animate-float text-brand/40 [animation-delay:4s]">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="absolute -top-24 -left-24 h-72 w-72 animate-pulse-soft rounded-full bg-brand/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 animate-pulse-soft rounded-full bg-brand-teal/15 blur-3xl [animation-delay:2s]" />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[58%] -z-10 w-[100%] max-w-[720px] -translate-x-1/2 -translate-y-1/2 aspect-[16/9] bg-contain bg-center bg-no-repeat opacity-[0.32] saturate-50 dark:opacity-[0.18] dark:grayscale"
            style={{ backgroundImage: `url(/scits_logo_mark.png)` }}
          />

          <div className="flex items-center gap-2.5 animate-fade-in">
            <img
              src="/scits_logo_mark.png"
              alt="SCITS logo"
              className="h-12 w-12 object-contain opacity-80"
            />
            <span className="font-display font-semibold text-lg tracking-tight">SCITS</span>
          </div>

          <div className="py-10 space-y-6 lg:space-y-8">
            <div className="space-y-3">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[3rem] font-extrabold tracking-tight leading-[1.25] py-1 text-foreground animate-fade-in">
                Student Complaint &amp; Issue Tracking System
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-md animate-fade-in [animation-delay:120ms] opacity-0">
                A smart platform for students to report, track, and resolve issues efficiently.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  style={{ animationDelay: `${200 + i * 90}ms` }}
                  className="group flex items-start gap-3 rounded-xl border bg-card/60 backdrop-blur p-3 shadow-sm opacity-0 animate-fade-in transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-medium text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex gap-4 text-xs text-muted-foreground">
            <Link to="/help" className="hover:text-foreground transition-colors">Help &amp; FAQ</Link>
            <span>·</span>
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span>·</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>


        {/* Right: Auth form */}
        <div className="relative flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -bottom-28 -right-28 h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] animate-spin-slow rounded-full border border-dashed border-brand/35">
              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/60" />
            </div>
            <div className="absolute -bottom-16 -right-16 h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] animate-spin-slower rounded-full border border-brand-teal/35" />
            <div className="absolute bottom-[10%] right-[8%] animate-float text-brand-teal/55 [animation-delay:2s]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="absolute top-[6%] left-[6%] animate-float text-brand/45 [animation-delay:1s]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-24 -right-24 h-64 w-64 animate-pulse-soft rounded-full bg-brand/15 blur-3xl" />
          </div>
          <Card className="w-full max-w-md shadow-xl border-border/60 animate-scale-in backdrop-blur-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="font-display text-2xl">{isLogin ? "Welcome back" : "Create your account"}</CardTitle>
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
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-primary font-medium">{isLogin ? "Sign up" : "Sign in"}</span>
                </button>
                <Link
                  to="/help"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> Need help? Guides &amp; FAQ
                </Link>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden flex justify-center gap-4 text-xs text-muted-foreground pb-6">
          <Link to="/help" className="hover:text-foreground transition-colors">Help &amp; FAQ</Link>
          <span>·</span>
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
