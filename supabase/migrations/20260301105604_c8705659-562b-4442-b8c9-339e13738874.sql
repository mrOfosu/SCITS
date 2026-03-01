ALTER TABLE public.notification_log
  ADD COLUMN notification_type text NOT NULL DEFAULT 'response',
  ADD COLUMN dedupe_key text;

ALTER TABLE public.notification_log
  ALTER COLUMN response_id DROP NOT NULL;

DROP INDEX IF EXISTS notification_log_response_id_key;
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS unique_response_notification;

CREATE UNIQUE INDEX unique_dedupe_key ON public.notification_log (dedupe_key) WHERE dedupe_key IS NOT NULL;