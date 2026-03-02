
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- Trigger: create notification on status change
CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, complaint_id, title, message)
  VALUES (
    NEW.user_id,
    NEW.id,
    'Status Updated: ' || COALESCE(NEW.reference_id, NEW.subject),
    'Your complaint status changed from ' || OLD.status || ' to ' || NEW.status || '.'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_on_status_change();

-- Trigger: create notification on admin response
CREATE OR REPLACE FUNCTION public.notify_on_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  complaint_owner_id uuid;
  complaint_ref text;
  complaint_subject text;
  is_admin boolean;
BEGIN
  SELECT user_id, reference_id, subject INTO complaint_owner_id, complaint_ref, complaint_subject
  FROM public.complaints WHERE id = NEW.complaint_id;

  SELECT has_role(NEW.responder_id, 'admin') INTO is_admin;

  -- Only notify if responder is admin (student gets notified of admin reply)
  IF is_admin AND complaint_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, complaint_id, title, message)
    VALUES (
      complaint_owner_id,
      NEW.complaint_id,
      'New Response: ' || COALESCE(complaint_ref, complaint_subject),
      'An admin responded to your complaint: ' || LEFT(NEW.message, 100)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_response
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_response();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
