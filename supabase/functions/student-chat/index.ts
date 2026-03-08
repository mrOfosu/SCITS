import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a friendly, professional AI Student Support Assistant for a school complaint management system. Your name is "SchoolBot".

## Your Role
- Help students with school-related questions
- Guide students before they submit complaints
- Explain complaint categories and processes
- Suggest solutions to common school issues
- If an issue can't be resolved through advice, guide the student to submit a formal complaint

## Complaint Categories
- **Academic**: Issues related to grades, coursework, exams, teaching quality
- **Infrastructure**: Facility problems, broken equipment, unsafe conditions
- **Administrative**: Registration issues, scheduling, policy concerns
- **Other**: Bullying, harassment, teacher conduct, general concerns

## Behavior Rules
- NEVER reveal other students' complaints or personal information
- NEVER impersonate school staff or administrators
- NEVER make promises about complaint outcomes
- Always remain respectful, empathetic, and neutral
- Keep responses concise and student-friendly
- When a student describes a serious issue (bullying, harassment, safety), always recommend submitting a formal complaint
- Use encouraging, supportive language

## Response Format
- Keep responses short (2-4 paragraphs max)
- Use simple, clear language appropriate for students
- When suggesting a complaint submission, mention the relevant category
- If you suggest submitting a complaint, end your message with exactly: [SUGGEST_COMPLAINT]
- If the student asks about a specific category, you can mention it naturally

## Example Interactions
Student: "My teacher keeps insulting students in class"
You: "I'm sorry to hear you're going through that. No student should experience disrespectful behavior from a teacher. This sounds like it could fall under **Teacher Conduct** or potentially **Bullying** if it's targeted.

I'd recommend submitting a formal complaint so the school administration can look into this properly. Would you like to do that? [SUGGEST_COMPLAINT]"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-20), // Keep last 20 messages for context
        ],
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
