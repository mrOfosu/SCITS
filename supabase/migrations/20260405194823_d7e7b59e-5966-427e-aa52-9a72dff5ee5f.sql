
DROP TRIGGER IF EXISTS trg_log_response_added ON public.complaint_responses;
DROP TRIGGER IF EXISTS trg_notify_on_response ON public.complaint_responses;
DROP TRIGGER IF EXISTS set_complaint_reference ON public.complaints;
DROP TRIGGER IF EXISTS trg_log_complaint_created ON public.complaints;
DROP TRIGGER IF EXISTS trg_notify_admins_new_complaint ON public.complaints;
DROP TRIGGER IF EXISTS trg_notify_status_change ON public.complaints;
DROP TRIGGER IF EXISTS validate_status_transition ON public.complaints;
