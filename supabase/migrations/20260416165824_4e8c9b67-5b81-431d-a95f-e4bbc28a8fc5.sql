
-- Drop duplicate triggers on complaints table
DROP TRIGGER IF EXISTS generate_complaint_reference_trigger ON public.complaints;
DROP TRIGGER IF EXISTS log_complaint_created_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_admins_on_new_complaint_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_status_change_trigger ON public.complaints;
DROP TRIGGER IF EXISTS set_resolution_estimate ON public.complaints;
DROP TRIGGER IF EXISTS update_complaints_updated_at ON public.complaints;
DROP TRIGGER IF EXISTS validate_complaint_status_transition_trigger ON public.complaints;

-- Drop duplicate triggers on complaint_responses table
DROP TRIGGER IF EXISTS log_response_added_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS notify_on_response_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS on_response_mark_updated ON public.complaint_responses;
