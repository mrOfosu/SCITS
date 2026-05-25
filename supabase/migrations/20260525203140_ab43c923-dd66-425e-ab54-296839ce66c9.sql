
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
