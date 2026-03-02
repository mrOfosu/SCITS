
-- Trigger: notify admins in-app when a new complaint is created
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  submitter_name text;
BEGIN
  -- Get submitter name
  SELECT display_name INTO submitter_name FROM public.profiles WHERE id = NEW.user_id;

  -- Create in-app notification for each admin
  FOR admin_record IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, complaint_id, title, message)
    VALUES (
      admin_record.user_id,
      NEW.id,
      'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
      'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || ' in ' || NEW.category || '.'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_complaint();
