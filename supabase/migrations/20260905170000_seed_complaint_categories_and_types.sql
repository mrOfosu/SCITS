-- Align complaint categories with the current complaint workflow.
UPDATE public.complaint_categories
SET name = 'Technical', code = 'technical'
WHERE code = 'infrastructure';

UPDATE public.complaint_categories
SET name = 'Facilities & Welfare', code = 'facilities'
WHERE code = 'other';

INSERT INTO public.complaint_categories (name, code)
VALUES
  ('Academic', 'academic'),
  ('Administrative', 'administrative'),
  ('Facilities & Welfare', 'facilities'),
  ('Technical', 'technical')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

-- Preserve old complaint references while aligning legacy type labels.
UPDATE public.complaint_types
SET name = 'Poor Teaching Delivery', code = 'ACAD_POOR_TEACHING_DELIVERY'
WHERE code = 'coursework_problem';

UPDATE public.complaint_types
SET name = 'Wrong Grade Uploaded', code = 'ACAD_WRONG_GRADE_UPLOADED'
WHERE code = 'missing_grade';

INSERT INTO public.complaint_types
  (category_id, name, code, default_priority, default_department_code)
SELECT cc.id, seed.name, seed.code, seed.default_priority::complaint_priority, seed.default_department_code
FROM (
  VALUES
    ('academic', 'Course Not Reflecting', 'ACAD_COURSE_NOT_REFLECTING', 'medium', 'ACADAFF'),
    ('academic', 'Course Registration Problems', 'ACAD_REG_PROBLEMS', 'medium', 'ACADAFF'),
    ('academic', 'Course Result Missing', 'ACAD_COURSE_RESULT_MISSING', 'high', 'EXAMS'),
    ('academic', 'Delay in Releasing Marks', 'ACAD_DELAY_RELEASING_MARKS', 'high', 'EXAMS'),
    ('academic', 'Delayed Results', 'ACAD_DELAYED_RESULTS', 'high', 'EXAMS'),
    ('academic', 'Examination Malpractice Dispute', 'ACAD_EXAM_MALPRACTICE', 'high', 'EXAMS'),
    ('academic', 'GPA Calculation Complaint', 'ACAD_GPA_CALCULATION', 'high', 'EXAMS'),
    ('academic', 'Grade Not Showing on Portal', 'ACAD_GRADE_NOT_SHOWING', 'high', 'EXAMS'),
    ('academic', 'Inadequate Lecture Materials', 'ACAD_INADEQUATE_MATERIALS', 'medium', 'ACADAFF'),
    ('academic', 'Incomplete Grade (I)', 'ACAD_INCOMPLETE_GRADE', 'high', 'EXAMS'),
    ('academic', 'Lecturer Attitude Complaint', 'ACAD_LECTURER_ATTITUDE', 'medium', 'ACADAFF'),
    ('academic', 'Lecturer Harassment Complaint', 'ACAD_LECTURER_HARASSMENT', 'high', 'ACADAFF'),
    ('academic', 'Lecturer Not Attending Lectures', 'ACAD_LECTURER_NOT_ATTENDING', 'high', 'ACADAFF'),
    ('academic', 'Lecturer Refusing Project Supervision', 'ACAD_LECTURER_REFUSING_SUPERVISION', 'high', 'ACADAFF'),
    ('academic', 'Level/Programme Placement Errors', 'ACAD_PLACEMENT_ERRORS', 'medium', 'ACADAFF'),
    ('academic', 'Missing Results', 'ACAD_MISSING_RESULTS', 'high', 'EXAMS'),
    ('academic', 'Poor Teaching Delivery', 'ACAD_POOR_TEACHING_DELIVERY', 'medium', 'ACADAFF'),
    ('academic', 'Prerequisite Course Errors', 'ACAD_PREREQUISITE_ERRORS', 'medium', 'ACADAFF'),
    ('academic', 'Project Supervision Issues', 'ACAD_PROJECT_SUPERVISION', 'high', 'ACADAFF'),
    ('academic', 'Timetable Problems', 'ACAD_TIMETABLE_PROBLEMS', 'low', 'ACADAFF'),
    ('academic', 'Transcript Errors', 'ACAD_TRANSCRIPT_ERRORS', 'high', 'EXAMS'),
    ('academic', 'Unable to Register Courses', 'ACAD_UNABLE_TO_REGISTER', 'high', 'ACADAFF'),
    ('academic', 'Unfair Marking', 'ACAD_UNFAIR_MARKING', 'high', 'ACADAFF'),
    ('academic', 'Wrong Course Allocation', 'ACAD_WRONG_COURSE_ALLOCATION', 'medium', 'ACADAFF'),
    ('academic', 'Wrong Grade Uploaded', 'ACAD_WRONG_GRADE_UPLOADED', 'high', 'EXAMS'),
    ('academic', 'X Grade Issue', 'ACAD_X_GRADE_ISSUE', 'high', 'EXAMS'),

    ('administrative', 'Fees Payment Not Reflecting', 'ADMIN_FEES_NOT_REFLECTING', 'high', 'FINANCE'),
    ('administrative', 'Financial Clearance Problems', 'ADMIN_FINANCIAL_CLEARANCE', 'medium', 'FINANCE'),
    ('administrative', 'ID Card Processing Delay', 'ADMIN_ID_CARD_DELAY', 'low', 'ACADAFF'),
    ('administrative', 'National Service Letter Delay', 'ADMIN_NSS_LETTER_DELAY', 'medium', 'ACADAFF'),

    ('facilities', 'Hostel Accommodation Issues', 'FAC_HOSTEL_ACCOMMODATION', 'high', 'HOSTEL'),
    ('facilities', 'Security Concerns', 'FAC_SECURITY_CONCERNS', 'high', 'SECURITY'),
    ('facilities', 'Sexual Harassment Complaints', 'FAC_SEXUAL_HARASSMENT', 'critical', 'WELFARE'),
    ('facilities', 'Washroom/Sanitation Complaints', 'FAC_SANITATION', 'medium', 'FACILITIES'),

    ('technical', 'Internet Downtime', 'TECH_INTERNET_DOWNTIME', 'high', 'ICT'),
    ('technical', 'LMS Access Problem', 'TECH_LMS_ACCESS', 'medium', 'ICT'),
    ('technical', 'Student Portal Login Failure', 'TECH_PORTAL_LOGIN', 'high', 'ICT'),
    ('technical', 'Broken Lab Equipment', 'TECH_BROKEN_LAB_EQUIPMENT', 'medium', 'ICT')
) AS seed(category_code, name, code, default_priority, default_department_code)
JOIN public.complaint_categories cc ON cc.code = seed.category_code
ON CONFLICT (code) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  default_priority = EXCLUDED.default_priority,
  default_department_code = EXCLUDED.default_department_code;
