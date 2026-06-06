
-- Extend complaints visibility to "current handler" (handles HOD cases with no dept membership)
DROP POLICY IF EXISTS "complaints scoped select" ON public.complaints;
CREATE POLICY "complaints scoped select" ON public.complaints
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR current_handler_id = auth.uid()
  OR (current_handler_role = 'hod' AND has_role(auth.uid(), 'hod'::app_role) AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = complaints.faculty_id)
        OR complaints.faculty_id IS NULL
      ))
);

DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update" ON public.complaints
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR current_handler_id = auth.uid()
);

-- Responses: allow current handler to view & respond
DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can view responses" ON public.complaint_responses
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (c.user_id = auth.uid()
           OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
           OR is_faculty_admin_for(auth.uid(), c.faculty_id)
           OR c.current_handler_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Scoped staff and owners can add responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can add responses" ON public.complaint_responses
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = responder_id
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (c.user_id = auth.uid()
             OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
             OR is_faculty_admin_for(auth.uid(), c.faculty_id)
             OR c.current_handler_id = auth.uid())
    )
  )
);

-- Escalations: extend select & insert to current handler / faculty admin
DROP POLICY IF EXISTS "escalations scoped select" ON public.complaint_escalations;
CREATE POLICY "escalations scoped select" ON public.complaint_escalations
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_escalations.complaint_id
      AND (c.user_id = auth.uid()
           OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
           OR is_faculty_admin_for(auth.uid(), c.faculty_id)
           OR c.current_handler_id = auth.uid())
  )
);

-- escalate_complaint: allow faculty admins / super admins, fall back to faculty HOD / any HOD
CREATE OR REPLACE FUNCTION public.escalate_complaint(_complaint_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  hod_id uuid;
  prev_handler_id uuid;
  prev_handler_role text;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Escalation reason is required';
  END IF;

  SELECT * INTO c FROM public.complaints WHERE id = _complaint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;

  IF NOT (
    is_super_admin(caller)
    OR is_dept_staff_for(caller, c.assigned_department_id)
    OR is_faculty_admin_for(caller, c.faculty_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to escalate this complaint';
  END IF;

  IF c.escalation_level >= 1 THEN
    RAISE EXCEPTION 'Complaint already escalated to HOD';
  END IF;

  -- 1. HOD in the assigned department
  SELECT ur.user_id INTO hod_id
  FROM public.user_roles ur
  LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c.assigned_department_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = c.assigned_department_id
  WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
  LIMIT 1;

  -- 2. Fallback: HOD in the same faculty
  IF hod_id IS NULL AND c.faculty_id IS NOT NULL THEN
    SELECT ur.user_id INTO hod_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'hod' AND p.faculty_id = c.faculty_id
    LIMIT 1;
  END IF;

  -- 3. Fallback: any HOD
  IF hod_id IS NULL THEN
    SELECT user_id INTO hod_id FROM public.user_roles WHERE role = 'hod' LIMIT 1;
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
          jsonb_build_object('reason', _reason, 'new_handler_role', 'hod', 'new_handler_id', hod_id));

  IF hod_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, complaint_id, title, message)
    VALUES (hod_id, _complaint_id,
      'Complaint Escalated to You: ' || COALESCE(c.reference_id, c.subject),
      'A complaint has been escalated to you as HOD. Reason: ' || _reason);
  END IF;

  INSERT INTO public.notifications (user_id, complaint_id, title, message)
  VALUES (c.user_id, _complaint_id,
    'Complaint Escalated: ' || COALESCE(c.reference_id, c.subject),
    'Your complaint has been escalated to the Head of Department for review.');

  RETURN jsonb_build_object('success', true, 'hod_id', hod_id);
END;
$function$;

-- Backfill: set current_handler_id for already-escalated complaints that have no handler
UPDATE public.complaints c
SET current_handler_id = sub.hod_id
FROM (
  SELECT c2.id,
    COALESCE(
      (SELECT ur.user_id FROM public.user_roles ur
        LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c2.assigned_department_id
        LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = c2.assigned_department_id
        WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL) LIMIT 1),
      (SELECT ur.user_id FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'hod' AND p.faculty_id = c2.faculty_id LIMIT 1),
      (SELECT user_id FROM public.user_roles WHERE role = 'hod' LIMIT 1)
    ) AS hod_id
  FROM public.complaints c2
  WHERE c2.escalation_level >= 1 AND c2.current_handler_id IS NULL
) sub
WHERE c.id = sub.id AND sub.hod_id IS NOT NULL;
