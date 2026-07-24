import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Star, CheckCircle2 } from "lucide-react";

interface FeedbackPromptProps {
  complaintId: string;
  existingFeedback?: boolean | null;
  existingRating?: number | null;
  onFeedbackSubmitted?: () => void;
}

export default function FeedbackPrompt({ complaintId, existingFeedback, existingRating, onFeedbackSubmitted }: FeedbackPromptProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");

  if (existingFeedback !== null && existingFeedback !== undefined) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="flex items-start gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Thanks for your feedback!
            </p>
            <p className="text-xs text-muted-foreground">
              You rated this resolution{existingRating ? ` ${existingRating}/5` : ""} — marked as {existingFeedback ? "resolved" : "not resolved"}.
              {!existingFeedback && " You can reopen this complaint below."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const submit = async (satisfied: boolean) => {
    if (!user) return;
    if (rating === 0) {
      toast({ title: "Please rate the resolution", description: "Tap a star from 1 to 5.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("complaint_feedback").insert({
      complaint_id: complaintId,
      user_id: user.id,
      satisfied,
      rating,
      comment: comment.trim() || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: satisfied ? "Glad it's resolved!" : "Feedback recorded" });
      onFeedbackSubmitted?.();
    }
    setSubmitting(false);
  };

  const active = hover || rating;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Rate how this was resolved</p>
          <p className="text-xs text-muted-foreground">
            Your rating helps the department improve its service quality.
          </p>
        </div>

        <div className="flex items-center gap-1" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                className={`h-6 w-6 ${
                  n <= active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">{rating}/5</span>
          )}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: tell us more about your experience..."
          rows={2}
          className="text-sm"
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => submit(true)}
            disabled={submitting}
          >
            Issue was resolved
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => submit(false)}
            disabled={submitting}
          >
            Not resolved
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
