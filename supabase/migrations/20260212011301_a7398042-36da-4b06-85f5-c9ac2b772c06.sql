
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
