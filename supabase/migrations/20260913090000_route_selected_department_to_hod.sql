-- The department selected in the complaint form is stored in department_id.
-- It is the authoritative routing destination; a complaint type's default
-- department is only a fallback for legacy/API inserts with no selection.
CREATE OR REPLACE FUNCTION public.route_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  type_default_department_code text;
  resolved_department_id uuid;
  submitter_faculty_id uuid;
BEGIN
  -- A department picked on the form must always be the assigned department.
  -- On UPDATE, only re-route when that selected department changed.
  IF NEW.department_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
    NEW.assigned_department_id := NEW.department_id;
    RETURN NEW;
  END IF;

  -- Preserve an existing explicit assignment during unrelated updates.
  IF NEW.assigned_department_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fallback for legacy/API complaints that do not provide a department.
  IF NEW.complaint_type_id IS NOT NULL THEN
    SELECT default_department_code
    INTO type_default_department_code
    FROM public.complaint_types
    WHERE id = NEW.complaint_type_id;
  END IF;

  IF NEW.faculty_id IS NULL THEN
    SELECT faculty_id INTO submitter_faculty_id
    FROM public.profiles
    WHERE id = NEW.user_id;
    NEW.faculty_id := submitter_faculty_id;
  END IF;

  IF type_default_department_code IS NOT NULL THEN
    SELECT id INTO resolved_department_id
    FROM public.departments
    WHERE faculty_id = NEW.faculty_id
      AND department_code = type_default_department_code
    LIMIT 1;

    IF resolved_department_id IS NULL THEN
      SELECT id INTO resolved_department_id
      FROM public.departments
      WHERE department_code = type_default_department_code
      LIMIT 1;
    END IF;
  END IF;

  NEW.assigned_department_id := resolved_department_id;
  RETURN NEW;
END;
$$;

-- Repair historical routing with the department actually selected on the
-- complaint form. This changes routing metadata only; it creates no complaint
-- or escalation records.
UPDATE public.complaints
SET assigned_department_id = department_id,
    updated_at = now()
WHERE department_id IS NOT NULL
  AND assigned_department_id IS DISTINCT FROM department_id;

-- Reassign every already-escalated complaint to the HOD of that selected
-- department, including old automatically escalated complaints.
WITH correct_handlers AS (
  SELECT c.id, public.hod_for_department(c.assigned_department_id) AS hod_id
  FROM public.complaints c
  WHERE c.escalation_level >= 1
    AND c.assigned_department_id IS NOT NULL
)
UPDATE public.complaints c
SET current_handler_id = ch.hod_id,
    current_handler_role = 'hod',
    updated_at = now()
FROM correct_handlers ch
WHERE c.id = ch.id
  AND ch.hod_id IS NOT NULL
  AND c.current_handler_id IS DISTINCT FROM ch.hod_id;
