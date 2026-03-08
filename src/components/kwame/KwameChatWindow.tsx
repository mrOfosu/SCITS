import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import {
  Send, X, Bot, User, AlertTriangle,
  BookOpen, Building, HelpCircle, Minimize2, Maximize2,
  UserX, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/components/KwameChatbot";

const quickActions = [
  { label: "Report Bullying", icon: AlertTriangle, message: "I want to report a bullying incident at school." },
  { label: "Teacher Misconduct", icon: UserX, message: "I want to report teacher misconduct." },
  { label: "Facility Problem", icon: Building, message: "There's a problem with a school facility." },
  { label: "My Complaint Status", icon: MessageSquare, message: "What's happening with my complaint?" },
  { label: "Ask a Question", icon: HelpCircle, message: "I have a question about the school complaint process." },
];

interface KwameChatWindowProps {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onNavigateSubmit: () => void;
  mode?: "dashboard" | "complaint-form";
}

export default function KwameChatWindow({
  messages, input, setInput, isLoading, isExpanded,
  onToggleExpand, onClose, onSend, onNavigateSubmit, mode,
}: KwameChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const shouldShowComplaintButton = (content: string) => {
    const lower = content.toLowerCase();
    return lower.includes("submit a complaint") ||
      lower.includes("submitting a complaint") ||
      lower.includes("submitting a formal complaint") ||
      lower.includes("submit a formal complaint") ||
      lower.includes("would you like to submit") ||
      lower.includes("recommend submitting");
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Card
      className={cn(
        "fixed z-50 flex flex-col shadow-2xl border transition-all duration-200",
        isExpanded
          ? "inset-4 rounded-xl"
          : "bottom-6 right-6 w-[380px] h-[540px] max-h-[80vh] rounded-2xl sm:w-[400px]"
      )}
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 text-lg font-bold">
            K
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Kwame</CardTitle>
            <p className="text-[11px] opacity-80">Student Support Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={onToggleExpand}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  K
                </div>
              )}
              <div className="max-w-[80%] space-y-1">
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <p className={cn("text-[10px] text-muted-foreground", msg.role === "user" ? "text-right" : "text-left")}>
                  {formatTime(msg.timestamp)}
                </p>
                {msg.role === "assistant" && shouldShowComplaintButton(msg.content) && msg.id !== "welcome" && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={onNavigateSubmit}>
                      Submit Complaint
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => onSend("I'd like some advice first.")}>
                      Get Advice
                    </Button>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                K
              </div>
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onSend(action.message)}
              disabled={isLoading}
            >
              <action.icon className="h-3 w-3" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <CardContent className="border-t p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); onSend(input); }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 rounded-full text-sm"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-9 w-9 shrink-0 rounded-full">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
