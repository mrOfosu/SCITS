
DROP POLICY IF EXISTS "Scoped staff and owners can add responses" ON public.complaint_responses;
DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;

CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR c.current_handler_id = auth.uid()
        OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR is_faculty_admin_for(auth.uid(), c.faculty_id)
        OR (has_role(auth.uid(), 'hod'::app_role) AND EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = c.faculty_id
        ))
      )
  )
);

CREATE POLICY "Scoped staff and owners can add responses"
ON public.complaint_responses FOR INSERT
WITH CHECK (
  auth.uid() = responder_id
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (
          c.user_id = auth.uid()
          OR c.current_handler_id = auth.uid()
          OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR is_faculty_admin_for(auth.uid(), c.faculty_id)
          OR (has_role(auth.uid(), 'hod'::app_role) AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = c.faculty_id
          ))
        )
    )
  )
);
