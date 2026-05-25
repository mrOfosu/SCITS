
# GCTU Core System Refactor — Plan

A large, multi-phase refactor of the database, role system, complaint model, routing, and UI. Existing auth, Kwame AI, notifications, attachments, and realtime will continue to work.

## Phase 1 — Database Schema (Migration #1: structure)

New tables:
- `faculties` (id, faculty_name, faculty_code unique, description, created_at)
- `departments` (id, faculty_id FK, department_name, department_code, description, hod_name, department_email, is_active, created_at)
- `complaint_categories` (id, name, code) — Academic, Technical, Administrative, Facilities & Welfare
- `complaint_types` (id, category_id FK, name, code, default_priority, default_department_code) — used for routing
- `department_admins` (id, user_id, department_id) — links staff to departments

Extend `app_role` enum: add `department_admin`, `hod`, `faculty_admin`, `super_admin` (keep existing `admin` as alias for super_admin during migration).

Extend `profiles`:
- faculty_id, department_id, staff_position, student_index_number, programme
(`level`, `phone_number`, `full_name` already exist.)

Extend `complaints`:
- faculty_id, department_id, complaint_category_id, complaint_type_id
- assigned_department_id, assigned_officer_id
- escalation_level (int, default 0), academic_year, semester
- resolved_by, resolution_date
(Existing `priority` and `status` enums kept; widen `priority` to include `critical`.)

Upgrade `generate_complaint_reference()` to emit `FACULTY-DEPT-YYYY-NNN` using faculty/department codes; fallback to `CMP-YYYY-NNN` if missing.

## Phase 2 — Seed Data (Migration #2: data)
Insert 4 faculties, all listed departments, all categories, and all complaint types with default routing department codes and priorities.

## Phase 3 — Smart Routing
DB trigger `route_complaint_on_insert`:
- Resolves `assigned_department_id` from `complaint_type.default_department_code` within the student's faculty.
- Falls back to selected `department_id`, then any matching dept across faculties.
- Sets `priority` from `complaint_type.default_priority` if not provided.

## Phase 4 — RLS Rewrite
Helper functions (SECURITY DEFINER):
- `get_user_department(uuid)`, `get_user_faculty(uuid)`, `is_super_admin(uuid)`, `is_faculty_admin_of(uuid, faculty)`, `is_dept_admin_of(uuid, dept)`.

`complaints` policies:
- SELECT: owner OR super_admin OR dept_admin/hod of `assigned_department_id` OR faculty_admin of `faculty_id`.
- UPDATE: owner (limited), assigned dept staff, faculty_admin, super_admin.
- INSERT: authenticated, `auth.uid()=user_id`.
- DELETE: super_admin only (plus existing 7-day self-delete after resolved).

Mirror scoping on `complaint_responses`, `complaint_activity`, `notifications`.

Existing `has_role(uid,'admin')` calls remain valid because `admin` stays mapped to super_admin.

## Phase 5 — Frontend Changes (minimal scope per request)
- **SubmitComplaint**: replace category/sub-category UI with cascading selects → Faculty → Department → Main Category → Complaint Type → Academic Year + Semester. Auto-fill faculty/department from profile when present.
- **CompleteProfile**: add Faculty + Department + Programme fields.
- **useAuth**: extend to expose `role` (highest of the new roles) instead of just `isAdmin`. Keep `isAdmin` as `role === 'super_admin' || legacy admin`.
- **AdminSidebar / routes**: gate by role. Add a department-scoped view for `department_admin` and `hod`. Super admin keeps full access.
- **AdminComplaints / AdminDashboard**: filter queries by assigned_department_id when user is dept_admin/hod; by faculty when faculty_admin.
- **NotificationBell / triggers**: update `notify_admins_on_new_complaint` to notify only members of `assigned_department_id` (+ super admins) instead of every admin.

Realtime channels and Kwame AI untouched (still subscribe to `complaints`/`notifications`).

## Phase 6 — Keep working
- Existing complaints get NULL faculty/department/type — UI handles gracefully (shows legacy `category`).
- Legacy `category` and `sub_category` columns are kept for backwards compatibility but no longer required.
- Storage bucket, attachments flow, AI summary edge function unchanged.

## Technical notes
- All schema changes in ONE migration (Phase 1) to keep types.ts regen consistent; data seed in a second migration.
- New role enum values appended at the end to avoid Postgres enum reorder issues.
- A small `bootstrap_super_admin` migration assigns `super_admin` to current `admin` users.
- No file paths or component-by-component diffs in this plan — implementation will follow the patterns already in `useAuth.tsx`, `AdminLayout.tsx`, `SubmitComplaint.tsx`.

## Out of scope
- Visual redesign of unrelated pages.
- Changes to Kwame chatbot logic.
- Email template rewrites (existing edge functions keep working; recipients change via trigger).

Approve to proceed with Phase 1 migration.
