# Level 9 — Department Escalation System

A focused, additive build that layers escalation on top of the existing routing, RLS, dashboards, notifications, and Kwame AI without breaking them.

## Escalation Model
Student → Department Admin → HOD. HOD is the final authority within a department. Super Admin remains system/analytics only and is not part of the complaint escalation chain.

## Database Changes (one migration)

Add to `complaints`:
- `escalated_at timestamptz`
- `escalated_by uuid`
- `escalation_reason text`
- `current_handler_id uuid`
- `current_handler_role text` (`department_admin` | `hod`)
- (reuse existing `escalation_level int`; 0 = dept admin, 1 = HOD)

New table `complaint_escalations`:
- `id`, `complaint_id`, `previous_handler_id`, `previous_handler_role`, `new_handler_id`, `new_handler_role`, `escalation_reason`, `escalated_by`, `created_at`
- RLS: scoped read for complaint owner + dept staff + HOD + super admin; insert via security-definer function only.
- GRANT select/insert to `authenticated`, all to `service_role`.

Helper: `is_hod_for(_user_id, _dept)` security-definer function.

Trigger on new complaint: set `current_handler_role = 'department_admin'`, pick a `current_handler_id` (first dept admin in assigned department).

Function `escalate_complaint(complaint_id, reason, escalated_by)`:
- Find HOD of the complaint's assigned department.
- Update complaint: `escalation_level=1`, `current_handler_role='hod'`, `current_handler_id=<hod>`, `escalated_at=now()`, `escalated_by`, `escalation_reason`.
- Insert row in `complaint_escalations`.
- Insert notifications for HOD + student.
- Insert `complaint_activity` entry (`action_type='escalated'`).

## Auto-Escalation (3 days)
New edge function `auto-escalate-complaints` (scheduled via pg_cron every hour):
- Select complaints where `status IN ('pending','in_review')` AND `escalation_level = 0` AND `created_at < now() - interval '3 days'`.
- Call `escalate_complaint(...)` with reason "Auto-escalated: no resolution within 3 days".

## Manual Escalation
- Edge function `escalate-complaint` (or direct RPC) called from UI.
- Department Admin sees "Escalate to HOD" button on `ComplaintDetail` (visible only when `current_handler_role='department_admin'` and user is dept staff).
- Dialog asks for required reason → calls RPC.

## RLS Updates
Extend existing scoped policies so HOD users (`has_role('hod')` AND HOD of the complaint's department) can SELECT/UPDATE complaints and INSERT responses. `is_dept_staff_for` already covers HOD role — verify and keep.

## UI Changes

`ComplaintTimeline.tsx` (new): visual vertical timeline built from `complaint_activity` + `complaint_escalations` (Submitted → Assigned → Responses → Escalated → Resolved). Rendered on `ComplaintDetail` for everyone.

`ComplaintDetail.tsx`:
- Show current handler + role badge.
- Escalation banner if `escalation_level=1`.
- "Escalate to HOD" button for dept admins with reason dialog.
- Replace/augment existing ActivityLog with new ComplaintTimeline.

`StudentDashboard` / complaint cards:
- Show Assigned Department, Current Handler name + role, Escalation status + date.

`AdminDashboard` (HOD view):
- When current user has `hod` role, add widgets: Escalated to me, Pending, Resolved, Avg resolution time, top complaint types — scoped to their department.
- Dept admin view stays as-is, filtered by their department (already works via RLS).

## Notifications
`escalate_complaint` inserts notifications for HOD ("Complaint escalated to you") and student ("Your complaint has been escalated to the HOD"). Existing realtime notification bell picks them up.

## Realtime
Add `complaints` and `complaint_escalations` to `supabase_realtime` publication. Subscribe in `ComplaintDetail` and dashboards to refetch on changes.

## Kwame AI
Update `student-chat` edge function system prompt + context loader to include complaint `escalation_level`, `current_handler_role`, `escalated_at`, age. Add canned guidance for: overdue/eligible-for-escalation, currently-escalated, resolved.

## What does NOT change
Auth, profile completion, faculties/departments tables, existing complaint creation/routing trigger, email notifications, Kwame chat UI, existing realtime subscriptions, file uploads, PDF export.

## Build order
1. Migration (schema + RLS + helpers + triggers).
2. Edge functions: `escalate-complaint`, `auto-escalate-complaints` + pg_cron schedule.
3. UI: ComplaintTimeline, ComplaintDetail escalate button + handler banner, dashboard widgets, student card fields.
4. Kwame context update.
5. Realtime publication + client subscriptions.
