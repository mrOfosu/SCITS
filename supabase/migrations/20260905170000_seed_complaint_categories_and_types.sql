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

INSERT INTO public.complaint_types
  (category_id, name, code, default_priority, default_department_code)
SELECT cc.id, seed.name, seed.code, seed.default_priority::complaint_priority, seed.default_department_code
FROM (
  VALUES
    ('academic', 'Course Registration Problems', 'ACAD_REG_PROBLEMS', 'medium', 'ACADAFF'),
    ('academic', 'Examination Malpractice Dispute', 'ACAD_EXAM_MALPRACTICE', 'high', 'EXAMS'),
    ('academic', 'Lecturer Harassment Complaint', 'ACAD_LECTURER_HARASSMENT', 'high', 'ACADAFF'),
    ('academic', 'Transcript Errors', 'ACAD_TRANSCRIPT_ERRORS', 'high', 'EXAMS'),
    ('academic', 'Timetable Problems', 'ACAD_TIMETABLE_PROBLEMS', 'low', 'ACADAFF'),

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
