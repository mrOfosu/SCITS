
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.complaint_category AS ENUM ('academic', 'infrastructure', 'administrative', 'other');
CREATE TYPE public.complaint_status AS ENUM ('pending', 'in_review', 'resolved');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Complaints table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category complaint_category NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status complaint_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Complaint responses table
CREATE TABLE public.complaint_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_responses ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies: profiles
CREATE POLICY "Anyone authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies: user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: complaints
CREATE POLICY "Students see own complaints, admins see all"
  ON public.complaints FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can submit complaints"
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update any complaint, students own"
  ON public.complaints FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies: complaint_responses
CREATE POLICY "View responses for own complaints or admin"
  ON public.complaint_responses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.complaints WHERE id = complaint_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins and complaint owners can add responses"
  ON public.complaint_responses FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = responder_id AND (
      public.has_role(auth.uid(), 'admin') OR
      EXISTS (SELECT 1 FROM public.complaints WHERE id = complaint_id AND user_id = auth.uid())
    )
  );


-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS student_id text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Add unique constraint on student_id
CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique ON public.profiles(student_id) WHERE student_id IS NOT NULL;


-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Students see own complaints, admins see all" ON public.complaints;
DROP POLICY IF EXISTS "Authenticated users can submit complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update any complaint, students own" ON public.complaints;

-- Recreate as permissive policies
CREATE POLICY "Students see own complaints, admins see all"
ON public.complaints FOR SELECT
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can submit complaints"
ON public.complaints FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any complaint, students own"
ON public.complaints FOR UPDATE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Also fix complaint_responses
DROP POLICY IF EXISTS "View responses for own complaints or admin" ON public.complaint_responses;
DROP POLICY IF EXISTS "Admins and complaint owners can add responses" ON public.complaint_responses;

CREATE POLICY "View responses for own complaints or admin"
ON public.complaint_responses FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM complaints WHERE complaints.id = complaint_responses.complaint_id AND complaints.user_id = auth.uid()
));

CREATE POLICY "Admins and complaint owners can add responses"
ON public.complaint_responses FOR INSERT
WITH CHECK ((auth.uid() = responder_id) AND (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM complaints WHERE complaints.id = complaint_responses.complaint_id AND complaints.user_id = auth.uid()
)));

-- Fix user_roles and profiles too
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = user_id));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Anyone authenticated can view profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

ALTER TABLE public.complaints DROP CONSTRAINT complaints_user_id_fkey;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Add priority enum
CREATE TYPE public.complaint_priority AS ENUM ('low', 'medium', 'high');

-- Add new columns to complaints
ALTER TABLE public.complaints
  ADD COLUMN priority complaint_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN reference_id text UNIQUE,
  ADD COLUMN sub_category text,
  ADD COLUMN attachment_url text;

-- Create function to generate reference IDs
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year text;
  seq_num integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO seq_num
  FROM complaints
  WHERE reference_id LIKE 'CMP-' || current_year || '-%';
  NEW.reference_id := 'CMP-' || current_year || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate reference_id on insert
CREATE TRIGGER set_complaint_reference
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.generate_complaint_reference();

-- Backfill existing complaints with reference IDs
UPDATE public.complaints SET reference_id = 'CMP-2026-001' WHERE id = (SELECT id FROM complaints ORDER BY created_at ASC LIMIT 1 OFFSET 0) AND reference_id IS NULL;
UPDATE public.complaints SET reference_id = 'CMP-2026-002' WHERE id = (SELECT id FROM complaints ORDER BY created_at ASC LIMIT 1 OFFSET 1) AND reference_id IS NULL;

-- Create storage bucket for complaint attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-attachments', 'complaint-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'complaint-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-attachments' AND auth.uid() IS NOT NULL);


CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  seq_num integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_id FROM 'CMP-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_num
  FROM complaints
  WHERE reference_id LIKE 'CMP-' || current_year || '-%';
  NEW.reference_id := 'CMP-' || current_year || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$function$;


-- Add 'closed' to complaint_status enum
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'closed';
COMMIT;

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

CREATE TABLE public.notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES public.complaint_responses(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_response_notification UNIQUE (response_id)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notifications"
  ON public.notification_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notifications"
  ON public.notification_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update notifications"
  ON public.notification_log FOR UPDATE
  USING (true);

ALTER TABLE public.notification_log
  ADD COLUMN notification_type text NOT NULL DEFAULT 'response',
  ADD COLUMN dedupe_key text;

ALTER TABLE public.notification_log
  ALTER COLUMN response_id DROP NOT NULL;

DROP INDEX IF EXISTS notification_log_response_id_key;
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS unique_response_notification;

CREATE UNIQUE INDEX unique_dedupe_key ON public.notification_log (dedupe_key) WHERE dedupe_key IS NOT NULL;


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

DELETE FROM notification_log WHERE response_id = '1cab2fc4-66d4-4ebd-8ea1-51253b276cb0';


-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Admins and complaint owners can add responses" ON public.complaint_responses;

CREATE POLICY "Admins and complaint owners can add responses"
ON public.complaint_responses
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = responder_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM complaints
      WHERE complaints.id = complaint_responses.complaint_id
        AND complaints.user_id = auth.uid()
    )
  )
);

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS ai_summary text;


CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  seq_num integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  -- Lock the complaints table to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('complaint_ref_' || current_year));
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_id FROM 'CMP-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_num
  FROM complaints
  WHERE reference_id LIKE 'CMP-' || current_year || '-%';
  
  NEW.reference_id := 'CMP-' || current_year || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  seq_num integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  -- Lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('complaint_ref_' || current_year));
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_id FROM 'CMP-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_num
  FROM complaints
  WHERE reference_id LIKE 'CMP-' || current_year || '-%';
  
  NEW.reference_id := 'CMP-' || current_year || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$function$;


-- Drop triggers that may or may not exist, then recreate all
DROP TRIGGER IF EXISTS generate_complaint_reference_trigger ON public.complaints;
DROP TRIGGER IF EXISTS log_complaint_created_trigger ON public.complaints;
DROP TRIGGER IF EXISTS validate_complaint_status_transition_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_status_change_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_admins_on_new_complaint_trigger ON public.complaints;
DROP TRIGGER IF EXISTS update_complaints_updated_at ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_response_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS log_response_added_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER generate_complaint_reference_trigger
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.generate_complaint_reference();

CREATE TRIGGER log_complaint_created_trigger
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_created();

CREATE TRIGGER validate_complaint_status_transition_trigger
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.validate_complaint_status_transition();

CREATE TRIGGER notify_on_status_change_trigger
  AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

CREATE TRIGGER notify_admins_on_new_complaint_trigger
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_complaint();

CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER notify_on_response_trigger
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_response();

CREATE TRIGGER log_response_added_trigger
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW EXECUTE FUNCTION public.log_response_added();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


DROP TRIGGER IF EXISTS trg_log_response_added ON public.complaint_responses;
DROP TRIGGER IF EXISTS trg_notify_on_response ON public.complaint_responses;
DROP TRIGGER IF EXISTS set_complaint_reference ON public.complaints;
DROP TRIGGER IF EXISTS trg_log_complaint_created ON public.complaints;
DROP TRIGGER IF EXISTS trg_notify_admins_new_complaint ON public.complaints;
DROP TRIGGER IF EXISTS trg_notify_status_change ON public.complaints;
DROP TRIGGER IF EXISTS validate_status_transition ON public.complaints;


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

-- Add is_anonymous column
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Recreate all triggers (DROP IF EXISTS then CREATE)

-- 1. Generate reference ID on insert
DROP TRIGGER IF EXISTS trg_generate_complaint_reference ON public.complaints;
CREATE TRIGGER trg_generate_complaint_reference
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_complaint_reference();

-- 2. Set estimated resolution on insert
DROP TRIGGER IF EXISTS trg_set_estimated_resolution ON public.complaints;
CREATE TRIGGER trg_set_estimated_resolution
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_estimated_resolution();

-- 3. Validate status transitions on update
DROP TRIGGER IF EXISTS trg_validate_complaint_status_transition ON public.complaints;
CREATE TRIGGER trg_validate_complaint_status_transition
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_complaint_status_transition();

-- 4. Update updated_at on complaints
DROP TRIGGER IF EXISTS trg_update_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Notify student on status change
DROP TRIGGER IF EXISTS trg_notify_on_status_change ON public.complaints;
CREATE TRIGGER trg_notify_on_status_change
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_status_change();

-- 6. Notify student on admin response
DROP TRIGGER IF EXISTS trg_notify_on_response ON public.complaint_responses;
CREATE TRIGGER trg_notify_on_response
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_response();

-- 7. Log complaint created
DROP TRIGGER IF EXISTS trg_log_complaint_created ON public.complaints;
CREATE TRIGGER trg_log_complaint_created
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.log_complaint_created();

-- 8. Log response added
DROP TRIGGER IF EXISTS trg_log_response_added ON public.complaint_responses;
CREATE TRIGGER trg_log_response_added
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_response_added();

-- 9. Mark complaint as having new updates when response added
DROP TRIGGER IF EXISTS trg_mark_complaint_updated ON public.complaint_responses;
CREATE TRIGGER trg_mark_complaint_updated
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_complaint_updated();

-- 10. Notify admins on new complaint
DROP TRIGGER IF EXISTS trg_notify_admins_on_new_complaint ON public.complaints;
CREATE TRIGGER trg_notify_admins_on_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_complaint();


-- Drop duplicate triggers on complaints table
DROP TRIGGER IF EXISTS generate_complaint_reference_trigger ON public.complaints;
DROP TRIGGER IF EXISTS log_complaint_created_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_admins_on_new_complaint_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_status_change_trigger ON public.complaints;
DROP TRIGGER IF EXISTS set_resolution_estimate ON public.complaints;
DROP TRIGGER IF EXISTS update_complaints_updated_at ON public.complaints;
DROP TRIGGER IF EXISTS validate_complaint_status_transition_trigger ON public.complaints;

-- Drop duplicate triggers on complaint_responses table
DROP TRIGGER IF EXISTS log_response_added_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS notify_on_response_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS on_response_mark_updated ON public.complaint_responses;


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


DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'department_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hod'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'faculty_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.complaint_priority ADD VALUE IF NOT EXISTS 'critical'; EXCEPTION WHEN others THEN NULL; END $$;
COMMIT;


-- TABLES
CREATE TABLE IF NOT EXISTS public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_name text NOT NULL,
  faculty_code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  department_name text NOT NULL,
  department_code text NOT NULL,
  description text,
  hod_name text,
  department_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, department_code)
);

CREATE TABLE IF NOT EXISTS public.complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.complaint_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.complaint_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  default_priority complaint_priority NOT NULL DEFAULT 'medium',
  default_department_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.department_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

-- PROFILE EXTENSIONS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS faculty_id uuid REFERENCES public.faculties(id),
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS staff_position text,
  ADD COLUMN IF NOT EXISTS student_index_number text,
  ADD COLUMN IF NOT EXISTS programme text;

-- COMPLAINT EXTENSIONS
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS faculty_id uuid REFERENCES public.faculties(id),
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS complaint_category_id uuid REFERENCES public.complaint_categories(id),
  ADD COLUMN IF NOT EXISTS complaint_type_id uuid REFERENCES public.complaint_types(id),
  ADD COLUMN IF NOT EXISTS assigned_department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS assigned_officer_id uuid,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS semester text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_date timestamptz;

-- Make legacy category nullable for new flow
ALTER TABLE public.complaints ALTER COLUMN category DROP NOT NULL;

-- ROLE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dept_staff_for(_user_id uuid, _dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _dept IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = _dept
    LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = _dept
    WHERE ur.user_id = _user_id
      AND ur.role IN ('department_admin','hod')
      AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_faculty_admin_for(_user_id uuid, _faculty uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _faculty IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = 'faculty_admin' AND p.faculty_id = _faculty
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_dept_staff_for(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_faculty_admin_for(uuid, uuid) FROM anon;

-- Bootstrap super_admin from existing admins
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- SMART REFERENCE ID
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_year text;
  seq_num integer;
  fcode text;
  dcode text;
  prefix text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT f.faculty_code INTO fcode FROM public.faculties f WHERE f.id = NEW.faculty_id;
  SELECT d.department_code INTO dcode FROM public.departments d
    WHERE d.id = COALESCE(NEW.assigned_department_id, NEW.department_id);

  IF fcode IS NOT NULL AND dcode IS NOT NULL THEN
    prefix := fcode || '-' || dcode || '-' || current_year;
  ELSE
    prefix := 'CMP-' || current_year;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('complaint_ref_' || prefix));

  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_id FROM '-(\d+)$') AS integer)), 0) + 1
  INTO seq_num
  FROM public.complaints
  WHERE reference_id LIKE prefix || '-%';

  NEW.reference_id := prefix || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

-- SMART ROUTING
CREATE OR REPLACE FUNCTION public.route_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_default_dept_code text;
  t_default_priority complaint_priority;
  resolved_dept uuid;
  user_fac uuid;
BEGIN
  IF NEW.complaint_type_id IS NOT NULL THEN
    SELECT default_department_code, default_priority
      INTO t_default_dept_code, t_default_priority
      FROM public.complaint_types WHERE id = NEW.complaint_type_id;

    IF t_default_priority IS NOT NULL THEN
      NEW.priority := t_default_priority;
    END IF;
  END IF;

  IF NEW.faculty_id IS NULL THEN
    SELECT faculty_id INTO user_fac FROM public.profiles WHERE id = NEW.user_id;
    NEW.faculty_id := user_fac;
  END IF;

  IF NEW.assigned_department_id IS NULL THEN
    IF t_default_dept_code IS NOT NULL AND NEW.faculty_id IS NOT NULL THEN
      SELECT id INTO resolved_dept FROM public.departments
        WHERE faculty_id = NEW.faculty_id AND department_code = t_default_dept_code LIMIT 1;
    END IF;
    IF resolved_dept IS NULL AND t_default_dept_code IS NOT NULL THEN
      SELECT id INTO resolved_dept FROM public.departments
        WHERE department_code = t_default_dept_code LIMIT 1;
    END IF;
    NEW.assigned_department_id := COALESCE(resolved_dept, NEW.department_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_complaint ON public.complaints;
CREATE TRIGGER trg_route_complaint
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.route_complaint();

-- SET RESOLVED_AT + RESOLUTION_DATE
CREATE OR REPLACE FUNCTION public.set_resolved_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := now();
    NEW.resolution_date := now();
    NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- NOTIFY ASSIGNED DEPT
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  submitter_name text;
BEGIN
  SELECT display_name INTO submitter_name FROM public.profiles WHERE id = NEW.user_id;

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
          AND ur.role IN ('department_admin','hod','faculty_admin','admin','super_admin')
      )
    LOOP
      INSERT INTO public.notifications (user_id, complaint_id, title, message)
      VALUES (rec.user_id, NEW.id,
        'New Complaint: ' || COALESCE(NEW.reference_id, NEW.subject),
        'A new ' || NEW.priority || ' priority complaint was submitted by ' || COALESCE(submitter_name, 'a student') || '.');
    END LOOP;
  END IF;

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
$$;

-- RLS
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faculties read" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculties write" ON public.faculties FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "departments read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments write" ON public.departments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "categories read" ON public.complaint_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories write" ON public.complaint_categories FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "types read" ON public.complaint_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "types write" ON public.complaint_types FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "department_staff read" ON public.department_staff FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "department_staff write" ON public.department_staff FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- COMPLAINTS RLS
DROP POLICY IF EXISTS "Students see own complaints, admins see all" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update any complaint, students own" ON public.complaints;
DROP POLICY IF EXISTS "Admins can delete complaints" ON public.complaints;

CREATE POLICY "complaints scoped select" ON public.complaints FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR public.is_dept_staff_for(auth.uid(), assigned_department_id)
  OR public.is_faculty_admin_for(auth.uid(), faculty_id)
);

CREATE POLICY "complaints scoped update" ON public.complaints FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR public.is_dept_staff_for(auth.uid(), assigned_department_id)
  OR public.is_faculty_admin_for(auth.uid(), faculty_id)
);

CREATE POLICY "complaints super admin delete" ON public.complaints FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));


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


DROP POLICY IF EXISTS "Admins and complaint owners can add responses" ON public.complaint_responses;
DROP POLICY IF EXISTS "View responses for own complaints or admin" ON public.complaint_responses;

CREATE POLICY "Scoped staff and owners can add responses"
ON public.complaint_responses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = responder_id AND (
    public.is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (
          c.user_id = auth.uid()
          OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
        )
    )
  )
);

CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR public.is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR public.is_faculty_admin_for(auth.uid(), c.faculty_id)
      )
  )
);


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


-- Extend complaints visibility to "current handler" (handles HOD cases with no dept membership)
DROP POLICY IF EXISTS "complaints scoped select" ON public.complaints;
CREATE POLICY "complaints scoped select" ON public.complaints
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR current_handler_id = auth.uid()
  OR (current_handler_role = 'hod' AND has_role(auth.uid(), 'hod'::app_role) AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = complaints.faculty_id)
        OR complaints.faculty_id IS NULL
      ))
);

DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update" ON public.complaints
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR current_handler_id = auth.uid()
);

-- Responses: allow current handler to view & respond
DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can view responses" ON public.complaint_responses
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (c.user_id = auth.uid()
           OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
           OR is_faculty_admin_for(auth.uid(), c.faculty_id)
           OR c.current_handler_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Scoped staff and owners can add responses" ON public.complaint_responses;
CREATE POLICY "Scoped staff and owners can add responses" ON public.complaint_responses
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = responder_id
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (c.user_id = auth.uid()
             OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
             OR is_faculty_admin_for(auth.uid(), c.faculty_id)
             OR c.current_handler_id = auth.uid())
    )
  )
);

-- Escalations: extend select & insert to current handler / faculty admin
DROP POLICY IF EXISTS "escalations scoped select" ON public.complaint_escalations;
CREATE POLICY "escalations scoped select" ON public.complaint_escalations
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_escalations.complaint_id
      AND (c.user_id = auth.uid()
           OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
           OR is_faculty_admin_for(auth.uid(), c.faculty_id)
           OR c.current_handler_id = auth.uid())
  )
);

-- escalate_complaint: allow faculty admins / super admins, fall back to faculty HOD / any HOD
CREATE OR REPLACE FUNCTION public.escalate_complaint(_complaint_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- 1. HOD in the assigned department
  SELECT ur.user_id INTO hod_id
  FROM public.user_roles ur
  LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c.assigned_department_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = c.assigned_department_id
  WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
  LIMIT 1;

  -- 2. Fallback: HOD in the same faculty
  IF hod_id IS NULL AND c.faculty_id IS NOT NULL THEN
    SELECT ur.user_id INTO hod_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'hod' AND p.faculty_id = c.faculty_id
    LIMIT 1;
  END IF;

  -- 3. Fallback: any HOD
  IF hod_id IS NULL THEN
    SELECT user_id INTO hod_id FROM public.user_roles WHERE role = 'hod' LIMIT 1;
  END IF;

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
$function$;

-- Backfill: set current_handler_id for already-escalated complaints that have no handler
UPDATE public.complaints c
SET current_handler_id = sub.hod_id
FROM (
  SELECT c2.id,
    COALESCE(
      (SELECT ur.user_id FROM public.user_roles ur
        LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = c2.assigned_department_id
        LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = c2.assigned_department_id
        WHERE ur.role = 'hod' AND (ds.id IS NOT NULL OR p.id IS NOT NULL) LIMIT 1),
      (SELECT ur.user_id FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'hod' AND p.faculty_id = c2.faculty_id LIMIT 1),
      (SELECT user_id FROM public.user_roles WHERE role = 'hod' LIMIT 1)
    ) AS hod_id
  FROM public.complaints c2
  WHERE c2.escalation_level >= 1 AND c2.current_handler_id IS NULL
) sub
WHERE c.id = sub.id AND sub.hod_id IS NOT NULL;


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


DROP POLICY IF EXISTS "Scoped staff and owners can add responses" ON public.complaint_responses;
DROP POLICY IF EXISTS "Scoped staff and owners can view responses" ON public.complaint_responses;

CREATE POLICY "Scoped staff and owners can view responses"
ON public.complaint_responses FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_responses.complaint_id
      AND (
        c.user_id = auth.uid()
        OR c.current_handler_id = auth.uid()
        OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
        OR is_faculty_admin_for(auth.uid(), c.faculty_id)
        OR (has_role(auth.uid(), 'hod'::app_role) AND EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = c.faculty_id
        ))
      )
  )
);

CREATE POLICY "Scoped staff and owners can add responses"
ON public.complaint_responses FOR INSERT
WITH CHECK (
  auth.uid() = responder_id
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_responses.complaint_id
        AND (
          c.user_id = auth.uid()
          OR c.current_handler_id = auth.uid()
          OR is_dept_staff_for(auth.uid(), c.assigned_department_id)
          OR is_faculty_admin_for(auth.uid(), c.faculty_id)
          OR (has_role(auth.uid(), 'hod'::app_role) AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.faculty_id = c.faculty_id
          ))
        )
    )
  )
);

DROP POLICY IF EXISTS "complaints scoped update" ON public.complaints;
CREATE POLICY "complaints scoped update" ON public.complaints
FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR is_super_admin(auth.uid())
  OR is_dept_staff_for(auth.uid(), assigned_department_id)
  OR is_faculty_admin_for(auth.uid(), faculty_id)
  OR (current_handler_id = auth.uid())
  OR (
    current_handler_role = 'hod'
    AND has_role(auth.uid(), 'hod'::app_role)
    AND (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.faculty_id = complaints.faculty_id)
      OR faculty_id IS NULL
    )
  )
);


-- 1) Allow students to delete their own complaints when closed (in addition to resolved+7d)
DROP POLICY IF EXISTS "Students can delete own complaints 7 days after resolved" ON public.complaints;

CREATE POLICY "Students can delete own complaints"
ON public.complaints
FOR DELETE
USING (
  auth.uid() = user_id
  AND (
    status = 'closed'::complaint_status
    OR (
      status = 'resolved'::complaint_status
      AND resolved_at IS NOT NULL
      AND resolved_at <= (now() - interval '7 days')
    )
  )
);

-- 2) Extend complaint_feedback with rating + comment (nullable)
ALTER TABLE public.complaint_feedback
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS comment text;

ALTER TABLE public.complaint_feedback
  DROP CONSTRAINT IF EXISTS complaint_feedback_rating_check;

ALTER TABLE public.complaint_feedback
  ADD CONSTRAINT complaint_feedback_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));


-- Preserve the priority selected by the submitter while retaining smart routing.
CREATE OR REPLACE FUNCTION public.route_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_default_dept_code text;
  resolved_dept uuid;
  user_fac uuid;
BEGIN
  IF NEW.complaint_type_id IS NOT NULL THEN
    SELECT default_department_code
      INTO t_default_dept_code
      FROM public.complaint_types
      WHERE id = NEW.complaint_type_id;
  END IF;

  IF NEW.faculty_id IS NULL THEN
    SELECT faculty_id INTO user_fac FROM public.profiles WHERE id = NEW.user_id;
    NEW.faculty_id := user_fac;
  END IF;

  IF NEW.assigned_department_id IS NULL THEN
    IF t_default_dept_code IS NOT NULL AND NEW.faculty_id IS NOT NULL THEN
      SELECT id INTO resolved_dept
      FROM public.departments
      WHERE faculty_id = NEW.faculty_id AND department_code = t_default_dept_code
      LIMIT 1;
    END IF;

    IF resolved_dept IS NULL AND t_default_dept_code IS NOT NULL THEN
      SELECT id INTO resolved_dept
      FROM public.departments
      WHERE department_code = t_default_dept_code
      LIMIT 1;
    END IF;

    NEW.assigned_department_id := COALESCE(resolved_dept, NEW.department_id);
  END IF;

  RETURN NEW;
END;
$$;


-- Align complaint categories with the current complaint workflow.
UPDATE public.complaint_categories
SET name = 'Technical', code = 'technical'
WHERE code = 'infrastructure';

UPDATE public.complaint_categories
SET name = 'Facilities & Welfare', code = 'facilities'
WHERE code = 'other';

INSERT INTO public.complaint_categories (name, code)
VALUES
  ('Academic', 'academic'),
  ('Administrative', 'administrative'),
  ('Facilities & Welfare', 'facilities'),
  ('Technical', 'technical')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.complaint_types
  (category_id, name, code, default_priority, default_department_code)
SELECT cc.id, seed.name, seed.code, seed.default_priority::complaint_priority, seed.default_department_code
FROM (
  VALUES
    ('academic', 'Course Registration Problems', 'ACAD_REG_PROBLEMS', 'medium', 'ACADAFF'),
    ('academic', 'Examination Malpractice Dispute', 'ACAD_EXAM_MALPRACTICE', 'high', 'EXAMS'),
    ('academic', 'Lecturer Harassment Complaint', 'ACAD_LECTURER_HARASSMENT', 'high', 'ACADAFF'),
    ('academic', 'Transcript Errors', 'ACAD_TRANSCRIPT_ERRORS', 'high', 'EXAMS'),
    ('academic', 'Timetable Problems', 'ACAD_TIMETABLE_PROBLEMS', 'low', 'ACADAFF'),
    ('administrative', 'Fees Payment Not Reflecting', 'ADMIN_FEES_NOT_REFLECTING', 'high', 'FINANCE'),
    ('administrative', 'Financial Clearance Problems', 'ADMIN_FINANCIAL_CLEARANCE', 'medium', 'FINANCE'),
    ('administrative', 'ID Card Processing Delay', 'ADMIN_ID_CARD_DELAY', 'low', 'ACADAFF'),
    ('administrative', 'National Service Letter Delay', 'ADMIN_NSS_LETTER_DELAY', 'medium', 'ACADAFF'),
    ('facilities', 'Hostel Accommodation Issues', 'FAC_HOSTEL_ACCOMMODATION', 'high', 'HOSTEL'),
    ('facilities', 'Security Concerns', 'FAC_SECURITY_CONCERNS', 'high', 'SECURITY'),
    ('facilities', 'Sexual Harassment Complaints', 'FAC_SEXUAL_HARASSMENT', 'critical', 'WELFARE'),
    ('facilities', 'Washroom/Sanitation Complaints', 'FAC_SANITATION', 'medium', 'FACILITIES'),
    ('technical', 'Internet Downtime', 'TECH_INTERNET_DOWNTIME', 'high', 'ICT'),
    ('technical', 'LMS Access Problem', 'TECH_LMS_ACCESS', 'medium', 'ICT'),
    ('technical', 'Student Portal Login Failure', 'TECH_PORTAL_LOGIN', 'high', 'ICT'),
    ('technical', 'Broken Lab Equipment', 'TECH_BROKEN_LAB_EQUIPMENT', 'medium', 'ICT')
) AS seed(category_code, name, code, default_priority, default_department_code)
JOIN public.complaint_categories cc ON cc.code = seed.category_code
ON CONFLICT (code) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  default_priority = EXCLUDED.default_priority,
  default_department_code = EXCLUDED.default_department_code;
