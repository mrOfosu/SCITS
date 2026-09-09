
-- Backfill current_handler_id for complaints that were auto-escalated with a NULL handler.
-- This makes old automatically escalated complaints visible to the correct HOD again.
DO $$
DECLARE
  rec RECORD;
  hod_id uuid;
BEGIN
  FOR rec IN
    SELECT id, assigned_department_id
    FROM public.complaints
    WHERE escalation_level >= 1
      AND current_handler_id IS NULL
      AND assigned_department_id IS NOT NULL
  LOOP
    SELECT ur.user_id INTO hod_id
    FROM public.user_roles ur
    LEFT JOIN public.department_staff ds ON ds.user_id = ur.user_id AND ds.department_id = rec.assigned_department_id
    LEFT JOIN public.profiles p ON p.id = ur.user_id AND p.department_id = rec.assigned_department_id
    WHERE ur.role = 'hod'
      AND (ds.id IS NOT NULL OR p.id IS NOT NULL)
    LIMIT 1;

    IF hod_id IS NOT NULL THEN
      UPDATE public.complaints
      SET current_handler_id = hod_id,
          current_handler_role = 'hod'
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
