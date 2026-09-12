
-- Allow complaint owners to delete their own resolved/closed complaints
CREATE POLICY "complaints owner delete"
ON public.complaints
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND status IN ('resolved', 'closed')
);
