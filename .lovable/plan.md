# Update Methodology & System Specifications PDF

Regenerate `/mnt/documents/Methodology_and_System_Specifications_v2.pdf` to align with the system's current state. Keep the existing structure, tone and formatting; only refresh the content that has changed.

## What will change

### 1. Functional Requirements (Section 3.1)
Add/revise entries to reflect new behaviour:
- **FR-08 Status workflow:** add `Rejected` state — `Pending → In Review → Resolved → Closed`, with `Rejected` as a terminal branch requiring a reason.
- **New FR — Complaint Rejection:** Admins (department, faculty, HOD, super) can reject a complaint with a mandatory reason; the student is notified with the reason and the rejected complaint appears on dashboards.
- **New FR — Department-Based Escalation:** Unresolved complaints escalate from Department Admin to Head of Department (HOD). Faculty/Department admins can manually escalate with a reason.
- **New FR — Auto-Escalation:** Complaints unresolved after 3 days are auto-escalated to the relevant HOD via a scheduled job.
- **New FR — Escalation Timeline:** Students view full lifecycle (submission → assignment → responses → escalation → resolution/rejection) in realtime.
- **FR-12 (Kwame AI):** restrict to student accounts only; AI features removed from all admin pages. Kwame is escalation-aware (overdue, escalated, resolved guidance).
- **New FR — Realtime Updates:** Complaint status, handler and escalation changes propagate live to dashboards and detail pages.

### 2. User Roles (Section 3.8)
Replace the two-role table with the actual hierarchy:
- **Student** — submit, track, bookmark, give feedback, use Kwame AI.
- **Department Admin** — handle complaints routed to their department; escalate to HOD; reject with reason.
- **Faculty Admin / Faculty Head** — oversee complaints across departments in their faculty; escalate; reject.
- **Head of Department (HOD)** — final authority for escalated complaints in their department.
- **Super Admin** — system-wide configuration, analytics, user/role management (not part of complaint chain).

Note: Kwame AI is available to students only.

### 3. Database Design (Section 3.6)
Update table list to match current schema:
- `profiles`, `user_roles` (with `app_role` enum: student, department_admin, faculty_admin, hod, super_admin)
- `faculties`, `departments`, `department_staff` — institutional structure & staff assignments
- `complaints` — adds `assigned_department_id`, `faculty_id`, `escalation_level`, `escalated_at`, `escalated_by`, `escalation_reason`, `current_handler_id`, `current_handler_role`, `rejection_reason`, `rejected_at`, `rejected_by`
- `complaint_responses`, `complaint_activity` (audit trail), `complaint_escalations` (escalation history)
- `notifications`, `bookmarks`, `feedback`
- Security-definer helpers: `has_role`, `is_hod_for`, `is_dept_staff_for`, `escalate_complaint`

### 4. System Architecture (Section 3.5)
Add a fourth bullet for **Scheduled Jobs**: `pg_cron` runs the `auto-escalate-complaints` edge function hourly; other edge functions cover auto-assignment, notifications, overdue checks, and Kwame chat.

### 5. Software Requirements (Section 3.4)
Minor refresh:
- Add **Framer Motion** (animations) and **Realtime** (Supabase Realtime channels).
- Clarify AI Assistant row: "Lovable AI Gateway (Google Gemini) — student-facing only".

### 6. Security Specifications (Section 3.7)
Add:
- Role escalation prevented via separate `user_roles` table + `has_role` SECURITY DEFINER function.
- RLS policies scoped by department/faculty membership and current handler.
- Escalation and rejection actions logged in `complaint_activity` and `complaint_escalations`.

### 7. Cover page
Bump **Version** to `2.0`, **Date** to `June 2026`.

## Technical approach
- Use the `docx` skill / `reportlab` (PDF skill) to regenerate the document with the existing visual style (titles, tables, bullet lists).
- Save as `/mnt/documents/Methodology_and_System_Specifications_v2.pdf` (keep the original intact for comparison).
- Run visual QA: convert each page to JPEG and inspect for layout/clipping issues before delivering.

## Out of scope
- No code or database changes.
- No change to sections 1, 2 (methodology), 3.2 (non-functional), 3.3 (hardware), or 4 (conclusion) beyond minor wording.
