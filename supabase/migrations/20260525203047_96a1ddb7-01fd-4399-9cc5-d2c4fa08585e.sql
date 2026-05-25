
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'department_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hod'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'faculty_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.complaint_priority ADD VALUE IF NOT EXISTS 'critical'; EXCEPTION WHEN others THEN NULL; END $$;
