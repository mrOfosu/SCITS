
-- Add 'closed' to complaint_status enum
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'closed';

-- Create complaint_activity table
CREATE TABLE public.complaint_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_activity ENABLE ROW LEVEL SECURITY;

-- Students see activity for own complaints, admins see all
CREATE POLICY "View activity for own complaints or admin"
  ON public.complaint_activity FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.complaints
      WHERE complaints.id = complaint_activity.complaint_id
        AND complaints.user_id = auth.uid()
    )
  );

-- Only admins can insert activity (done via trigger, but policy needed)
CREATE POLICY "Admins can insert activity"
  ON public.complaint_activity FOR INSERT
  WITH CHECK (auth.uid() = changed_by);

-- Trigger function to validate status transitions and log activity
CREATE OR REPLACE FUNCTION public.validate_complaint_status_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  valid boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check valid transitions
  IF (OLD.status = 'pending' AND NEW.status = 'in_review')
    OR (OLD.status = 'in_review' AND NEW.status = 'resolved')
    OR (OLD.status = 'resolved' AND NEW.status = 'closed')
  THEN
    valid := true;
  END IF;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Log the transition
  INSERT INTO public.complaint_activity (complaint_id, changed_by, old_status, new_status)
  VALUES (NEW.id, auth.uid(), OLD.status::text, NEW.status::text);

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_status_transition
  BEFORE UPDATE OF status ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_complaint_status_transition();
