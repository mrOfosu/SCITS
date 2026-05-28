
-- Allow super admins to delete profiles
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Allow super admins to delete notifications (for cleanup when scope changes)
CREATE POLICY "Super admins can delete notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Refine new-complaint notification routing:
-- * dept staff for the assigned department
-- * faculty_admin for the complaint's faculty
-- * super_admin/admin
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  submitter_name text;
BEGIN
  SELECT display_name INTO submitter_name FROM public.profiles WHERE id = NEW.user_id;

  -- Department staff for the assigned department
  IF NEW.assigned_department_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM public.department_staff WHERE department_id = NEW.assigned_department_id
        UNION
        SELECT id AS user_id FROM public.profiles WHERE department_id = NEW.assigned_department_id
      ) s
      WHERE EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = s.user_id
          AND ur.role IN ('department_admin','hod')
      )
    LOOP
      INSERT INTO public.notifications (user_id, complaint_id, title, message)
      VALUES (rec.user_id, NEW.id,
        'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
        'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || '.');
    END LOOP;
  END IF;

  -- Faculty admins for the complaint's faculty
  IF NEW.faculty_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'faculty_admin' AND p.faculty_id = NEW.faculty_id
    LOOP
      INSERT INTO public.notifications (user_id, complaint_id, title, message)
      VALUES (rec.user_id, NEW.id,
        'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
        'A new ' || NEW.priority || ' priority complaint was submitted in your faculty by ' || COALESCE(submitter_name, 'a student') || '.');
    END LOOP;
  END IF;

  -- Super admins / admins always
  FOR rec IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('super_admin','admin')
  LOOP
    INSERT INTO public.notifications (user_id, complaint_id, title, message)
    VALUES (rec.user_id, NEW.id,
      'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
      'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || '.');
  END LOOP;

  RETURN NEW;
END;
$function$;
