# Diagrams for Documentation

Produce two publication-quality diagrams saved to `/mnt/documents/` so they can be dropped into the Methodology & System Specifications doc.

## 1. Chen Notation ER Diagram

File: `/mnt/documents/ER_Diagram_Chen.png` (high-DPI, landscape).

Uses classic Chen symbols:
- Rectangles = entities
- Ellipses = attributes (double ellipse = multivalued, dashed = derived, underlined = primary key)
- Diamonds = relationships
- Lines labeled with cardinality (1, N, M)

Entities and relationships to include (matches current schema):

- **Student** (user_id PK, full_name, email, index_number, level, program) — *Submits* (1:N) → **Complaint**
- **Complaint** (complaint_id PK, reference_id, title, description, status, priority, submitted_at, resolved_at, rejection_reason)
- **Faculty** (faculty_id PK, name, code) — *Contains* (1:N) → **Department**
- **Department** (department_id PK, name, code) — *Routes* (1:N) → **Complaint** (assigned_department)
- **Admin/Staff** (user_id PK, role, position) — *Handles* (1:N) → **Complaint** (current_handler)
- **Admin/Staff** — *AssignedTo* (M:N via department_staff) → **Department**
- **ComplaintCategory** (category_id PK) — *Classifies* (1:N) → **ComplaintType** (type_id PK) — *Categorizes* (1:N) → **Complaint**
- **Complaint** — *Receives* (1:N) → **Response** (response_id PK, message, created_at) ← *Writes* (1:N) — **Admin/Staff**
- **Complaint** — *Escalates* (1:N) → **Escalation** (escalation_id PK, from_role, to_role, reason, escalated_at) ← *TriggeredBy* — **Admin/Staff**
- **Complaint** — *Generates* (1:N) → **ActivityLog** (log_id PK, action, actor, timestamp)
- **Complaint** — *ProducesFeedback* (1:1) → **Feedback** (feedback_id PK, rating, comment)
- **Student** — *Bookmarks* (M:N) → **Complaint**
- **User** — *Receives* (1:N) → **Notification** (notif_id PK, message, read, created_at)

## 2. Activity Diagram

File: `/mnt/documents/Activity_Diagram.png` (portrait, swimlanes).

UML activity notation: filled circle (start), rounded rectangles (actions), diamonds (decisions), horizontal bars (fork/join), bull's-eye (end). Swimlanes: **Student | System | Department Admin | HOD**.

Flow:
1. Student logs in → submits complaint (title, category, type, description, attachments).
2. System validates → smart-routes to department → generates reference ID → notifies department admin & student.
3. Department Admin reviews. Decision:
   - **Reject** → provide reason → notify student → END (rejected).
   - **Accept** → mark In Review → respond.
4. Decision: resolved within 3 days?
   - **Yes** → mark Resolved → notify student.
   - **No / manual escalate** → escalate to HOD (auto via pg_cron hourly job, or manual with reason).
5. HOD reviews escalated complaint → responds → marks Resolved (or Reject with reason).
6. Student receives resolution → prompted for rating + feedback → optionally closes complaint → END.
7. After 7 days of Resolved (or immediately on Closed) student may delete.

## Technical approach

- Use Python + Graphviz (`graphviz` package) to render both diagrams as PNGs at 200 DPI.
- Chen ER: `graph` layout with distinct shapes (`box`, `ellipse`, `diamond`) and edge labels for cardinalities.
- Activity: `digraph` with swimlane clusters, `shape=box style=rounded` for actions, `diamond` for decisions.
- QA: view rendered PNGs, check for label clipping/overlap, iterate until clean. Deliver both files as artifacts.

## Out of scope
- No code, schema, or PDF changes. Diagrams are standalone image files the user can embed into the docs manually.
