

# Student Complaint & Issue Tracking System

## Overview
A web-based platform where students can submit and track complaints, and administrators can manage, respond to, and resolve them — powered by React and Supabase.

---

## 1. Authentication & Roles
- **Student self-registration** via email/password with email verification
- **Admin accounts** seeded or assigned via a secure user roles table
- Login/signup pages with role-based redirects (students → dashboard, admins → admin panel)

## 2. Student Portal
- **Submit Complaint** form with:
  - Category dropdown (Academic, Infrastructure, Administrative, Other)
  - Subject line and detailed description
  - Optional file attachment
- **My Complaints** list showing all submitted complaints with:
  - Status badge (Pending, In Review, Resolved)
  - Date submitted and last updated
  - Click to view full details and admin responses

## 3. Admin Dashboard
- **All Complaints** table with filtering by status and category, plus search
- **Complaint Detail** view where admins can:
  - Update status (Pending → In Review → Resolved)
  - Write a response/note visible to the student
- **Overview stats** — counts of pending, in review, and resolved complaints

## 4. Email Notifications
- Students receive an email notification when their complaint status changes (via Resend + Supabase Edge Function)

## 5. Database Design (Supabase/PostgreSQL)
- **profiles** table for student display names
- **user_roles** table for admin role assignment (secure, separate from profiles)
- **complaints** table with category, subject, description, status, timestamps
- **complaint_responses** table for admin replies
- Row-Level Security so students only see their own complaints, admins see all

## 6. Design & UX
- Clean, modern UI using existing shadcn/ui components
- Responsive layout for mobile and desktop
- Toast notifications for actions (submitted, updated, etc.)
- Dark/light mode support

