-- Students retain access to their own review. Review analytics are reserved
-- for the Super Admin role; normal admins do not receive table-wide access.
DROP POLICY IF EXISTS "Students can view own feedback" ON public.complaint_feedback;
CREATE POLICY "Students and super admins can view feedback"
ON public.complaint_feedback FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
