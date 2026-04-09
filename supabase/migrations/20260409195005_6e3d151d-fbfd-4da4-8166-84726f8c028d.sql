
-- Add new columns to complaints
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS assigned_admin_id uuid,
ADD COLUMN IF NOT EXISTS estimated_resolution_hours integer,
ADD COLUMN IF NOT EXISTS has_new_updates boolean NOT NULL DEFAULT false;

-- Create complaint_feedback table
CREATE TABLE public.complaint_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  satisfied boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);

ALTER TABLE public.complaint_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own feedback"
ON public.complaint_feedback FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can insert feedback on own complaints"
ON public.complaint_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM complaints WHERE id = complaint_id AND user_id = auth.uid()
));

-- Create complaint_bookmarks table
CREATE TABLE public.complaint_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, user_id)
);

ALTER TABLE public.complaint_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bookmarks select"
ON public.complaint_bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users manage own bookmarks insert"
ON public.complaint_bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bookmarks delete"
ON public.complaint_bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- Update status transition to allow reopen (resolved -> in_review)
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
    OR (OLD.status = 'resolved' AND NEW.status = 'in_review')
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

-- Trigger to mark complaint as having new updates when a response is added
CREATE OR REPLACE FUNCTION public.mark_complaint_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.complaints SET has_new_updates = true WHERE id = NEW.complaint_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_response_mark_updated
AFTER INSERT ON public.complaint_responses
FOR EACH ROW
EXECUTE FUNCTION public.mark_complaint_updated();

-- Set estimated resolution hours based on priority via trigger
CREATE OR REPLACE FUNCTION public.set_estimated_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estimated_resolution_hours IS NULL THEN
    CASE NEW.priority
      WHEN 'high' THEN NEW.estimated_resolution_hours := 24;
      WHEN 'medium' THEN NEW.estimated_resolution_hours := 72;
      WHEN 'low' THEN NEW.estimated_resolution_hours := 168;
      ELSE NEW.estimated_resolution_hours := 72;
    END CASE;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_resolution_estimate
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.set_estimated_resolution();
