-- Add is_anonymous column
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Recreate all triggers (DROP IF EXISTS then CREATE)

-- 1. Generate reference ID on insert
DROP TRIGGER IF EXISTS trg_generate_complaint_reference ON public.complaints;
CREATE TRIGGER trg_generate_complaint_reference
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_complaint_reference();

-- 2. Set estimated resolution on insert
DROP TRIGGER IF EXISTS trg_set_estimated_resolution ON public.complaints;
CREATE TRIGGER trg_set_estimated_resolution
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_estimated_resolution();

-- 3. Validate status transitions on update
DROP TRIGGER IF EXISTS trg_validate_complaint_status_transition ON public.complaints;
CREATE TRIGGER trg_validate_complaint_status_transition
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_complaint_status_transition();

-- 4. Update updated_at on complaints
DROP TRIGGER IF EXISTS trg_update_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_update_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Notify student on status change
DROP TRIGGER IF EXISTS trg_notify_on_status_change ON public.complaints;
CREATE TRIGGER trg_notify_on_status_change
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_status_change();

-- 6. Notify student on admin response
DROP TRIGGER IF EXISTS trg_notify_on_response ON public.complaint_responses;
CREATE TRIGGER trg_notify_on_response
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_response();

-- 7. Log complaint created
DROP TRIGGER IF EXISTS trg_log_complaint_created ON public.complaints;
CREATE TRIGGER trg_log_complaint_created
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.log_complaint_created();

-- 8. Log response added
DROP TRIGGER IF EXISTS trg_log_response_added ON public.complaint_responses;
CREATE TRIGGER trg_log_response_added
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_response_added();

-- 9. Mark complaint as having new updates when response added
DROP TRIGGER IF EXISTS trg_mark_complaint_updated ON public.complaint_responses;
CREATE TRIGGER trg_mark_complaint_updated
  AFTER INSERT ON public.complaint_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_complaint_updated();

-- 10. Notify admins on new complaint
DROP TRIGGER IF EXISTS trg_notify_admins_on_new_complaint ON public.complaints;
CREATE TRIGGER trg_notify_admins_on_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_complaint();