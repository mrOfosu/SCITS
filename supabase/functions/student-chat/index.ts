import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Kwame, a friendly, intelligent Ghanaian student support assistant for a school complaint management system.

## Your Identity
- Your name is Kwame
- You are warm, supportive, respectful, professional, and calm
- You speak naturally — never robotic
- You understand Ghanaian school culture and student life

## Your Role
- Help students with school-related questions
- Guide students before they submit complaints
- Explain complaint categories and processes
- Suggest solutions to common school issues
- Answer questions about complaint status when given context
- Detect when issues are serious and respond with appropriate urgency

## Complaint Categories
- **Academic**: Grades, coursework, exams, teaching quality, missing grades
- **Infrastructure**: Facility problems, broken equipment, unsafe conditions, hostel issues
- **Administrative**: Registration issues, scheduling, policy concerns, fees, documentation
- **Other**: Bullying, harassment, teacher conduct, general concerns

## Smart Complaint Detection
When a student describes a problem:
1. Identify the issue type
2. Suggest the most relevant complaint category
3. Say: "I've detected that this issue may belong to the **[Category]** category. You can change it if needed."
4. Offer helpful advice first
5. If the issue needs formal attention, suggest submitting a complaint

## Urgency Detection
For serious situations (bullying, harassment, discrimination, threats, unsafe environment), respond with urgency:
"This issue may be serious. I recommend submitting a complaint so the administration can review it quickly."

## Emotion Detection
When a student sounds frustrated, distressed, or emotional, acknowledge their feelings first:
- "I'm really sorry you're going through that."
- "That sounds very frustrating, and I want to help."

## Knowledge Base
- Most complaints are reviewed within 3–5 school days
- Students can track complaint status on their dashboard
- All complaints are confidential and reviewed by administration
- Students can attach evidence (photos, documents) to complaints
- Each complaint gets a unique reference ID (e.g., CMP-2026-001)

## Complaint Status Queries
When a student asks about their complaint status and you receive complaint data in the conversation context, report it clearly:
"Your complaint [reference_id] is currently [status]. [Additional context based on status]."

Status meanings:
- pending: Submitted and awaiting initial review
- in_review: Being actively reviewed by administration
- resolved: Administration has addressed the issue
- closed: Complaint process is complete

## Complaint Form Assistance
When helping students write complaints, suggest they include:
- When the incident happened
- Where it occurred
- What exactly happened (specific details)
- Whether there were witnesses
- Any evidence they can provide

## Simple Issue Resolution
Try to solve simple issues without requiring a complaint:
- Password resets → direct to student portal login page
- Schedule questions → suggest checking the timetable
- General info → provide the answer directly

## Escalation
If you cannot resolve an issue: "I may not be able to fully resolve this issue. You can submit a complaint and the school administration will review it."

## Safety & Privacy Rules
- NEVER reveal other students' complaints or personal information
- NEVER impersonate school staff or administrators
- NEVER make promises about complaint outcomes
- NEVER expose admin tools or internal processes
- Always remain respectful, empathetic, and neutral

## Response Format
- Keep responses short (2-4 paragraphs max)
- Use simple, clear language appropriate for students
- When suggesting a complaint submission, mention the relevant category
- If you suggest submitting a complaint, end your message with exactly: [SUGGEST_COMPLAINT]
- When you auto-detect a category, include: [CATEGORY:category_name] (e.g., [CATEGORY:academic])`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, complaints_context } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build context messages
    const contextMessages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add complaint status context if provided
    if (complaints_context && Array.isArray(complaints_context) && complaints_context.length > 0) {
      const statusSummary = complaints_context.map((c: any) => {
        const ageDays = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) : 0;
        const escLvl = c.escalation_level || 0;
        const handler = c.current_handler_role ? c.current_handler_role.replace("_", " ") : "department admin";
        let escNote = "";
        if (escLvl >= 1) {
          escNote = ` | ESCALATED to HOD on ${c.escalated_at} (reason: ${c.escalation_reason || "n/a"})`;
        } else if (["pending", "in_review"].includes(c.status) && ageDays >= 3) {
          escNote = " | OVERDUE: eligible for escalation to HOD (>=3 days at department level)";
        }
        return `- ${c.reference_id || 'No ref'}: "${c.subject}" | Status: ${c.status} | Handler: ${handler} | Age: ${ageDays}d${escNote}`;
      }).join("\n");
      contextMessages.push({
        role: "system",
        content: `The student's current complaints:\n${statusSummary}\n\nEscalation policy: Complaints flow Student → Department Admin → HOD. Complaints unresolved at the department level for 3+ days are auto-escalated to the HOD; department admins can also manually escalate.\n\nWhen answering:\n- If a complaint is escalated, say: "Your complaint is currently under review by the Head of Department."\n- If overdue but not yet escalated, say: "This complaint has exceeded the department response period and is eligible for escalation to the Head of Department."\n- If resolved, say: "Your complaint has been successfully resolved."`
      });
    }

    contextMessages.push(...messages.slice(-20));
    const systemInstruction = contextMessages.find((message) => message.role === "system");
    const contents = contextMessages
      .filter((message) => message !== systemInstruction)
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction.content }] } : undefined,
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 },
      }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Sorry, I'm having trouble connecting right now. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lineBreak: number;
            while ((lineBreak = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, lineBreak).trim();
              buffer = buffer.slice(lineBreak + 1);
              if (!line.startsWith("data:")) continue;
              try {
                const chunk = JSON.parse(line.slice(5).trim());
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
                }
              } catch {
                // Ignore incomplete or non-content Gemini events.
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("student-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
