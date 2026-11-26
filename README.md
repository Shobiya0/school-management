# Disha Preschool Management PWA

Single-school Vercel + Supabase project. Start with `SETUP.md`.

**This package is a foundation release:** secure Supabase login/role policies, student records, Excel import/export, attendance, fees, PWA shell and limited offline write queue are included. Several operational modules remain planned and are not yet fully implemented. Configure Supabase and complete the test checklist before real school use.


## Student photo upload (added in this package)

The student form supports JPG, PNG and WEBP photos up to 2 MB. Photos are stored in a **private** Supabase Storage bucket named `student-photos`; the student directory uses short-lived signed URLs to display them.

Before testing the feature:

1. In Supabase → Storage, create (or confirm) a **private** bucket named `student-photos`, with a 2 MB file limit and allowed MIME types `image/jpeg`, `image/png`, `image/webp`.
2. In Supabase → SQL Editor, run `supabase/student-photo-setup/001_student_photos.sql`. This adds `students.photo_path` and the Storage policies. It expects the existing `public.current_school_role()` and `public.is_parent_of_student(uuid)` helper functions from the parent-access setup.
3. Deploy this package and sign in as an Admin or Teacher. Add a test student with a photo, then check Storage → `student-photos`.

Photos are not included in Excel exports. The package displays photos in the staff student directory and in the linked parent dashboard. Do not make the bucket public.


## Parent dashboard and student photos
This update includes a restricted parent dashboard for linked children and private student photo display. Follow `PARENT-DASHBOARD-SETUP.txt` before creating parent accounts. The parent dashboard relies on the restricted parent RPCs created in the earlier database setup plus `002_parent_photo_rpc.sql`. Do not expose the Supabase service-role key in frontend files.
