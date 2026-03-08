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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context messages
    const contextMessages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add complaint status context if provided
    if (complaints_context && Array.isArray(complaints_context) && complaints_context.length > 0) {
      const statusSummary = complaints_context.map((c: any) =>
        `- ${c.reference_id || 'No ref'}: "${c.subject}" | Status: ${c.status} | Category: ${c.category} | Priority: ${c.priority} | Submitted: ${c.created_at}`
      ).join("\n");
      contextMessages.push({
        role: "system",
        content: `The student's current complaints:\n${statusSummary}\n\nUse this data to answer questions about their complaint status.`
      });
    }

    contextMessages.push(...messages.slice(-20));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: contextMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm receiving too many requests right now. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits have been exhausted. Please contact your administrator." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Sorry, I'm having trouble connecting right now. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("student-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
