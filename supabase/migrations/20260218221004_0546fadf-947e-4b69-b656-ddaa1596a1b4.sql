
-- Add new columns to complaint_activity table
ALTER TABLE public.complaint_activity
  ADD COLUMN action_type text NOT NULL DEFAULT 'status_change',
  ADD COLUMN performed_role text NOT NULL DEFAULT 'admin',
  ADD COLUMN old_value jsonb,
  ADD COLUMN new_value jsonb;

-- Rename changed_by to performed_by for clarity
ALTER TABLE public.complaint_activity RENAME COLUMN changed_by TO performed_by;

-- Backfill existing rows
UPDATE public.complaint_activity
SET action_type = 'status_change',
    old_value = jsonb_build_object('status', old_status),
    new_value = jsonb_build_object('status', new_status);

-- Update the status transition trigger to use new columns
CREATE OR REPLACE FUNCTION public.validate_complaint_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  valid boolean := false;
  performer_role text := 'student';
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'pending' AND NEW.status = 'in_review')
    OR (OLD.status = 'in_review' AND NEW.status = 'resolved')
    OR (OLD.status = 'resolved' AND NEW.status = 'closed')
  THEN
    valid := true;
  END IF;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  IF has_role(auth.uid(), 'admin') THEN
    performer_role := 'admin';
  END IF;

  INSERT INTO public.complaint_activity (complaint_id, performed_by, action_type, performed_role, old_status, new_status, old_value, new_value)
  VALUES (NEW.id, auth.uid(), 'status_change', performer_role, OLD.status::text, NEW.status::text,
          jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));

  RETURN NEW;
END;
$function$;

-- Trigger: log complaint creation
CREATE OR REPLACE FUNCTION public.log_complaint_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.complaint_activity (complaint_id, performed_by, action_type, performed_role, old_status, new_status, new_value)
  VALUES (NEW.id, NEW.user_id, 'complaint_created', 'student', '', NEW.status::text,
          jsonb_build_object('subject', NEW.subject, 'category', NEW.category, 'priority', NEW.priority::text));
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_complaint_created
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.log_complaint_created();

-- Trigger: log admin response added
CREATE OR REPLACE FUNCTION public.log_response_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  performer_role text := 'student';
BEGIN
  IF has_role(NEW.responder_id, 'admin') THEN
    performer_role := 'admin';
  END IF;

  INSERT INTO public.complaint_activity (complaint_id, performed_by, action_type, performed_role, old_status, new_status, new_value)
  VALUES (NEW.complaint_id, NEW.responder_id, 'response_added', performer_role, '', '',
          jsonb_build_object('message_preview', LEFT(NEW.message, 100)));
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_response_added
AFTER INSERT ON public.complaint_responses
FOR EACH ROW
EXECUTE FUNCTION public.log_response_added();

-- Update RLS: students see limited activity, admins see all
DROP POLICY IF EXISTS "View activity for own complaints or admin" ON public.complaint_activity;
DROP POLICY IF EXISTS "Admins can insert activity" ON public.complaint_activity;

-- Admins see all activity for all complaints
CREATE POLICY "Admins see all activity"
ON public.complaint_activity
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Students see limited activity types on their own complaints
CREATE POLICY "Students see limited activity on own complaints"
ON public.complaint_activity
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM complaints
    WHERE complaints.id = complaint_activity.complaint_id
      AND complaints.user_id = auth.uid()
  )
  AND (
    action_type IN ('status_change', 'response_added')
    OR performed_by = auth.uid()
  )
);

-- Allow triggers (security definer) to insert
CREATE POLICY "System can insert activity"
ON public.complaint_activity
FOR INSERT
WITH CHECK (true);
