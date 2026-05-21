
-- Add resolved_at column to track when a complaint was resolved
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;

-- Backfill existing resolved complaints using updated_at as a best-effort timestamp
UPDATE public.complaints SET resolved_at = updated_at WHERE status = 'resolved' AND resolved_at IS NULL;

-- Trigger function to maintain resolved_at
CREATE OR REPLACE FUNCTION public.set_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_resolved_at ON public.complaints;
CREATE TRIGGER trg_set_resolved_at
BEFORE INSERT OR UPDATE OF status ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_resolved_at();

-- Allow students to delete their own complaints 7+ days after resolution
CREATE POLICY "Students can delete own complaints 7 days after resolved"
ON public.complaints
FOR DELETE
USING (
  auth.uid() = user_id
  AND status = 'resolved'
  AND resolved_at IS NOT NULL
  AND resolved_at <= now() - interval '7 days'
);

-- Also allow admins to delete (useful for cleanup)
CREATE POLICY "Admins can delete complaints"
ON public.complaints
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Clean up related records when a complaint is deleted
CREATE OR REPLACE FUNCTION public.cleanup_complaint_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.complaint_responses WHERE complaint_id = OLD.id;
  DELETE FROM public.complaint_activity WHERE complaint_id = OLD.id;
  DELETE FROM public.complaint_bookmarks WHERE complaint_id = OLD.id;
  DELETE FROM public.complaint_feedback WHERE complaint_id = OLD.id;
  DELETE FROM public.notifications WHERE complaint_id = OLD.id;
  DELETE FROM public.notification_log WHERE complaint_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_complaint_children ON public.complaints;
CREATE TRIGGER trg_cleanup_complaint_children
BEFORE DELETE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.cleanup_complaint_children();
