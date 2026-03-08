import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Send, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-chat`;

type Msg = { role: "user" | "assistant"; content: string };

interface KwameFormAssistantProps {
  category?: string;
  description?: string;
  subject?: string;
  onClose: () => void;
}

export default function KwameFormAssistant({ category, description, subject, onClose }: KwameFormAssistantProps) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi, I'm **Kwame**! I'm here to help you write a clear and effective complaint. Feel free to ask me anything or I can review what you've written so far.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasOfferedHelp = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Proactive help when category is selected
  useEffect(() => {
    if (category && !hasOfferedHelp.current) {
      hasOfferedHelp.current = true;
      const categoryTips: Record<string, string> = {
        academic: "For academic complaints, it helps to mention specific courses, dates, and any relevant grades or assignments.",
        infrastructure: "For facility issues, try to include the exact location, what's broken or unsafe, and when you first noticed it.",
        administrative: "For administrative issues, include reference numbers, dates of interaction, and which office or staff member was involved.",
        other: "Try to be as specific as possible about what happened, when, and who was involved.",
      };
      const tip = categoryTips[category] || categoryTips.other;
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Great, you selected **${category}**. ${tip}`,
      }]);
    }
  }, [category]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setIsLoading(true);

    try {
      const contextNote = description
        ? `\n\n[Context: Student is filling a complaint form. Subject: "${subject || "not set"}". Category: "${category || "not set"}". Current description: "${description}"]`
        : "";

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are Kwame, helping a student improve their complaint form. Give concise writing tips. Do NOT use [SUGGEST_COMPLAINT] here." + contextNote },
            ...newMsgs.slice(-10),
          ],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length === newMsgs.length + 1) {
                  return [...prev.slice(0, -1), { role: "assistant", content: assistantContent }];
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    }
    setIsLoading(false);
  };

  const reviewDescription = () => {
    if (description && description.length >= 10) {
      sendMessage(`Can you review my complaint description and suggest improvements? Here it is: "${description}"`);
    } else {
      sendMessage("Can you help me write a good complaint description?");
    }
  };

  return (
    <Card className="flex h-full flex-col border-l">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">K</div>
          <CardTitle className="text-sm font-semibold">Kwame – Writing Assistant</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">K</div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">K</div>
              <div className="rounded-xl bg-muted px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-3 py-2">
        <Button variant="outline" size="sm" className="mb-2 w-full gap-1.5 text-xs" onClick={reviewDescription} disabled={isLoading}>
          <Lightbulb className="h-3 w-3" /> Review My Description
        </Button>
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Kwame for help..."
            disabled={isLoading}
            className="flex-1 text-sm"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-8 w-8 shrink-0">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
