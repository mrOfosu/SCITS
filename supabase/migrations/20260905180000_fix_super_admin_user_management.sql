-- Allow Super Admins to manage every role, including the admin role.
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Super admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Allow Super Admins to update profiles and remove public access records.
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete profiles" ON public.profiles;
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Keep faculty-admin visibility limited to complaints in the assigned faculty.
DROP POLICY IF EXISTS "complaints scoped select" ON public.complaints;
CREATE POLICY "complaints scoped select"
ON public.complaints
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR public.is_dept_staff_for(auth.uid(), assigned_department_id)
  OR public.is_faculty_admin_for(auth.uid(), faculty_id)
  OR current_handler_id = auth.uid()
  OR (
    current_handler_role = 'hod'
    AND public.has_role(auth.uid(), 'hod'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.faculty_id = public.complaints.faculty_id OR public.complaints.faculty_id IS NULL)
    )
  )
);

-- Prevent faculty admins from reading unrelated response and escalation records.
DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR c.current_handler_id = auth.uid()
        OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
      )
  )
);

DROP POLICY IF EXISTS "escalations scoped select" ON public.complaint_escalations;
CREATE POLICY "escalations scoped select"
ON public.complaint_escalations
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_escalations.complaint_id
      AND (
        c.user_id = auth.uid()
        OR c.current_handler_id = auth.uid()
        OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
      )
  )
);
