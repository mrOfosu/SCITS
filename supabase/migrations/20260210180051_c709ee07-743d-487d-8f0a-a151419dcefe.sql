
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
