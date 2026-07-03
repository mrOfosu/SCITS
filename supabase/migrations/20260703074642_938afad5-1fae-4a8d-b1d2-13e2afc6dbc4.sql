DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update" ON public.complaints
FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR (current_handler_id = auth.uid())
  OR (
    current_handler_role = 'hod'
    AND has_role(auth.uid(), 'hod'::app_role)
    AND (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.faculty_id = complaints.faculty_id)
      OR faculty_id IS NULL
    )
  )
);