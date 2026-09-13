-- Department is the source of truth for HOD routing. A faculty match alone
-- must never route an escalated complaint to an HOD.
CREATE OR REPLACE FUNCTION public.hod_for_department(_department_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate.user_id
  FROM (
    -- The HOD's primary profile department is authoritative.
    SELECT p.id AS user_id, 1 AS priority
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'hod'
    WHERE p.department_id = _department_id

    UNION ALL

    -- Retain support for legacy HODs whose profile has no department yet.
    SELECT ds.user_id, 2 AS priority
    FROM public.department_staff ds
    JOIN public.user_roles ur ON ur.user_id = ds.user_id AND ur.role = 'hod'
    JOIN public.profiles p ON p.id = ds.user_id
    WHERE ds.department_id = _department_id
      AND p.department_id IS NULL
  ) AS candidate
  ORDER BY candidate.priority, candidate.user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.hod_for_department(uuid) TO authenticated, service_role;

-- Manual escalation keeps working, but can only route to the HOD of the
-- complaint's assigned department. There is deliberately no faculty/any-HOD
-- fallback: missing department ownership must be fixed, not misrouted.
CREATE OR REPLACE FUNCTION public.escalate_complaint(_complaint_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.complaints%ROWTYPE;
  hod_id uuid;
  prev_handler_id uuid;
  prev_handler_role text;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Escalation reason is required';
  END IF;

  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;

  IF NOT (
    public.is_super_admin(caller)
    OR public.is_dept_staff_for(caller, c.assigned_department_id)
    OR public.is_faculty_admin_for(caller, c.faculty_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to escalate this complaint';
  END IF;

  IF c.escalation_level >= 1 THEN
    RAISE EXCEPTION 'Complaint already escalated to HOD';
  END IF;
  IF c.assigned_department_id IS NULL THEN
    RAISE EXCEPTION 'Complaint has no assigned department';
  END IF;

  hod_id := public.hod_for_department(c.assigned_department_id);
  IF hod_id IS NULL THEN
    RAISE EXCEPTION 'No HOD is assigned to this complaint department';
  END IF;

  prev_handler_id := c.current_handler_id;
  prev_handler_role := COALESCE(c.current_handler_role, 'department_admin');

  UPDATE public.complaints
  SET escalation_level = 1,
      escalated_at = now(),
      escalated_by = caller,
      escalation_reason = _reason,
      current_handler_id = hod_id,
      current_handler_role = 'hod',
      updated_at = now()
  WHERE id = _complaint_id;

  INSERT INTO public.complaint_escalations
    (complaint_id, previous_handler_id, previous_handler_role, new_handler_id, new_handler_role, escalation_reason, escalated_by)
  VALUES (_complaint_id, prev_handler_id, prev_handler_role, hod_id, 'hod', _reason, caller);

  INSERT INTO public.complaint_activity
    (complaint_id, performed_by, action_type, performed_role, old_status, new_status, new_value)
  VALUES (_complaint_id, caller, 'escalated', prev_handler_role, c.status::text, c.status::text,
          jsonb_build_object('reason', _reason, 'new_handler_role', 'hod', 'new_handler_id', hod_id, 'manual', true));

  INSERT INTO public.notifications (user_id, complaint_id, title, message)
  VALUES
    (hod_id, _complaint_id,
      'Complaint Escalated to You: ' || COALESCE(c.reference_id, c.subject),
      'A complaint from your department has been escalated to you as HOD. Reason: ' || _reason),
    (c.user_id, _complaint_id,
      'Complaint Escalated: ' || COALESCE(c.reference_id, c.subject),
      'Your complaint has been escalated to the Head of Department for review.');

  RETURN jsonb_build_object('success', true, 'hod_id', hod_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_complaint(uuid, text) TO authenticated, service_role;

-- Repair all historical manual and automatic escalations whose stored handler
-- does not match the HOD of the complaint's assigned department. No complaint
-- or escalation record is duplicated; only the current owner is corrected.
WITH correct_handlers AS (
  SELECT c.id, public.hod_for_department(c.assigned_department_id) AS hod_id
  FROM public.complaints c
  WHERE c.escalation_level >= 1
    AND c.assigned_department_id IS NOT NULL
)
UPDATE public.complaints c
SET current_handler_id = ch.hod_id,
    current_handler_role = 'hod',
    updated_at = now()
FROM correct_handlers ch
WHERE c.id = ch.id
  AND ch.hod_id IS NOT NULL
  AND c.current_handler_id IS DISTINCT FROM ch.hod_id;

-- HOD visibility and updates are restricted to the escalated complaints
-- currently assigned to that exact HOD.
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
      AND current_handler_id = auth.uid())
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
      AND current_handler_id = auth.uid())
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
      AND current_handler_id = auth.uid())
);
