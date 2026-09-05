-- General admins and Super Admins see all complaints.
-- Faculty admins see their faculty only.
-- Department admins see their assigned department only.
-- HODs see only escalated complaints assigned to them.
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
    AND public.is_dept_staff_for(auth.uid(), assigned_department_id)
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND escalation_level >= 1
    AND current_handler_id = auth.uid()
  )
);

-- HODs should not receive ordinary new-complaint notifications.
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  submitter_name text;
BEGIN
  SELECT display_name INTO submitter_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Department admins for the assigned department, excluding HODs.
  IF NEW.assigned_department_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT s.user_id
      FROM (
        SELECT ds.user_id
        FROM public.department_staff ds
        WHERE ds.department_id = NEW.assigned_department_id
        UNION
        SELECT p.id
        FROM public.profiles p
        WHERE p.department_id = NEW.assigned_department_id
      ) s
      WHERE EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = s.user_id
          AND ur.role = 'department_admin'
      )
    LOOP
      INSERT INTO public.notifications (user_id, complaint_id, title, message)
      VALUES (
        rec.user_id,
        NEW.id,
        'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
        'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || '.'
      );
    END LOOP;
  END IF;

  -- Faculty admins for the complaint faculty.
  IF NEW.faculty_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'faculty_admin'
        AND p.faculty_id = NEW.faculty_id
    LOOP
      INSERT INTO public.notifications (user_id, complaint_id, title, message)
      VALUES (
        rec.user_id,
        NEW.id,
        'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
        'A new ' || NEW.priority || ' priority complaint was submitted in your faculty by ' || COALESCE(submitter_name, 'a student') || '.'
      );
    END LOOP;
  END IF;

  -- General admins and Super Admins receive every new complaint.
  FOR rec IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO public.notifications (user_id, complaint_id, title, message)
    VALUES (
      rec.user_id,
      NEW.id,
      'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
      'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || '.'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR (
          public.has_role(auth.uid(), 'faculty_admin'::app_role)
          AND public.is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
        OR (
          public.has_role(auth.uid(), 'department_admin'::app_role)
          AND public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        )
        OR (
          public.has_role(auth.uid(), 'hod'::app_role)
          AND c.escalation_level >= 1
          AND c.current_handler_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Scoped staff and owners can add responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can add responses"
ON public.complaint_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = responder_id
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (
          c.user_id = auth.uid()
          OR (
            public.has_role(auth.uid(), 'faculty_admin'::app_role)
            AND public.is_faculty_admin_for(auth.uid(), c.faculty_id)
          )
          OR (
            public.has_role(auth.uid(), 'department_admin'::app_role)
            AND public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
          )
          OR (
            public.has_role(auth.uid(), 'hod'::app_role)
            AND c.escalation_level >= 1
            AND c.current_handler_id = auth.uid()
          )
        )
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
        OR (
          public.has_role(auth.uid(), 'faculty_admin'::app_role)
          AND public.is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
        OR (
          public.has_role(auth.uid(), 'department_admin'::app_role)
          AND public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        )
        OR (
          public.has_role(auth.uid(), 'hod'::app_role)
          AND c.escalation_level >= 1
          AND c.current_handler_id = auth.uid()
        )
      )
  )
);
