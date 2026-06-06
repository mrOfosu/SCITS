
ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS rejected_by uuid;

CREATE OR REPLACE FUNCTION public.validate_complaint_status_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE valid boolean := false; performer_role text := 'student';
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF (OLD.status::text = 'pending' AND NEW.status::text = 'in_review')
    OR (OLD.status::text = 'in_review' AND NEW.status::text = 'resolved')
    OR (OLD.status::text = 'resolved' AND NEW.status::text = 'closed')
    OR (OLD.status::text = 'resolved' AND NEW.status::text = 'in_review')
    OR (OLD.status::text = 'pending' AND NEW.status::text = 'rejected')
    OR (OLD.status::text = 'in_review' AND NEW.status::text = 'rejected')
    OR (OLD.status::text = 'rejected' AND NEW.status::text = 'in_review')
  THEN valid := true; END IF;
  IF NOT valid THEN RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status; END IF;
  IF has_role(auth.uid(), 'admin') THEN performer_role := 'admin'; END IF;
  INSERT INTO public.complaint_activity (complaint_id, performed_by, action_type, performed_role, old_status, new_status, old_value, new_value)
  VALUES (NEW.id, auth.uid(), 'status_change', performer_role, OLD.status::text, NEW.status::text,
          jsonb_build_object('status', OLD.status),
          jsonb_build_object('status', NEW.status, 'rejection_reason', NEW.rejection_reason));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_rejected_at()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status::text = 'rejected' AND (OLD IS NULL OR OLD.status::text IS DISTINCT FROM 'rejected') THEN
    NEW.rejected_at := now();
    NEW.rejected_by := COALESCE(NEW.rejected_by, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_rejected_at_trigger ON public.complaints;
CREATE TRIGGER set_rejected_at_trigger BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_rejected_at();

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE msg text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status::text = 'rejected' THEN
    msg := 'Your complaint was rejected.' ||
      CASE WHEN NEW.rejection_reason IS NOT NULL AND length(NEW.rejection_reason) > 0
           THEN ' Reason: ' || NEW.rejection_reason ELSE '' END;
  ELSE
    msg := 'Your complaint status changed from ' || OLD.status || ' to ' || NEW.status || '.';
  END IF;
  INSERT INTO public.notifications (user_id, complaint_id, title, message)
  VALUES (NEW.user_id, NEW.id, 'Status Updated: ' || COALESCE(NEW.reference_id, NEW.subject), msg)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

UPDATE public.complaints c
SET faculty_id = COALESCE(c.faculty_id, p.faculty_id),
    assigned_department_id = COALESCE(c.assigned_department_id, c.department_id, p.department_id)
FROM public.profiles p
WHERE c.user_id = p.id
  AND (c.faculty_id IS NULL OR c.assigned_department_id IS NULL);
