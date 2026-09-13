-- Keep existing escalations accurate when a staff account is reassigned to a
-- different HOD department. The complaint's selected/assigned department
-- remains the source of truth, never the HOD's previous assignment.
CREATE OR REPLACE FUNCTION public.reconcile_escalated_hod_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.complaints c
  SET current_handler_id = public.hod_for_department(c.assigned_department_id),
      current_handler_role = CASE
        WHEN public.hod_for_department(c.assigned_department_id) IS NULL THEN NULL
        ELSE 'hod'
      END,
      updated_at = now()
  WHERE c.escalation_level >= 1
    AND c.assigned_department_id IS NOT NULL
    AND (
      c.current_handler_id IS DISTINCT FROM public.hod_for_department(c.assigned_department_id)
      OR c.current_handler_role IS DISTINCT FROM CASE
        WHEN public.hod_for_department(c.assigned_department_id) IS NULL THEN NULL
        ELSE 'hod'
      END
    );
END;
$$;

-- Repair any historical rows that could not be assigned when the earlier
-- backfill ran before the appropriate HOD account was configured.
SELECT public.reconcile_escalated_hod_assignments();

CREATE OR REPLACE FUNCTION public.trigger_reconcile_escalated_hod_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.reconcile_escalated_hod_assignments();
  RETURN NULL;
END;
$$;

-- Reconcile after an HOD role is added, removed, or changed.
DROP TRIGGER IF EXISTS trg_reconcile_hod_escalations_on_role_change ON public.user_roles;
CREATE TRIGGER trg_reconcile_hod_escalations_on_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_reconcile_escalated_hod_assignments();

-- Reconcile after the User Management page changes a staff member's primary
-- department. This prevents a reassigned HOD retaining the old department's
-- complaint queue.
DROP TRIGGER IF EXISTS trg_reconcile_hod_escalations_on_department_change ON public.profiles;
CREATE TRIGGER trg_reconcile_hod_escalations_on_department_change
AFTER UPDATE OF department_id ON public.profiles
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_reconcile_escalated_hod_assignments();

DROP POLICY IF EXISTS "complaints scoped select" ON public.complaints;
CREATE POLICY "complaints scoped select"
ON public.complaints FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'faculty_admin'::app_role)
      AND public.is_faculty_admin_for(auth.uid(), faculty_id))
  OR (public.has_role(auth.uid(), 'department_admin'::app_role)
      AND NOT public.has_role(auth.uid(), 'hod'::app_role)
      AND public.is_dept_staff_for(auth.uid(), assigned_department_id))
  OR (public.has_role(auth.uid(), 'hod'::app_role)
      AND escalation_level >= 1
      AND current_handler_role = 'hod'
      AND current_handler_id = auth.uid()
      AND public.hod_for_department(assigned_department_id) = auth.uid())
);

DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update"
ON public.complaints FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'faculty_admin'::app_role)
      AND public.is_faculty_admin_for(auth.uid(), faculty_id))
  OR (public.has_role(auth.uid(), 'department_admin'::app_role)
      AND NOT public.has_role(auth.uid(), 'hod'::app_role)
      AND public.is_dept_staff_for(auth.uid(), assigned_department_id))
  OR (public.has_role(auth.uid(), 'hod'::app_role)
      AND escalation_level >= 1
      AND current_handler_role = 'hod'
      AND current_handler_id = auth.uid()
      AND public.hod_for_department(assigned_department_id) = auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'faculty_admin'::app_role)
      AND public.is_faculty_admin_for(auth.uid(), faculty_id))
  OR (public.has_role(auth.uid(), 'department_admin'::app_role)
      AND NOT public.has_role(auth.uid(), 'hod'::app_role)
      AND public.is_dept_staff_for(auth.uid(), assigned_department_id))
  OR (public.has_role(auth.uid(), 'hod'::app_role)
      AND escalation_level >= 1
      AND current_handler_role = 'hod'
      AND current_handler_id = auth.uid()
      AND public.hod_for_department(assigned_department_id) = auth.uid())
);
