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
    SELECT faculty_id
      INTO user_fac
      FROM public.profiles
      WHERE id = NEW.user_id;
    NEW.faculty_id := user_fac;
  END IF;

  IF NEW.assigned_department_id IS NULL THEN
    IF t_default_dept_code IS NOT NULL AND NEW.faculty_id IS NOT NULL THEN
      SELECT id
        INTO resolved_dept
        FROM public.departments
        WHERE faculty_id = NEW.faculty_id
          AND department_code = t_default_dept_code
        LIMIT 1;
    END IF;

    IF resolved_dept IS NULL AND t_default_dept_code IS NOT NULL THEN
      SELECT id
        INTO resolved_dept
        FROM public.departments
        WHERE department_code = t_default_dept_code
        LIMIT 1;
    END IF;

    NEW.assigned_department_id := COALESCE(resolved_dept, NEW.department_id);
  END IF;

  RETURN NEW;
END;
$$;
