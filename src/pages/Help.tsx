import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import scitsIcon from "@/assets/scits_logo_mark.png.asset.json";
import {
  ArrowLeft,
  UserPlus,
  FileText,
  Activity,
  MessageSquare,
  Star,
  ShieldCheck,
  Sparkles,
  ArrowUpCircle,
  LifeBuoy,
} from "lucide-react";

const guides = [
  {
    icon: UserPlus,
    title: "1. Create your account",
    steps: [
      "Click “Sign up” on the login page and register with your student email, or use Continue with Google.",
      "Open the verification link sent to your email to activate the account.",
      "Complete your profile: full name, student ID, faculty, department and level. This is required before submitting complaints.",
    ],
  },
  {
    icon: FileText,
    title: "2. Submit a complaint",
    steps: [
      "Go to “Submit Complaint” from the dashboard.",
      "Pick the faculty, department, category and complaint type so it routes to the right officer.",
      "Write a clear title and description, choose a priority, and attach any supporting files (screenshots, receipts, documents).",
      "Submit — you'll get a reference ID you can use to track the complaint.",
    ],
  },
  {
    icon: Activity,
    title: "3. Track progress",
    steps: [
      "Your dashboard shows every complaint with its current status: Pending, In Review, Resolved, Closed or Rejected.",
      "Open a complaint to see the full activity timeline of every action taken.",
      "In-app and email notifications alert you whenever an officer responds or the status changes.",
    ],
  },
  {
    icon: ArrowUpCircle,
    title: "4. Escalation",
    steps: [
      "If a complaint receives no action for 3 days, the system automatically escalates it to the Head of Department.",
      "You can also request escalation manually from the complaint page.",
      "Escalated complaints are clearly marked on the timeline.",
    ],
  },
  {
    icon: Star,
    title: "5. Give feedback",
    steps: [
      "Once a complaint is resolved you'll be prompted to rate the resolution from 1 to 5 stars.",
      "Add an optional comment — it helps departments improve their response quality.",
      "You may delete a closed complaint, or a resolved complaint one week after resolution.",
    ],
  },
  {
    icon: Sparkles,
    title: "6. Ask Kwame (AI assistant)",
    steps: [
      "Kwame is the built-in assistant for students, available from the chat bubble on your dashboard.",
      "Ask it how to phrase a complaint, which department handles an issue, or what your status means.",
      "Kwame never submits a complaint for you — you stay in control.",
    ],
  },
];

const faqs = [
  {
    q: "I didn't receive my verification email. What do I do?",
    a: "Check your spam or promotions folder first. If it still hasn't arrived after a few minutes, try signing up again with the same email or use Continue with Google, which skips email verification.",
  },
  {
    q: "I forgot my password.",
    a: "On the login page click “Forgot password?”, enter your email, and follow the reset link we send you. The link opens a secure page where you can set a new password.",
  },
  {
    q: "Can I submit a complaint anonymously?",
    a: "Yes. When submitting, enable the anonymous option. Your name is hidden from the handling officer, but the complaint is still linked to your account so you can track it.",
  },
  {
    q: "Who sees my complaint?",
    a: "Only the department officer(s) responsible for the selected department, their Head of Department, the faculty officer, and system administrators. Other students can never see your complaints.",
  },
  {
    q: "How long does a resolution take?",
    a: "Most complaints are reviewed within 48 hours. If there's no action within 3 days, the complaint is automatically escalated to the Head of Department.",
  },
  {
    q: "What do the statuses mean?",
    a: "Pending — submitted and awaiting review. In Review — an officer is working on it. Resolved — a resolution has been provided. Closed — the case is finished. Rejected — the complaint was declined, with a reason attached.",
  },
  {
    q: "Can I edit or delete a complaint?",
    a: "Complaints cannot be edited after submission, to keep the record accurate — add a response instead. You can delete a closed complaint at any time, and a resolved complaint one week after it was resolved.",
  },
  {
    q: "What files can I attach?",
    a: "Images, PDFs and common document formats. Keep each file reasonably small (a few MB) so it uploads quickly.",
  },
  {
    q: "I picked the wrong department.",
    a: "Add a response on the complaint explaining the mistake. An officer can reassign it, or you may close it and submit a new one to the correct department.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. All data is protected by row-level security so records are only readable by you and the authorised staff handling your case. Passwords are never stored in plain text.",
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
          <div className="flex items-center gap-2">
            <img src={scitsIcon.url} alt="SCITS logo" className="h-9 w-9 object-contain" />
            <span className="font-display font-semibold tracking-tight">SCITS</span>
          </div>
        </div>

        <header className="mt-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <LifeBuoy className="h-3.5 w-3.5" /> Help Centre
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.2]">
            Guides &amp; Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Everything you need to get started with the Student Complaint &amp; Issue Tracking System —
            from creating an account to tracking, escalating and rating a complaint.
          </p>
        </header>

        <section className="mt-10 space-y-4" aria-labelledby="guides-heading">
          <h2 id="guides-heading" className="font-display text-xl font-semibold">Step-by-step guides</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <Card key={g.title} className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardHeader className="space-y-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <g.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="font-display text-base">{g.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {g.steps.map((s) => (
                      <li key={s} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="faq-heading">
          <Card>
            <CardHeader>
              <CardTitle id="faq-heading" className="font-display text-xl">Frequently asked questions</CardTitle>
              <CardDescription>Quick answers to the questions students ask most.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <Card className="bg-card/70 backdrop-blur">
            <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-display font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Still need help?
                </p>
                <p className="text-sm text-muted-foreground">
                  Sign in and ask Kwame, our AI assistant, or submit a complaint under the
                  “ICT / System Support” category.
                </p>
              </div>
              <Button asChild className="h-11 shrink-0">
                <Link to="/auth">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Your complaints and personal data are private and protected.
        </p>
      </div>
    </div>
  );
}
