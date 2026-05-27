CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));