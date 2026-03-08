
-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Admins and complaint owners can add responses" ON public.complaint_responses;

CREATE POLICY "Admins and complaint owners can add responses"
ON public.complaint_responses
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = responder_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM complaints
      WHERE complaints.id = complaint_responses.complaint_id
        AND complaints.user_id = auth.uid()
    )
  )
);
