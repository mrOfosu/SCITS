import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaint_id } = await req.json();
    if (!complaint_id) {
      return new Response(JSON.stringify({ error: "complaint_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: complaint, error: fetchErr } = await supabase
      .from("complaints")
      .select("subject, description, category, priority, sub_category")
      .eq("id", complaint_id)
      .single();

    if (fetchErr || !complaint) {
      return new Response(JSON.stringify({ error: "Complaint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `You are an AI assistant that generates concise summaries of student complaints for school administrators. Generate a structured summary with:
- **Category**: The complaint category
- **Severity**: Low, Medium, or High based on the content
- **Key Issue**: A one-sentence summary of the core problem
- **Recommended Action**: A brief suggestion for the admin

Keep it under 4 lines. Be factual and neutral.` }] },
        contents: [{
          role: "user",
          parts: [{ text: `Summarize this complaint:\n\nSubject: ${complaint.subject}\nCategory: ${complaint.category}\nSub-category: ${complaint.sub_category || "N/A"}\nPriority: ${complaint.priority}\n\nDescription:\n${complaint.description}` }],
        }],
      }),
      },
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI summary error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Failed to generate summary" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const summary = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Summary unavailable.";

    // Store summary in the complaints table
    const { error: updateErr } = await supabase
      .from("complaints")
      .update({ ai_summary: summary })
      .eq("id", complaint_id);

    if (updateErr) console.error("Failed to store AI summary:", updateErr);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
