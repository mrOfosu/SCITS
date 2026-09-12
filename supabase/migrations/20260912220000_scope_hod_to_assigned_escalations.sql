-- An HOD may work only the complaints that the escalation workflow assigned
-- to that specific HOD. This prevents one department's HOD queue from
-- exposing another department's escalated complaints.
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
    AND NOT public.has_role(auth.uid(), 'hod'::app_role)
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
    AND current_handler_role = 'hod'
    AND current_handler_id = auth.uid()
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
    AND NOT public.has_role(auth.uid(), 'hod'::app_role)
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
    AND current_handler_role = 'hod'
    AND current_handler_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'faculty_admin'::app_role)
    AND public.is_faculty_admin_for(auth.uid(), faculty_id)
  )
  OR (
    public.has_role(auth.uid(), 'department_admin'::app_role)
    AND NOT public.has_role(auth.uid(), 'hod'::app_role)
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
    AND current_handler_role = 'hod'
    AND current_handler_id = auth.uid()
  )
);
