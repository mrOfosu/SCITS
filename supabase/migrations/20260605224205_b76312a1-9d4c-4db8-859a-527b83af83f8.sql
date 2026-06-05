
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS current_handler_id uuid,
  ADD COLUMN IF NOT EXISTS current_handler_role text;

CREATE TABLE IF NOT EXISTS public.complaint_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  previous_handler_id uuid,
  previous_handler_role text,
  new_handler_id uuid,
  new_handler_role text NOT NULL,
  escalation_reason text NOT NULL,
  escalated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.complaint_escalations TO authenticated;
GRANT ALL ON public.complaint_escalations TO service_role;

ALTER TABLE public.complaint_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escalations scoped select" ON public.complaint_escalations;
CREATE POLICY "escalations scoped select"
  ON public.complaint_escalations FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_escalations.complaint_id
        AND (
          c.user_id = auth.uid()
          OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
    )
  );

DROP POLICY IF EXISTS "escalations insert by staff" ON public.complaint_escalations;
CREATE POLICY "escalations insert by staff"
  ON public.complaint_escalations FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_escalations.complaint_id
        AND (
          is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.is_hod_for(_user_id uuid, _dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _dept IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = _dept
    LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = _dept
    WHERE ur.user_id = _user_id AND ur.role = 'hod'
      AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.set_initial_handler()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE handler uuid;
BEGIN
  IF NEW.current_handler_role IS NULL THEN
    NEW.current_handler_role := 'department_admin';
  END IF;
  IF NEW.current_handler_id IS NULL AND NEW.assigned_department_id IS NOT NULL THEN
    SELECT ur.user_id INTO handler
    FROM public.user_roles ur
    LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = NEW.assigned_department_id
    LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = NEW.assigned_department_id
    WHERE ur.role = 'department_admin' AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
    LIMIT 1;
    NEW.current_handler_id := handler;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_initial_handler ON public.complaints;
CREATE TRIGGER trg_set_initial_handler
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_initial_handler();

CREATE OR REPLACE FUNCTION public.escalate_complaint(_complaint_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  SELECT ur.user_id INTO hod_id
  FROM public.user_roles ur
  LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c.assigned_department_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = c.assigned_department_id
  WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
  LIMIT 1;

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
$$;

GRANT EXECUTE ON FUNCTION public.escalate_complaint(uuid, text) TO authenticated, service_role;

UPDATE public.complaints
SET current_handler_role = CASE WHEN escalation_level >= 1 THEN 'hod' ELSE 'department_admin' END
WHERE current_handler_role IS NULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_escalations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
