import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import KwameChatWindow from "@/components/kwame/KwameChatWindow";
import { MessageCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-chat`;

async function streamChat(
  messages: { role: string; content: string }[],
  complaintsContext: Tables<"complaints">[] | null,
  onDelta: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal
) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages,
      complaints_context: complaintsContext?.map((c) => ({
        reference_id: c.reference_id,
        subject: c.subject,
        status: c.status,
        category: c.category,
        priority: c.priority,
        created_at: c.created_at,
      })) || [],
    }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ") || line.trim() === "" || line.startsWith(":")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone();
}

interface KwameChatbotProps {
  /** Pre-fill a message on open (e.g., from complaint form) */
  initialMessage?: string;
  /** Context mode: "dashboard" | "complaint-form" */
  mode?: "dashboard" | "complaint-form";
}

export default function KwameChatbot({ initialMessage, mode = "dashboard" }: KwameChatbotProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [complaints, setComplaints] = useState<Tables<"complaints">[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! 👋 I'm **Kwame**, your student support assistant. I can help you solve school-related problems, guide you through submitting complaints, or answer questions about school services.\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);

  // Fetch student complaints for status queries
  useEffect(() => {
    if (!user) return;
    supabase
      .from("complaints")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setComplaints(data || []));
  }, [user]);

  // Send initial message if provided (complaint form assistance)
  useEffect(() => {
    if (initialMessage && isOpen && !sentInitial.current && !isLoading) {
      sentInitial.current = true;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    let assistantContent = "";
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        history,
        complaints,
        (delta) => {
          assistantContent += delta;
          const cleaned = assistantContent
            .replace(/\[SUGGEST_COMPLAINT\]/g, "")
            .replace(/\[CATEGORY:\w+\]/g, "")
            .trimEnd();
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return prev.map((m) => (m.id === assistantId ? { ...m, content: cleaned } : m));
            }
            return [...prev, { id: assistantId, role: "assistant", content: cleaned, timestamp: new Date() }];
          });
        },
        () => setIsLoading(false),
        controller.signal
      );
    } catch (e: any) {
      if (e.name !== "AbortError") {
        const { toast } = await import("@/hooks/use-toast");
        toast({ title: "Chat Error", description: e.message, variant: "destructive" });
      }
      setIsLoading(false);
    }
    abortRef.current = null;
  }, [messages, isLoading, complaints]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open Kwame chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <KwameChatWindow
      messages={messages}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
      onClose={() => setIsOpen(false)}
      onSend={sendMessage}
      onNavigateSubmit={() => navigate("/submit")}
      mode={mode}
    />
  );
}
