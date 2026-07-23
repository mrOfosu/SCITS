Regenerate `/mnt/documents/ER_Diagram_Chen.png` to match the uploaded reference styling.

## Visual spec (from reference image)
- Entities: light-blue filled rectangles, uppercase labels (STUDENT, COMPLAINT, FACULTY, DEPARTMENT, COMPLAINT CATEGORY, COMPLAINT TYPE, ADMIN / STAFF, RESPONSE, ESCALATION, ACTIVITY LOG, FEEDBACK, NOTIFICATION).
- Relationships: light-orange filled diamonds (Submits, Handles, Contains, Routes, AssignedTo, Classifies, Categorizes, Receives, Writes, Escalates, Triggers, Generates, Produces, Bookmarks, Receives-notification).
- Attributes: light-green filled ellipses; primary keys underlined (category_id, type_id, faculty_id, department_id, user_id, complaint_id, response_id, escalation_id, log_id, feedback_id, notif_id).
- Edges: curved (default Graphviz splines), thin black, with 1 / N / M cardinality labels near the diamond.
- Layout: organic radial arrangement centered on COMPLAINT (dot engine, splines=true).

## Technical approach
- Update `/tmp/er_chen.py`: set `splines='true'`, add `style='filled'` + fillcolors (`#DCE8FA` entities, `#F7D9A6` diamonds, `#DDEFCB` attributes), uppercase entity labels, keep underlined PKs via HTML labels.
- Render to `/mnt/documents/ER_Diagram_Chen.png` at 220 DPI.
- QA: view the PNG, check colors, cardinality labels, no clipping; iterate if needed.

## Out of scope
No code, schema, or PDF changes.