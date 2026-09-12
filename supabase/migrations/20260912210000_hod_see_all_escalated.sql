-- Allow HODs to see ALL escalated complaints (escalation_level >= 1), not just those assigned to them
DROP POLICY IF EXISTS "complaints scoped select" ON public.complaints;
CREATE POLICY "complaints scoped select"
ON public.complaints
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'faculty_admin'::app_role)
    AND public.is_faculty_admin_for(auth.uid(), faculty_id)
  )
  OR (
    public.has_role(auth.uid(), 'department_admin'::app_role)
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
  )
);

DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update"
ON public.complaints
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'faculty_admin'::app_role)
    AND public.is_faculty_admin_for(auth.uid(), faculty_id)
  )
  OR (
    public.has_role(auth.uid(), 'department_admin'::app_role)
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
    AND current_handler_id = auth.uid()
  )
);