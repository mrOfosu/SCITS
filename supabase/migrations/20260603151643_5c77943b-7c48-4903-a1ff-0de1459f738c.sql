
DROP POLICY IF EXISTS "Admins and complaint owners can add responses" ON public.complaint_responses;
DROP POLICY IF EXISTS "View responses for own complaints or admin" ON public.complaint_responses;

CREATE POLICY "Scoped staff and owners can add responses"
ON public.complaint_responses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = responder_id AND (
    public.is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (
          c.user_id = auth.uid()
          OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
    )
  )
);

CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
      )
  )
);
