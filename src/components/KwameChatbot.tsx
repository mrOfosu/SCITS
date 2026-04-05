import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import KwameChatWindow from "@/components/kwame/KwameChatWindow";
import kwameAvatar from "@/assets/kwame-avatar.png";
import type { Tables } from "@/integrations/supabase/types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const CORNER_CLASSES: Record<Corner, string> = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
};

const STORAGE_KEY_CORNER = "kwame-fab-corner";
const STORAGE_KEY_GREETED = "kwame-greeted-session";

function getStoredCorner(): Corner {
  try {
    const v = localStorage.getItem(STORAGE_KEY_CORNER);
    if (v && v in CORNER_CLASSES) return v as Corner;
  } catch {}
  return "bottom-right";
}

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
  initialMessage?: string;
  mode?: "dashboard" | "complaint-form";
}

export default function KwameChatbot({ initialMessage, mode = "dashboard" }: KwameChatbotProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [complaints, setComplaints] = useState<Tables<"complaints">[] | null>(null);
  const [corner, setCorner] = useState<Corner>(getStoredCorner);
  const [showGreeting, setShowGreeting] = useState(false);

  // Build personalized welcome message
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const welcomeContent = displayName
    ? `Hello, **${displayName}**! 👋 I'm **Kwame**, your student support assistant. I can help you solve school-related problems, guide you through submitting complaints, or answer questions about school services.\n\nHow can I help you today?`
    : "Hello! 👋 I'm **Kwame**, your student support assistant. I can help you solve school-related problems, guide you through submitting complaints, or answer questions about school services.\n\nHow can I help you today?";

  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcomeContent, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);

  // Dragging state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Auto-greeting on login (once per session)
  useEffect(() => {
    if (!user) return;
    const key = `${STORAGE_KEY_GREETED}-${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    // Show a toast-like greeting bubble after a brief delay
    const timer = setTimeout(() => setShowGreeting(true), 1500);
    return () => clearTimeout(timer);
  }, [user]);

  // Auto-hide greeting after 6 seconds
  useEffect(() => {
    if (!showGreeting) return;
    const timer = setTimeout(() => setShowGreeting(false), 6000);
    return () => clearTimeout(timer);
  }, [showGreeting]);

  // Update welcome message when user data loads
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === "welcome" ? { ...m, content: welcomeContent } : m))
    );
  }, [welcomeContent]);

  // Fetch student complaints
  useEffect(() => {
    if (!user) return;
    supabase
      .from("complaints")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setComplaints(data || []));
  }, [user]);

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && isOpen && !sentInitial.current && !isLoading) {
      sentInitial.current = true;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage]);

  // --- Drag handlers ---
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) hasMoved.current = true;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!hasMoved.current) return; // was a click, not a drag

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isRight = e.clientX > vw / 2;
    const isBottom = e.clientY > vh / 2;
    const newCorner: Corner = `${isBottom ? "bottom" : "top"}-${isRight ? "right" : "left"}` as Corner;
    setCorner(newCorner);
    try { localStorage.setItem(STORAGE_KEY_CORNER, newCorner); } catch {}
  }, []);

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
    const isLeft = corner.includes("left");
    const isTop = corner.includes("top");

    return (
      <>
        {/* Greeting bubble */}
        {showGreeting && (
          <div
            className={`fixed z-50 max-w-[220px] rounded-xl bg-card border border-border shadow-lg px-3 py-2 text-sm text-foreground animate-fade-in ${
              isTop ? "mt-[4.5rem]" : "mb-[4.5rem]"
            } ${CORNER_CLASSES[corner]}`}
            style={isTop ? { top: undefined, marginTop: "4.5rem" } : { bottom: undefined, marginBottom: "4.5rem" }}
            onClick={() => { setShowGreeting(false); setIsOpen(true); }}
          >
            <p className="font-medium">Hi{displayName ? `, ${displayName}` : ""}! 👋</p>
            <p className="text-muted-foreground text-xs mt-0.5">Need any help? Click me!</p>
          </div>
        )}

        {/* Draggable FAB */}
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => { if (!hasMoved.current) { setShowGreeting(false); setIsOpen(true); } }}
          className={`fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden touch-none select-none ${CORNER_CLASSES[corner]}`}
          aria-label="Open Kwame chat"
        >
          <img src={kwameAvatar} alt="Kwame" className="h-full w-full object-cover pointer-events-none" width={56} height={56} />
        </button>
      </>
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
