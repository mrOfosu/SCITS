
-- 1) Allow students to delete their own complaints when closed (in addition to resolved+7d)
DROP POLICY IF EXISTS "Students can delete own complaints 7 days after resolved" ON public.complaints;

CREATE POLICY "Students can delete own complaints"
ON public.complaints
FOR DELETE
USING (
  auth.uid() = user_id
  AND (
    status = 'closed'::complaint_status
    OR (
      status = 'resolved'::complaint_status
      AND resolved_at IS NOT NULL
      AND resolved_at <= (now() - interval '7 days')
    )
  )
);

-- 2) Extend complaint_feedback with rating + comment (nullable)
ALTER TABLE public.complaint_feedback
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS comment text;

ALTER TABLE public.complaint_feedback
  DROP CONSTRAINT IF EXISTS complaint_feedback_rating_check;

ALTER TABLE public.complaint_feedback
  ADD CONSTRAINT complaint_feedback_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
