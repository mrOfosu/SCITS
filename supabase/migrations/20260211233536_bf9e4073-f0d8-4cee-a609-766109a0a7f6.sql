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