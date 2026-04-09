import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";

interface FeedbackPromptProps {
  complaintId: string;
  existingFeedback?: boolean | null;
  onFeedbackSubmitted?: () => void;
}

export default function FeedbackPrompt({ complaintId, existingFeedback, onFeedbackSubmitted }: FeedbackPromptProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (existingFeedback !== null && existingFeedback !== undefined) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm">
            You marked this as {existingFeedback ? "resolved" : "not resolved"}.
            {!existingFeedback && " You can reopen this complaint below."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleFeedback = async (satisfied: boolean) => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("complaint_feedback").insert({
      complaint_id: complaintId,
      user_id: user.id,
      satisfied,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: satisfied ? "Glad it's resolved!" : "Sorry to hear that" });
      onFeedbackSubmitted?.();
    }
    setSubmitting(false);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">Was your issue resolved?</p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
            onClick={() => handleFeedback(true)}
            disabled={submitting}
          >
            <ThumbsUp className="h-4 w-4 text-green-600" /> Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
            onClick={() => handleFeedback(false)}
            disabled={submitting}
          >
            <ThumbsDown className="h-4 w-4 text-red-600" /> No
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
