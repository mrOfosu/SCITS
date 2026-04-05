
-- Drop triggers that may or may not exist, then recreate all
DROP TRIGGER IF EXISTS generate_complaint_reference_trigger ON public.complaints;
DROP TRIGGER IF EXISTS log_complaint_created_trigger ON public.complaints;
DROP TRIGGER IF EXISTS validate_complaint_status_transition_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_status_change_trigger ON public.complaints;
DROP TRIGGER IF EXISTS notify_admins_on_new_complaint_trigger ON public.complaints;
DROP TRIGGER IF EXISTS update_complaints_updated_at ON public.complaints;
DROP TRIGGER IF EXISTS notify_on_response_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS log_response_added_trigger ON public.complaint_responses;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER generate_complaint_reference_trigger
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.generate_complaint_reference();

CREATE TRIGGER log_complaint_created_trigger
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_created();

CREATE TRIGGER validate_complaint_status_transition_trigger
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.validate_complaint_status_transition();

CREATE TRIGGER notify_on_status_change_trigger
  AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

CREATE TRIGGER notify_admins_on_new_complaint_trigger
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_complaint();

CREATE TRIGGER update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER notify_on_response_trigger
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_response();

CREATE TRIGGER log_response_added_trigger
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW EXECUTE FUNCTION public.log_response_added();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
